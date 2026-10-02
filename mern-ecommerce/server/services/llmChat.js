/**
 * RAG chat over the migrated catalogue.
 *
 * Every question is answered from three kinds of context, all read from Oracle
 * AI Database with SQL:
 *   1. semantic matches - the question is embedded (in-database ONNX model or the
 *      configured OpenAI-compatible endpoint) and the closest products are fetched
 *      with VECTOR_DISTANCE, kept in rank order;
 *   2. price-filtered matches - when the question states a price limit or range
 *      ("under $25", "between $10 and $40") the products inside it are selected
 *      with SQL, because nearest-neighbour search knows nothing about prices;
 *   3. catalogue facts - counts, price range, cheapest/most expensive products,
 *      brand and category rankings, ratings and the latest reviews. Aggregate
 *      questions ("how many are out of stock?") cannot be answered from a handful
 *      of retrieved products, so the totals are computed once and cached.
 * Generation runs on the configured OpenAI-compatible chat model.
 *
 * When embeddings are not available yet the semantic part degrades to a keyword
 * search over the same collections, and the response reports which path was used.
 */
const { query } = require('./oracle');
const llm = require('./llm');
const vectorSearch = require('./vectorSearch');
const { httpError } = require('../utils/http');

const MAX_MESSAGE_CHARS = 500;
const MAX_HISTORY_TURNS = 6;
const MAX_HISTORY_CHARS = 2000;
const SEMANTIC_TOP_K = 6;
const PRICE_MATCH_LIMIT = 10;
const FACTS_TTL_MS = 60 * 1000;
// A reply such as "which of those is cheapest?" has no searchable content of its own.
const FOLLOW_UP_MAX_WORDS = 8;

const SYSTEM_PROMPT = `You are the store assistant for a MERN ecommerce demo whose catalogue lives in Oracle AI Database 26ai.
Answer using ONLY the catalogue context in the user's message and the earlier turns of this conversation. If the context does not contain the answer, say so plainly instead of guessing.
Use product, brand and category names and prices exactly as written in the context.
"Catalogue facts" are complete, current totals for the whole store. The product lists are samples: a product missing from them is not proof it does not exist, but a "price filter" list holds every product inside the requested range (up to its stated limit).
The same product name can appear several times as separate listings under different brands or categories; say so rather than treating them as one product.
Ratings and reviews only count Approved reviews; mention how many reviews a rating is based on.
For recommendations and gift ideas, suggest the closest products from the context and say they are the closest fit; only say that nothing matches when nothing in the context is remotely relevant.
When the question refers back to earlier turns ("those", "them", "it", "the first one"), resolve it from the previous answers first, using the section of products named in the previous answer, and answer only about those products.
Keep answers short: a sentence or two, or a short "- " list.`;

// ---------------------------------------------------------------------- SQL
// Only active products are part of the storefront, so every statement sees only those.
const IS_ACTIVE = `json_value(p.data, '$.isActive') = 'true'`;

const approvedReviewTotals = `
  rv as (
    select json_value(data, '$.product') as product_id,
           round(avg(json_value(data, '$.rating' returning number)), 2) as avg_rating,
           count(*) as review_count
      from reviews
     where json_value(data, '$.status') = 'Approved'
     group by json_value(data, '$.product'))`;

// One row per active product, enriched with the fields a shopper reasons about.
// The WHERE/ORDER pieces are fixed fragments from this file, never user text;
// user values always travel as binds.
const productQuery = ({ where = '1 = 1', order = 'c.price, c.name', limit = PRICE_MATCH_LIMIT }) => `
  with ${approvedReviewTotals},
  catalogue as (
    select json_value(p.data, '$._id') as id,
           json_value(p.data, '$.slug') as slug,
           json_value(p.data, '$.name') as name,
           json_value(p.data, '$.description') as description,
           json_value(p.data, '$.price' returning number) as price,
           nvl(json_value(p.data, '$.quantity' returning number), 0) as quantity,
           (select json_value(b.data, '$.name') from brands b
             where json_value(b.data, '$._id') = json_value(p.data, '$.brand')) as brand,
           (select listagg(json_value(k.data, '$.name'), ', ') within group (order by json_value(k.data, '$.name'))
              from categories k
             where json_exists(k.data, '$.products[*]?(@ == $prod)' passing json_value(p.data, '$._id') as "prod")) as categories
      from products p
     where ${IS_ACTIVE})
  select c.id, c.slug, c.name, c.description, c.price, c.quantity, c.brand, c.categories,
         rv.avg_rating, nvl(rv.review_count, 0) as review_count,
         count(*) over () as total_matches
    from catalogue c
    left join rv on rv.product_id = c.id
   where ${where}
   order by ${order}
   fetch first ${limit} rows only`;

const toDocument = (row) => ({
  id: row.ID,
  slug: row.SLUG,
  name: row.NAME,
  description: row.DESCRIPTION,
  price: row.PRICE,
  quantity: row.QUANTITY,
  inStock: row.QUANTITY > 0,
  brand: row.BRAND || null,
  category: row.CATEGORIES || null,
  rating: row.AVG_RATING,
  reviews: row.REVIEW_COUNT
});

const money = (value) => `$${Number(value).toFixed(2)}`;

const formatLine = (doc) => {
  const details = [
    doc.brand ? `brand: ${doc.brand}` : null,
    doc.category ? `category: ${doc.category}` : null,
    doc.inStock ? `in stock (${doc.quantity} units)` : 'out of stock',
    doc.reviews ? `rated ${doc.rating}/5 from ${doc.reviews} review${doc.reviews === 1 ? '' : 's'}` : 'no reviews yet'
  ].filter(Boolean);
  return `- ${doc.name} (${money(doc.price)}) [${details.join('; ')}]: ${doc.description || 'no description'}`;
};

// What the browser receives for each product: enough to render a chip that
// links to the product page.
const toSource = (doc) => ({
  id: doc.id,
  name: doc.name,
  slug: doc.slug,
  price: doc.price,
  brand: doc.brand,
  category: doc.category,
  inStock: doc.inStock
});

// The sources of an answer are the products it names, looked up in the catalogue.
// Retrieval alone would be misleading: nearest-neighbour search always returns its
// top hits, even for a question ("how many are out of stock?") about no product,
// and the facts block names products that were never retrieved.
const MAX_CITED = 8;

const citedProducts = async (answer) => {
  const rows = await query(
    productQuery({
      where: 'instr(lower(:answer), lower(c.name)) > 0',
      order: 'instr(lower(:answer), lower(c.name)), c.price',
      limit: MAX_CITED
    }),
    { answer }
  );
  return rows.map(toDocument);
};

// ---------------------------------------------------------- price constraints
const NUMBER = String.raw`(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)`;
const AMOUNT = String.raw`\$?\s*${NUMBER}`;
const CURRENCY_MARK = /\$|\bdollars?\b|\busd\b|\bbucks\b/;

const BETWEEN = new RegExp(String.raw`\bbetween\s+${AMOUNT}\s*(?:and|to|-|–)\s*${AMOUNT}`);
const DASH_RANGE = new RegExp(String.raw`\$\s*${NUMBER}\s*(?:-|–|to)\s*\$?\s*${NUMBER}`);
const UPPER = new RegExp(
  String.raw`\b(under|below|less than|cheaper than|up to|at most|no more than|within|max(?:imum)?(?: of| price)?)\s+${AMOUNT}`
);
const LOWER = new RegExp(
  String.raw`\b(over|above|more than|greater than|at least|no less than|min(?:imum)?(?: of| price)?)\s+${AMOUNT}`
);

const INCLUSIVE = /^(up to|at most|no more than|within|max|min|at least|no less than)/;

const toNumber = (text) => Number(text.replace(/,/g, ''));

// A bare number ("top 5", "3 brands") is not a price: the match must carry a
// currency marker.
const hasCurrency = (match) => CURRENCY_MARK.test(`${match[0]}${match.input.slice(match.index + match[0].length, match.index + match[0].length + 9)}`);

/**
 * Extracts an explicit price limit or range from a question, or null.
 * Returns { min, max, minInclusive, maxInclusive } (undefined bound = open).
 */
const parsePriceFilter = (text) => {
  const lowered = String(text || '').toLowerCase();

  const range = lowered.match(BETWEEN) || lowered.match(DASH_RANGE);
  if (range && hasCurrency(range)) {
    const [low, high] = [toNumber(range[1]), toNumber(range[2])].sort((a, b) => a - b);
    return { min: low, max: high, minInclusive: true, maxInclusive: true };
  }

  const filter = {};
  const upper = lowered.match(UPPER);
  if (upper && hasCurrency(upper)) {
    filter.max = toNumber(upper[2]);
    filter.maxInclusive = INCLUSIVE.test(upper[1]);
  }
  const lower = lowered.match(LOWER);
  if (lower && hasCurrency(lower)) {
    filter.min = toNumber(lower[2]);
    filter.minInclusive = INCLUSIVE.test(lower[1]);
  }
  if (filter.min === undefined && filter.max === undefined) return null;
  if (filter.min !== undefined && filter.max !== undefined && filter.min > filter.max) return null;
  return filter;
};

const describePriceFilter = ({ min, max, minInclusive, maxInclusive }) => {
  if (min !== undefined && max !== undefined) return `between ${money(min)} and ${money(max)}`;
  if (max !== undefined) return `${maxInclusive ? 'at most' : 'under'} ${money(max)}`;
  return `${minInclusive ? 'at least' : 'over'} ${money(min)}`;
};

const priceMatches = async (filter) => {
  const conditions = [];
  const binds = {};
  if (filter.min !== undefined) {
    conditions.push(`c.price ${filter.minInclusive ? '>=' : '>'} :min`);
    binds.min = filter.min;
  }
  if (filter.max !== undefined) {
    conditions.push(`c.price ${filter.maxInclusive ? '<=' : '<'} :max`);
    binds.max = filter.max;
  }
  const rows = await query(productQuery({ where: conditions.join(' and ') }), binds);
  return {
    label: describePriceFilter(filter),
    total: rows[0]?.TOTAL_MATCHES ?? 0,
    documents: rows.map(toDocument)
  };
};

// ------------------------------------------------------------ semantic search
const STOPWORDS = new Set(['which', 'what', 'does', 'cost', 'sell', 'your', 'have', 'with', 'that', 'this', 'from', 'they', 'them', 'show', 'list', 'many', 'much', 'about', 'into', 'there', 'where', 'when', 'tell']);

// The keyword path only covers one boundary: no embeddings to search yet. Any
// other error (a broken join, a driver failure) is a real failure and must not
// be answered with a plausible-looking keyword result.
const NO_EMBEDDINGS = new Set(['NO_EMBEDDINGS', 'EMBEDDINGS_NOT_CONFIGURED']);

const keywordSearch = async (message) => {
  const terms = String(message)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3 && !STOPWORDS.has(word))
    .slice(0, 4);
  const needles = terms.length ? terms : [String(message).toLowerCase()];

  // One OR'd LIKE per term: a phrase match would miss documents that spread the
  // words across fields, which is the common case for a product question.
  const binds = {};
  const clauses = needles.map((term, index) => {
    binds[`t${index}`] = `%${term.replace(/[%_\\]/g, '\\$&')}%`;
    return `lower(c.name || ' ' || c.description || ' ' || c.brand || ' ' || c.categories) like :t${index} escape '\\'`;
  });
  const rows = await query(
    productQuery({ where: clauses.join(' or '), order: 'c.name, c.price', limit: SEMANTIC_TOP_K }),
    binds
  );
  return rows.map(toDocument);
};

const vectorSearchDocuments = async (text) => {
  const { results, source } = await vectorSearch.search(text, SEMANTIC_TOP_K);
  const binds = {};
  const placeholders = results.map((row, index) => {
    binds[`id${index}`] = row.id;
    return `:id${index}`;
  });
  const rows = await query(
    productQuery({ where: `c.id in (${placeholders.join(',')})`, order: 'c.id', limit: results.length }),
    binds
  );
  // Join on product id, not name: the catalogue holds same-named products in
  // different departments. The IN list has no order, so restore the vector rank;
  // inactive products drop out here.
  const byId = new Map(rows.map((row) => [row.ID, toDocument(row)]));
  return { source, documents: results.map((row) => byId.get(row.id)).filter(Boolean) };
};

const semanticSearch = async (text) => {
  try {
    return await vectorSearchDocuments(text);
  } catch (error) {
    if (!NO_EMBEDDINGS.has(error.code)) throw error;
    console.warn(`[chat] vector search unavailable, using keyword search: ${error.message}`);
    return { source: 'keyword-fallback', documents: await keywordSearch(text) };
  }
};

// ----------------------------------------------------------- catalogue facts
const activeProducts = `from products p where ${IS_ACTIVE}`;
const productPrice = `json_value(p.data, '$.price' returning number)`;
const productStock = `nvl(json_value(p.data, '$.quantity' returning number), 0)`;

// A product -> category row for every membership, restricted to active products.
const categoryMembership = `
  (select json_value(k.data, '$.name') as category, jt.product_id
     from categories k,
          json_table(k.data, '$.products[*]' columns (product_id varchar2(32) path '$')) jt)`;

// Grouped by name and price: seeded catalogues repeat a product under several
// brands, and five identical rows would hide the next-cheapest products.
const extremes = (direction) =>
  query(`select name, price, count(*) as listings,
                listagg(distinct brand, ', ') within group (order by brand) as brands
           from (select json_value(p.data, '$.name') as name,
                        ${productPrice} as price,
                        (select json_value(b.data, '$.name') from brands b
                          where json_value(b.data, '$._id') = json_value(p.data, '$.brand')) as brand
                   ${activeProducts})
          group by name, price
          order by price ${direction}, name
          fetch first 5 rows only`);

const factQueries = {
  stats: () =>
    query(`select count(*) as total,
                  sum(case when ${productStock} > 0 then 1 else 0 end) as in_stock,
                  min(${productPrice}) as min_price,
                  max(${productPrice}) as max_price
             ${activeProducts}`),
  outOfStock: () =>
    query(`select json_value(p.data, '$.name') as name
             ${activeProducts} and ${productStock} <= 0
            order by 1
            fetch first 10 rows only`),
  cheapest: () => extremes('asc'),
  priciest: () => extremes('desc'),
  brands: () =>
    query(`select b.name as name, count(*) as products
             from products p
             join (select json_value(data, '$._id') as id, json_value(data, '$.name') as name from brands) b
               on b.id = json_value(p.data, '$.brand')
            where ${IS_ACTIVE}
            group by b.id, b.name
            order by products desc, b.name
            fetch first 8 rows only`),
  categories: () =>
    query(`select m.category as name, count(*) as products
             from ${categoryMembership} m
             join products p on json_value(p.data, '$._id') = m.product_id
            where ${IS_ACTIVE}
            group by m.category
            order by products desc, m.category
            fetch first 10 rows only`),
  ratings: () =>
    query(`select count(*) as reviews, round(avg(json_value(data, '$.rating' returning number)), 2) as average
             from reviews where json_value(data, '$.status') = 'Approved'`),
  // By name, like the price lists: the same item listed under several brands is one product to a shopper.
  topProducts: () =>
    query(`select json_value(p.data, '$.name') as name,
                  round(avg(json_value(r.data, '$.rating' returning number)), 2) as average,
                  count(*) as reviews
             from reviews r
             join products p on json_value(p.data, '$._id') = json_value(r.data, '$.product')
            where json_value(r.data, '$.status') = 'Approved' and ${IS_ACTIVE}
            group by json_value(p.data, '$.name')
            order by average desc, reviews desc, name
            fetch first 5 rows only`),
  topCategories: () =>
    query(`select m.category as name,
                  round(avg(json_value(r.data, '$.rating' returning number)), 2) as average,
                  count(*) as reviews
             from reviews r
             join ${categoryMembership} m on m.product_id = json_value(r.data, '$.product')
             join products p on json_value(p.data, '$._id') = m.product_id
            where json_value(r.data, '$.status') = 'Approved' and ${IS_ACTIVE}
            group by m.category
            order by average desc, reviews desc, m.category
            fetch first 5 rows only`),
  recentReviews: () =>
    query(`select json_value(p.data, '$.name') as product,
                  json_value(r.data, '$.rating' returning number) as rating,
                  json_value(r.data, '$.title') as title,
                  substr(json_value(r.data, '$.review'), 1, 140) as text
             from reviews r
             join products p on json_value(p.data, '$._id') = json_value(r.data, '$.product')
            where json_value(r.data, '$.status') = 'Approved'
            order by json_value(r.data, '$.created') desc
            fetch first 5 rows only`)
};

const list = (rows, render) => rows.map(render).join('; ');

const productExtreme = (row) =>
  row.LISTINGS > 1
    ? `${row.NAME} ${money(row.PRICE)} (${row.LISTINGS} listings: ${row.BRANDS})`
    : `${row.NAME} ${money(row.PRICE)} (${row.BRANDS || 'no brand'})`;

const formatFacts = (facts) => {
  const [stats] = facts.stats;
  const [ratings] = facts.ratings;
  const lines = [
    `- Active products: ${stats.TOTAL}; in stock: ${stats.IN_STOCK}; out of stock: ${stats.TOTAL - stats.IN_STOCK}` +
      (facts.outOfStock.length ? ` (${facts.outOfStock.map((row) => row.NAME).join(', ')})` : '') +
      '.',
    `- Price range: ${money(stats.MIN_PRICE)} to ${money(stats.MAX_PRICE)}.`,
    `- Cheapest products: ${list(facts.cheapest, productExtreme)}.`,
    `- Most expensive products: ${list(facts.priciest, productExtreme)}.`,
    `- Brands with the most active products: ${list(facts.brands, (row) => `${row.NAME} (${row.PRODUCTS})`)}.`,
    `- Categories by product count: ${list(facts.categories, (row) => `${row.NAME} (${row.PRODUCTS})`)}.`,
    `- Approved reviews: ${ratings.REVIEWS}` + (ratings.REVIEWS ? `, overall average ${ratings.AVERAGE}/5.` : '.')
  ];
  if (facts.topProducts.length) {
    lines.push(
      `- Highest-rated products (average of Approved reviews): ${list(
        facts.topProducts,
        (row) => `${row.NAME} ${row.AVERAGE}/5 (${row.REVIEWS} review${row.REVIEWS === 1 ? '' : 's'})`
      )}.`
    );
  }
  if (facts.topCategories.length) {
    lines.push(
      `- Highest-rated categories (average of Approved reviews of their products): ${list(
        facts.topCategories,
        (row) => `${row.NAME} ${row.AVERAGE}/5 (${row.REVIEWS} review${row.REVIEWS === 1 ? '' : 's'})`
      )}.`
    );
  }
  if (facts.recentReviews.length) {
    lines.push('- Most recent Approved reviews:');
    for (const row of facts.recentReviews) {
      lines.push(`  - ${row.PRODUCT}, ${row.RATING}/5, "${row.TITLE}": ${row.TEXT}`);
    }
  }
  return lines.join('\n');
};

let factsCache = { at: 0, text: null, pending: null };

const loadFacts = async () => {
  const names = Object.keys(factQueries);
  const results = await Promise.all(names.map((name) => factQueries[name]()));
  return formatFacts(Object.fromEntries(names.map((name, index) => [name, results[index]])));
};

// Cached for a minute and shared between concurrent requests, so a burst of
// questions costs one round of aggregate queries.
const getFacts = async () => {
  if (factsCache.text && Date.now() - factsCache.at < FACTS_TTL_MS) return factsCache.text;
  if (!factsCache.pending) {
    factsCache.pending = loadFacts()
      .then((text) => {
        factsCache = { at: Date.now(), text, pending: null };
        return text;
      })
      .catch((error) => {
        factsCache.pending = null;
        throw error;
      });
  }
  return factsCache.pending;
};

// -------------------------------------------------------------------- request
/**
 * Validates a POST /api/chat body: `{ message, history? }`. Only the most recent
 * turns are kept; each must be a user/assistant string within the size limit.
 */
const parseChatInput = (body) => {
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!message) throw httpError(400, 'message is required.');
  if (message.length > MAX_MESSAGE_CHARS) {
    throw httpError(400, `message must be at most ${MAX_MESSAGE_CHARS} characters.`);
  }

  const rawHistory = body.history === undefined ? [] : body.history;
  if (!Array.isArray(rawHistory)) throw httpError(400, 'history must be an array.');
  const history = rawHistory.slice(-MAX_HISTORY_TURNS).map((turn) => {
    const content = typeof turn?.content === 'string' ? turn.content.trim() : '';
    if (!['user', 'assistant'].includes(turn?.role) || !content || content.length > MAX_HISTORY_CHARS) {
      throw httpError(400, `Each history turn needs a user/assistant role and 1-${MAX_HISTORY_CHARS} characters of content.`);
    }
    return { role: turn.role, content };
  });
  return { message, history };
};

const retrieve = async (message, history) => {
  const lastQuestion = [...history].reverse().find((turn) => turn.role === 'user')?.content;
  const lastAnswer = [...history].reverse().find((turn) => turn.role === 'assistant')?.content;
  const isFollowUp = Boolean(lastQuestion) && message.split(/\s+/).length <= FOLLOW_UP_MAX_WORDS;

  const priceFilter = parsePriceFilter(message) || (isFollowUp ? parsePriceFilter(lastQuestion) : null);
  const [facts, matches, previous, semantic] = await Promise.all([
    getFacts(),
    priceFilter ? priceMatches(priceFilter) : null,
    // "which of those is cheapest?" is about the products the last answer named.
    isFollowUp && lastAnswer ? citedProducts(lastAnswer) : [],
    semanticSearch(isFollowUp ? `${lastQuestion}\n${message}` : message)
  ]);

  const sections = [`Catalogue facts (live, complete for the whole store):\n${facts}`];
  if (previous.length) {
    sections.push(
      `Products named in your previous answer (what "those", "them" or "it" refers to):\n${previous.map(formatLine).join('\n')}`
    );
  }
  if (matches) {
    sections.push(
      `Price filter "${matches.label}": ${matches.total} active product${matches.total === 1 ? '' : 's'} match` +
        (matches.total > matches.documents.length
          ? `; the ${matches.documents.length} cheapest are listed`
          : '; all are listed') +
        `, cheapest first:\n${matches.documents.map(formatLine).join('\n') || '(none)'}`
    );
  }
  const caveats = [matches && 'they may fall outside the price filter', previous.length && 'they may be unrelated to a follow-up']
    .filter(Boolean)
    .join('; ');
  sections.push(
    `Products closest in meaning to the question (best match first${caveats ? `; ${caveats}` : ''}):\n` +
      (semantic.documents.map(formatLine).join('\n') || '(none)')
  );
  return { source: semantic.source, context: sections.join('\n\n') };
};

/**
 * Answers one chat turn. Throws on retrieval or provider failure; the caller
 * decides what the browser sees.
 */
const ragQuery = async ({ message, history = [] }) => {
  const retrieval = await retrieve(message, history);
  const completion = await llm.chat({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: `Catalogue context:\n${retrieval.context}\n\nQuestion: ${message}` }
    ]
  });
  const cited = await citedProducts(completion.content);
  return {
    response: completion.content,
    model: completion.model,
    retrieval: { source: retrieval.source, documents: cited.map(toSource) }
  };
};

/** Computes the catalogue facts and loads the embedding model before the first question. */
const warmUp = () => Promise.all([getFacts(), vectorSearch.search('catalogue', 1).catch(() => null)]);

module.exports = { ragQuery, parseChatInput, warmUp };
