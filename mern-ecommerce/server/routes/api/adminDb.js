/**
 * Migration / 26ai showcase endpoints.
 *
 * `/collections`    - every MongoDB API collection (via mongoose) and every Oracle
 *                     JSON collection (via SQL) with its document count, in one
 *                     request. The per-side lists and per-collection counts below
 *                     are the older endpoints, served from the same data.
 * `/views`          - relational views and JSON collection views over the
 *                     migrated documents.
 * `/duality-views`  - JSON-relational duality views built from the collections.
 * `/validity`       - JSON schema validity report (DBMS_JSON_SCHEMA).
 * `/migration-status` - per-collection source vs target comparison, from the
 *                     report written by scripts/verify_migration.py.
 *
 * The page behind these routes is public, so the routes are cheap and closed:
 * results are cached for 15 s (`?fresh=1` re-reads), object names are checked
 * against the real collection list, and neither driver text nor server paths
 * ever reach a response.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const { query, schema } = require('../../services/oracle');
const vectorSearch = require('../../services/vectorSearch');
const { asyncHandler, httpError } = require('../../utils/http');

const router = express.Router();

const CACHE_TTL_MS = 15 * 1000;
// `?fresh=1` is public too; this keeps a refresh loop from turning into load.
const MIN_REFRESH_MS = 1000;

const cache = new Map();

/**
 * Serves `load()` from the cache while it is younger than CACHE_TTL_MS. Callers
 * that arrive while a load is running share it. `?fresh=1` skips the cached value.
 */
const cached = (key, req, load) => {
  const entry = cache.get(key);
  if (entry?.pending) return entry.pending;
  const age = entry ? Date.now() - entry.at : Infinity;
  const wantsFresh = req.query.fresh === '1' && age > MIN_REFRESH_MS;
  if (entry && age < CACHE_TTL_MS && !wantsFresh) return Promise.resolve(entry.value);

  const pending = load().then(
    (value) => {
      cache.set(key, { at: Date.now(), value, pending: null });
      return value;
    },
    (error) => {
      if (entry) cache.set(key, { ...entry, pending: null });
      else cache.delete(key);
      throw error;
    }
  );
  cache.set(key, { ...entry, pending });
  return pending;
};

// A statement-local function counts a relation without failing the whole query:
// some views cannot be counted by this schema (a missing grant, a
// dictionary-backed view) and their row reports null instead of a wrong number.
const COUNT_FUNCTION = `
  function row_count(name varchar2) return number is
    total number;
  begin
    execute immediate 'select count(*) from ' || dbms_assert.enquote_name(name, false) into total;
    return total;
  exception when others then
    return null;
  end;`;

// ---------------------------------------------------------------- collections
const loadMongoCollections = async () => {
  const { db } = mongoose.connection;
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  const counted = await Promise.all(
    collections.map(async ({ name }) => ({ name, count: await db.collection(name).countDocuments() }))
  );
  return counted.sort((a, b) => a.name.localeCompare(b.name));
};

const loadOracleCollections = async () => {
  const rows = await query(
    `with ${COUNT_FUNCTION}
     select collection_name, collection_type, row_count(collection_name) as documents
       from user_json_collections
      order by collection_name`
  );
  return rows.map((row) => ({ name: row.COLLECTION_NAME, type: row.COLLECTION_TYPE, count: row.DOCUMENTS }));
};

const mongoCollections = (req) => cached('collections:mongo', req, loadMongoCollections);
const oracleCollections = (req) => cached('collections:oracle', req, loadOracleCollections);

// Names come from the real collection list, never from the URL into SQL.
const findCollection = async (list, name) => {
  const found = (await list).find((collection) => collection.name === name);
  if (!found) throw httpError(404, 'Unknown collection');
  return found;
};

// The MongoDB side must stay readable when SQL access is missing or down (an API
// started with only MONGO_URI), so an Oracle failure is reported in
// `oracleStatus` instead of failing the response.
router.get(
  '/collections',
  asyncHandler(async (req, res) => {
    const [mongo, oracle] = await Promise.allSettled([mongoCollections(req), oracleCollections(req)]);
    if (mongo.status === 'rejected') throw mongo.reason;
    if (oracle.status === 'fulfilled') return res.json({ mongo: mongo.value, oracle: oracle.value, oracleStatus: 'ok' });

    const configured = oracle.reason.code !== 'ORACLE_NOT_CONFIGURED';
    if (configured) console.error('[admin-db] Oracle collections failed:', oracle.reason);
    return res.json({
      mongo: mongo.value,
      oracle: [],
      oracleStatus: configured ? 'unavailable' : 'not-configured'
    });
  })
);

router.get(
  '/collections/mongo',
  asyncHandler(async (req, res) => {
    res.json((await mongoCollections(req)).map((collection) => collection.name));
  })
);

router.get(
  '/collections/mongo/:name/count',
  asyncHandler(async (req, res) => {
    const { name, count } = await findCollection(mongoCollections(req), req.params.name);
    res.json({ collection: name, count });
  })
);

router.get(
  '/collections/oracle',
  asyncHandler(async (req, res) => {
    res.json((await oracleCollections(req)).map(({ name, type }) => ({ name, type })));
  })
);

router.get(
  '/collections/oracle/:name/count',
  asyncHandler(async (req, res) => {
    const { name, count } = await findCollection(oracleCollections(req), req.params.name);
    res.json({ collection: name, count });
  })
);

// ------------------------------------------------------------------- SQL views
router.get(
  '/views',
  asyncHandler(async (req, res) => {
    const payload = await cached('views', req, async () => {
      const rows = await query(
        `with ${COUNT_FUNCTION}
         select v.view_name,
                (select count(*) from user_tab_columns c where c.table_name = v.view_name) as column_count,
                (select count(*) from user_json_collections jc
                  where jc.collection_name = v.view_name and jc.collection_type = 'VIEW') as json_collection_view,
                row_count(v.view_name) as documents
           from user_views v
          where v.view_name not in (select view_name from user_json_duality_views)
            and v.view_name not like 'DM$%'   -- Oracle Data Mining / ONNX model internals (DM$V<model>)
          order by v.view_name`
      );
      return {
        views: rows.map((row) => ({
          name: row.VIEW_NAME,
          kind: row.JSON_COLLECTION_VIEW
            ? 'json-collection-view'
            : /_VALIDITY$/.test(row.VIEW_NAME)
              ? 'validity'
              : 'relational',
          columns: row.COLUMN_COUNT,
          documents: row.DOCUMENTS
        })),
        schema: schema.app
      };
    });
    res.json(payload);
  })
);

// -------------------------------------------------------------- duality views
// The duality views are populated from the JSON collections by
// DBMS_JSON_DUALITY.IMPORT_ALL, so they are a point-in-time copy: documents the
// application writes through the MongoDB API afterwards are only visible in the
// view after a re-import. Reporting both counts (plus the key-level difference)
// keeps the dashboard from showing duality numbers that silently disagree with
// the collections panel.
//
// The duality view renders an ObjectId as UPPER-case hex while the collection
// table renders it lower-case, so the key comparison folds case. The comparison
// runs inside the database (one round trip for every view); a view it cannot
// read comes back with a null `sync`.
const SYNC_FUNCTION = `
  function sync_state(dv_view varchar2, collection varchar2) return varchar2 is
    view_ids  varchar2(400) := q'[select upper(json_value(data, '$._id')) id from ]' || dv_view;
    table_ids varchar2(400) := q'[select upper(json_value(data, '$._id')) id from ]' || collection;
    documents number;
    collection_documents number;
    pending number;
    stale number;
  begin
    execute immediate
      'select (select count(*) from ' || dv_view || '),
              (select count(*) from ' || collection || '),
              (select count(*) from (' || table_ids || ' minus ' || view_ids || ')),
              (select count(*) from (' || view_ids || ' minus ' || table_ids || '))
         from dual'
      into documents, collection_documents, pending, stale;
    return json_object('documents' value documents,
                       'collectionDocuments' value collection_documents,
                       'pending' value pending,
                       'stale' value stale);
  exception when others then
    return null;
  end;`;

router.get(
  '/duality-views',
  asyncHandler(async (req, res) => {
    const payload = await cached('duality-views', req, async () => {
      const rows = await query(
        `with ${SYNC_FUNCTION}
         select view_name, allow_insert, allow_update, allow_delete,
                sync_state(dbms_assert.enquote_name(:dv, false) || '.' || dbms_assert.enquote_name(view_name, false),
                           dbms_assert.enquote_name(lower(regexp_replace(view_name, '_DV$')), false)) as sync
           from ${schema.dv}.duality_view_manifest
          order by view_name`,
        { dv: schema.dv }
      );
      return {
        views: rows.map((row) => {
          const sync = row.SYNC ? JSON.parse(row.SYNC) : null;
          return {
            name: row.VIEW_NAME,
            source: `${schema.app}.${row.VIEW_NAME.replace(/_DV$/, '').toLowerCase()}`,
            documents: sync?.documents ?? null,
            collectionDocuments: sync?.collectionDocuments ?? null,
            pending: sync?.pending ?? null,
            stale: sync?.stale ?? null,
            inSync: sync ? sync.pending === 0 && sync.stale === 0 : null,
            insert: row.ALLOW_INSERT === 'YES',
            update: row.ALLOW_UPDATE === 'YES',
            delete: row.ALLOW_DELETE === 'YES'
          };
        }),
        schema: schema.dv,
        source: `DBMS_JSON_DUALITY import of ${schema.app} (snapshot; re-run sql/26ai/06_import_duality_views.sql to refresh)`
      };
    });
    res.json(payload);
  })
);

// ------------------------------------------------------------- validity report
const VALIDITY_VIEWS = ['products_validity', 'users_validity', 'orders_validity', 'carts_validity'];

router.get(
  '/validity',
  asyncHandler(async (req, res) => {
    const payload = await cached('validity', req, async () => {
      const [rollup, schemas, ...samples] = await Promise.all([
        query(`select collection_name, documents, valid_documents from document_validity order by collection_name`),
        query(
          `select collection_name, dbms_lob.getlength(json_serialize(schema_json returning clob)) as schema_chars
             from json_schemas order by collection_name`
        ).catch(() => []),
        ...VALIDITY_VIEWS.map((view) =>
          query(`select doc_id, report from ${view} where is_valid = 0 fetch first 5 rows only`)
            .then((rows) => rows.map((row) => ({ view, doc_id: row.DOC_ID, report: row.REPORT })))
            .catch(() => [])
        )
      ]);

      return {
        collections: rollup.map((row) => ({
          name: row.COLLECTION_NAME,
          documents: row.DOCUMENTS,
          valid: row.VALID_DOCUMENTS,
          invalid: row.DOCUMENTS - row.VALID_DOCUMENTS
        })),
        inferredSchemas: schemas.map((row) => ({ collection: row.COLLECTION_NAME, characters: row.SCHEMA_CHARS })),
        invalidDocuments: samples.flat(),
        source: 'DBMS_JSON_SCHEMA.IS_VALID over schemas inferred from the duality views'
      };
    });
    res.json(payload);
  })
);

// ----------------------------------------------------------- migration status
const reportPaths = [
  process.env.MIGRATION_REPORT,
  path.resolve(__dirname, '../../../../docs/26ai/migration-report.json')
].filter(Boolean);

const readMigrationReport = () => {
  for (const candidate of reportPaths) {
    if (!fs.existsSync(candidate)) continue;
    try {
      return { report: JSON.parse(fs.readFileSync(candidate, 'utf8')), file: path.basename(candidate) };
    } catch (error) {
      console.error(`[admin-db] unreadable migration report ${candidate}: ${error.message}`);
    }
  }
  return { report: null, file: null };
};

router.get(
  '/migration-status',
  asyncHandler(async (req, res) => {
    const payload = await cached('migration-status', req, async () => {
      const { report, file } = readMigrationReport();

      // Only real collection tables take part in the comparison; JSON collection
      // views (read-only projections) are reported separately.
      const objects = await oracleCollections(req);
      const targetCounts = {};
      const targetViews = [];
      for (const { name, type, count } of objects) {
        if (type === 'VIEW') targetViews.push(name);
        else targetCounts[name.toLowerCase()] = count;
      }

      const names = report?.collections?.length
        ? report.collections.map((entry) => entry.name)
        : Object.keys(targetCounts);

      const comparisons = names.map((name) => {
        const fromReport = (report?.collections || []).find((entry) => entry.name === name);
        const source = fromReport?.source ?? null;
        const target = targetCounts[name] ?? null;
        return {
          collection: name,
          source,
          target,
          match: source === null ? null : source === target
        };
      });

      const sourceTotal = comparisons.reduce((sum, row) => sum + (row.source || 0), 0);
      const targetTotal = comparisons.reduce((sum, row) => sum + (row.target || 0), 0);

      return {
        generatedAt: report?.generatedAt || null,
        reportFile: file,
        sourceLabel: report?.sourceLabel || 'MongoDB (source)',
        targetLabel: report?.targetLabel || `Oracle Database API for MongoDB · ${schema.app}`,
        sourceDocuments: report?.sourceDocuments ?? sourceTotal,
        targetDocuments: targetTotal,
        verified: report?.verified ?? null,
        comparisons,
        targetViews,
        embeddingDimension: vectorSearch.EMBEDDING_DIM,
        embeddingModel: vectorSearch.EMBEDDING_MODEL || null
      };
    });
    res.json(payload);
  })
);

module.exports = router;
