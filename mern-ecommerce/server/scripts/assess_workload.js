/**
 * Workload assessment for the MongoDB -> Oracle AI Database 26ai migration.
 *
 * This is the "Planning / Workload analysis" step of Oracle's migration process (deck slide 7):
 * profile the workload, then review the operators and operations the application uses against
 * Oracle's support matrix for the Oracle Database API for MongoDB.
 *
 * It runs in mongosh against the SOURCE database - that is where the MongoDB profiler exists.
 * The Oracle Database API for MongoDB does not implement the `profiler` command (Feature Support:
 * "profiler | No | Use SQL Monitor for query profiling"), so profiling is a source-side activity.
 *
 * Usage (modes are read from the ASSESS_MODE environment variable):
 *
 *   ASSESS_MODE=status mongosh "$MONGO_URI" --file scripts/assess_workload.js
 *       db.serverStatus(): version, uptime, opcounters, connections, plus per-collection counts.
 *
 *   ASSESS_MODE=start  mongosh "$MONGO_URI" --file scripts/assess_workload.js
 *       db.setProfilingLevel(2) - profile everything, so the next application pass is recorded.
 *
 *   # ...drive application traffic (see _scratch/planning/traffic-readonly.sh)...
 *
 *   ASSESS_MODE=report mongosh "$MONGO_URI" --file scripts/assess_workload.js
 *       db.setProfilingLevel(0) FIRST (never leave profiling on), then summarise system.profile:
 *       operations by type and collection, aggregation stages, query and update operators, and
 *       the support status of everything observed according to Oracle's support matrix.
 *
 * No dependencies beyond mongosh itself (>= 0.15.6, the minimum in Oracle's client-tool matrix).
 *
 * Support matrix source (fetched 2026-09-30, Oracle Database API for MongoDB, F44905-26):
 *   - Feature Support: commands, operators, stages, data types, indexes
 *     https://docs.oracle.com/en/database/oracle/mongodb-api/mgapi/support-mongodb-apis-operations-and-data-types-reference.html
 *   - Aggregation Pipelines ($sql / $external / $lookup)
 *     https://docs.oracle.com/en/database/oracle/mongodb-api/mgapi/pipelines.html
 */

const MODE = (typeof process !== 'undefined' && process.env && process.env.ASSESS_MODE) || 'status';
const TOP = 25;

// ---------------------------------------------------------------------------------------------
// Oracle Database API for MongoDB support matrix (subset relevant to a MERN workload).
// 'since' is the first Oracle release that supports the feature; null = not supported.
// ---------------------------------------------------------------------------------------------
const SUPPORT = {
  stage: {
    $addFields: ['26ai', 'alias $set'],
    $bucket: ['26ai', ''],
    $bucketAuto: ['26ai', ''],
    $collStats: ['19c', ''],
    $count: ['19c', ''],
    $documents: ['26ai', ''],
    $facet: ['26ai', ''],
    $graphLookup: ['26ai', ''],
    $group: ['26ai', ''],
    $indexStats: ['26ai', ''],
    $limit: ['19c', ''],
    $lookup: ['26ai', 'acl/array localField raise an error; `let` unsupported'],
    $match: ['19c', ''],
    $merge: ['26ai', ''],
    $out: ['26ai', ''],
    $project: ['19c', ''],
    $replaceRoot: ['26ai', ''],
    $replaceWith: ['26ai', ''],
    $sample: ['26ai', ''],
    $set: ['26ai', ''],
    $skip: ['19c', ''],
    $sort: ['19c', ''],
    $sortByCount: ['26ai', ''],
    $sql: ['19c', 'Oracle extension: run SQL/PL-SQL from a pipeline'],
    $unionWith: ['26ai', ''],
    $unset: ['19c', ''],
    $unwind: ['26ai', ''],
    $changeStream: ['26ai', 'preview'],
    $search: ['26ai', 'preview'],
    $vectorSearch: ['26ai', 'preview'],
    $currentOp: [null, 'not supported'],
    $geoNear: [null, 'not supported'],
    $listLocalSessions: [null, 'not supported'],
    $listSessions: [null, 'not supported'],
    $planCacheStats: [null, 'not supported'],
    $redact: [null, 'not supported'],
    $setWindowFields: [null, 'not supported']
  },
  query: {
    $all: ['19c', ''], $elemMatch: ['19c', ''], $size: ['19c', ''],
    $eq: ['19c', ''], $gt: ['19c', ''], $gte: ['19c', ''], $lt: ['19c', ''],
    $lte: ['19c', ''], $ne: ['19c', ''], $in: ['19c', ''], $nin: ['19c', ''],
    $exists: ['19c', ''], $type: ['19c', ''],
    $and: ['19c', ''], $nor: ['19c', ''], $not: ['19c', ''], $or: ['19c', ''],
    $regex: ['19c', ''], $text: ['19c', ''],
    $options: ['19c', 'modifier of $regex - documented as supported, but IGNORED next to a $regex in a find filter on the live API; put the flags on the pattern'],
    $expr: ['26ai', ''], $mod: ['26ai', ''],
    $jsonSchema: [null, 'not supported - use the JSON validity views instead'],
    $where: [null, 'not supported - server-side JavaScript is deprecated']
  },
  update: {
    $set: ['19c', ''], $unset: ['19c', ''], $inc: ['19c', ''], $mul: ['19c', ''],
    $min: ['19c', ''], $max: ['19c', ''], $rename: ['19c', ''], $setOnInsert: ['19c', ''],
    $currentDate: ['19c', ''], $bit: ['19c', ''],
    $push: ['19c', ''], $pop: ['19c', ''], $pull: ['19c', ''], $pullAll: ['19c', ''],
    $addToSet: ['19c', ''],
    $each: ['19c', ''], $position: ['19c', ''], $slice: ['19c', ''], $sort: ['19c', ''],
    $: ['19c', 'positional'], '$[]': ['19c', 'all positional'], '$[<identifier>]': ['19c', 'filtered positional']
  },
  expression: {
    $sum: ['26ai', 'accumulator'], $avg: ['26ai', 'accumulator'], $min: ['26ai', 'accumulator'],
    $max: ['26ai', 'accumulator'], $push: ['26ai', 'accumulator'], $addToSet: ['26ai', 'accumulator'],
    $count: ['26ai', 'accumulator'], $first: ['26ai', 'accumulator'], $last: ['26ai', 'accumulator'],
    $stdDevPop: ['26ai', 'accumulator'], $stdDevSamp: ['26ai', 'accumulator'],
    $size: ['26ai', ''], $arrayElemAt: ['26ai', ''], $concatArrays: ['26ai', ''], $filter: ['26ai', ''],
    $map: ['26ai', ''], $reduce: ['26ai', ''], $in: ['26ai', ''], $isArray: ['26ai', ''],
    $add: ['26ai', ''], $subtract: ['26ai', ''], $multiply: ['26ai', ''], $divide: ['26ai', ''],
    $mod: ['26ai', ''], $round: ['26ai', ''], $abs: ['26ai', ''],
    $cond: ['26ai', ''], $ifNull: ['26ai', ''], $switch: ['26ai', ''],
    $eq: ['26ai', ''], $ne: ['26ai', ''], $gt: ['26ai', ''], $gte: ['26ai', ''],
    $lt: ['26ai', ''], $lte: ['26ai', ''], $cmp: ['26ai', ''],
    $and: ['26ai', ''], $or: ['26ai', ''], $not: ['26ai', ''],
    $literal: ['26ai', ''], $mergeObjects: ['26ai', ''], $objectToArray: ['26ai', ''],
    $toLower: ['26ai', ''], $toUpper: ['26ai', ''], $concat: ['26ai', ''], $split: ['26ai', ''],
    $trim: ['19c', ''],
    $toInt: ['26ai', ''], $toDouble: ['26ai', ''], $toString: ['26ai', ''], $toObjectId: ['26ai', ''],
    $type: ['26ai', ''], $convert: ['26ai', ''],
    $dateToString: ['26ai', ''], $dateAdd: ['26ai', ''], $dateDiff: ['26ai', ''],
    $year: ['26ai', ''], $month: ['26ai', ''], $dayOfMonth: ['26ai', ''],
    $let: ['26ai', ''], $getField: ['26ai', ''],
    $$ROOT: ['26ai', ''], $$CURRENT: ['26ai', ''],
    $substr: [null, 'not supported - use $substrCP or $substrBytes'], $strLenCP: [null, 'not supported'],
    $regexFind: [null, 'not supported'], $regexFindAll: [null, 'not supported'],
    $firstN: [null, 'not supported'], $lastN: [null, 'not supported'], $maxN: [null, 'not supported'],
    $function: [null, 'not supported - server-side JavaScript is deprecated'],
    $accumulator: [null, 'not supported - server-side JavaScript is deprecated']
  }
};

function hr(title) {
  print('');
  print('== ' + title + ' ' + '='.repeat(Math.max(0, 74 - title.length)));
}

function pad(v, n) {
  const s = String(v);
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

// mongosh renders int64 as a Long object ({low, high, unsigned}); print plain numbers.
function num(v) {
  if (v && typeof v === 'object' && typeof v.low === 'number') return v.low + (v.high || 0) * 4294967296;
  return typeof v === 'number' ? v : 0;
}

function counters(obj) {
  const out = [];
  for (const k of Object.keys(obj)) out.push(k + '=' + num(obj[k]));
  return '{' + out.join(', ') + '}';
}

function collectKeys(obj, out, depth) {
  depth = depth || 0;
  if (depth > 8 || obj === null || typeof obj !== 'object') return out;
  const keys = Array.isArray(obj) ? obj : Object.keys(obj);
  if (Array.isArray(obj)) {
    for (const item of obj) collectKeys(item, out, depth + 1);
    return out;
  }
  for (const k of keys) {
    const v = obj[k];
    if (typeof k === 'string' && k.charAt(0) === '$') {
      out[k] = (out[k] || 0) + 1;
      // operator payloads (e.g. {$cond: [...]}) may nest further operators
      collectKeys(v, out, depth + 1);
    } else if (Array.isArray(v)) {
      // {price: {$gte: 1}} / {_id: {$in: [...]}} - keep walking plain field names
      collectKeys(v, out, depth + 1);
    } else if (v && typeof v === 'object') {
      collectKeys(v, out, depth + 1);
    }
  }
  return out;
}

function supportLine(kind, op, count) {
  const entry = SUPPORT[kind][op];
  const since = entry ? entry[0] : null;
  const note = entry ? entry[1] : 'not in the matrix subset';
  if (!entry || !since) {
    return '[!!] ' + pad(op, 18) + pad(count, 7) + 'NOT SUPPORTED' + (note ? ' (' + note + ')' : '');
  }
  return '[ok] ' + pad(op, 18) + pad(count, 7) + 'supported since ' + since + (note ? ' (' + note + ')' : '');
}

// ---------------------------------------------------------------------------------------------
function status() {
  const s = db.serverStatus();
  hr('db.serverStatus() - ' + db.getName());
  print('version            : ' + s.version);
  print('host / process     : ' + s.host + ' / ' + s.process);
  print('uptime             : ' + s.uptime + ' s');
  print('connections        : current ' + s.connections.current +
        ', available ' + s.connections.available +
        ', totalCreated ' + s.connections.totalCreated);
  print('storageEngine      : ' + (s.storageEngine && s.storageEngine.name));
  print('opcounters         : ' + counters(s.opcounters));
  print('opcountersRepl     : ' + counters(s.opcountersRepl));
  print('network bytes      : in ' + num(s.network.bytesIn) + ', out ' + num(s.network.bytesOut) +
        ', requests ' + num(s.network.numRequests));
  print('mem resident       : ' + s.mem.resident + ' MB');

  hr('collections in ' + db.getName());
  const cols = db.getCollectionNames().filter(function (n) { return !/^system\./.test(n); }).sort();
  const counts = {};
  let total = 0;
  for (const c of cols) {
    const n = db.getCollection(c).countDocuments({});
    counts[c] = n;
    total += n;
    print(pad(c, 22) + n);
  }
  print(pad('TOTAL', 22) + total + '  (' + cols.length + ' collections)');

  hr('profiler');
  const st = db.getProfilingStatus();
  print('profiling level    : ' + st.was + (st.slowms !== undefined ? ' (slowms ' + st.slowms + ')' : ''));
  print('');
  print(MODE === 'status'
    ? 'next: ASSESS_MODE=start ... --file scripts/assess_workload.js'
    : 'next: ASSESS_MODE=report ... --file scripts/assess_workload.js');
  return counts;
}

// ---------------------------------------------------------------------------------------------
function start() {
  const before = db.getProfilingStatus();
  print('profiling level before : ' + before.was);
  // Start from a clean, empty system.profile. The collection cannot be written to (or truncated)
  // by a client - mongod answers "cannot write to <db>.system.profile" - so switch profiling off,
  // let mongod recreate the collection, then switch it on again.
  db.setProfilingLevel(0);
  try {
    db.getCollection('system.profile').drop();
    print('dropped the previous system.profile');
  } catch (e) {
    print('no previous system.profile to drop (' + e.message + ')');
  }
  const r = db.setProfilingLevel(2); // mongod creates the capped system.profile itself
  const after = db.getProfilingStatus();
  print('system.profile exists  : ' + (db.getCollectionNames().indexOf('system.profile') !== -1));
  print('profiling level now    : ' + after.was + (after.slowms !== undefined ? ' (slowms ' + after.slowms + ')' : ''));
  print('');
  print('Profiling every operation. Drive application traffic now, e.g.');
  print('  bash _scratch/planning/traffic-readonly.sh http://127.0.0.1:3001 3');
  print('then summarise (and switch profiling off) with ASSESS_MODE=report.');
  return r;
}

// ---------------------------------------------------------------------------------------------
function report() {
  // Stop profiling first: the summary must be stable, and profiling must never be left on.
  const before = db.getProfilingStatus();
  db.setProfilingLevel(0);
  const after = db.getProfilingStatus();
  hr('profiling');
  print('level before : ' + before.was + '  ->  level now : ' + after.was);

  const prof = db.getCollection('system.profile');
  let total = 0;
  try {
    total = prof.countDocuments({});
  } catch (e) {
    print('system.profile does not exist - run ASSESS_MODE=start, drive traffic, then re-run.');
    return;
  }
  if (total === 0) {
    print('system.profile is empty - no traffic was recorded between start and report.');
    return;
  }

  hr('operations by type and collection (' + total + ' entries)');
  const byOp = prof.aggregate([
    { $group: { _id: { op: '$op', ns: '$ns' }, n: { $sum: 1 }, ms: { $sum: '$millis' } } },
    { $sort: { n: -1 } }
  ]).toArray();
  print(pad('op', 12) + pad('namespace', 34) + pad('count', 8) + 'millis');
  for (const row of byOp.slice(0, TOP)) {
    print(pad(row._id.op, 12) + pad(row._id.ns || '(none)', 34) + pad(row.n, 8) + (row.ms || 0));
  }

  const ops = {};
  for (const row of byOp) ops[row._id.op] = (ops[row._id.op] || 0) + row.n;
  hr('operations, total by type');
  for (const k of Object.keys(ops).sort(function (a, b) { return ops[b] - ops[a]; })) {
    print(pad(k, 12) + ops[k]);
  }

  const docs = prof.find({}).sort({ ts: -1 }).limit(5000).toArray();

  const stages = {};
  const queries = {};
  const updates = {};
  const exprs = {};
  let aggregates = 0;
  let finds = 0;
  let lookups = 0;
  let sqlStages = 0;

  // Walk a pipeline (or a $lookup sub-pipeline): stage names are counted in `stages`, $match
  // payloads are query operators, everything else inside a stage payload is an expression.
  function route(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) { for (const item of obj) route(item); return; }
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (k === '$match') { collectKeys(v, queries); continue; }
      if (k.startsWith('$')) { exprs[k] = (exprs[k] || 0) + 1; route(v); }
      else route(v);
    }
  }
  function routePipeline(pipeline) {
    if (!Array.isArray(pipeline)) return;
    for (const stage of pipeline) {
      if (!stage || typeof stage !== 'object') continue;
      const k = Object.keys(stage)[0];
      const v = stage[k];
      if (k === '$match') { collectKeys(v, queries); continue; }
      if (k === '$lookup' && v && Array.isArray(v.pipeline)) { routePipeline(v.pipeline); continue; }
      route(v); // the stage name itself is already counted in `stages`
    }
  }

  for (const d of docs) {
    const c = d.command;
    if (!c) continue;
    if (c.aggregate) {
      aggregates++;
      const pipeline = Array.isArray(c.pipeline) ? c.pipeline : [];
      for (const stage of pipeline) {
        if (!stage || typeof stage !== 'object') continue;
        const k = Object.keys(stage)[0];
        if (!k || k.charAt(0) !== '$') continue;
        stages[k] = (stages[k] || 0) + 1;
        if (k === '$lookup') lookups++;
        if (k === '$sql') sqlStages++;
      }
      routePipeline(pipeline);
      if (c.filter) collectKeys(c.filter, queries);
    }
    if (c.find) {
      finds++;
      if (c.filter) collectKeys(c.filter, queries);
    }
    if (Array.isArray(c.updates)) {
      for (const u of c.updates) {
        if (!u || !u.u || typeof u.u !== 'object') continue;
        for (const k of Object.keys(u.u)) {
          if (k.charAt(0) === '$') updates[k] = (updates[k] || 0) + 1;
        }
        collectKeys(u.u, updates);
      }
    }
  }

  hr('shapes observed (' + docs.length + ' of ' + total + ' entries analysed)');
  print('find           : ' + finds);
  print('aggregate      : ' + aggregates + ' (pipelines with $lookup: ' + lookups +
        ', with $sql: ' + sqlStages + ')');

  function table(title, map, kind) {
    hr(title);
    const keys = Object.keys(map).sort(function (a, b) { return map[b] - map[a]; });
    if (!keys.length) { print('(none observed)'); return keys; }
    for (const k of keys) print(supportLine(kind, k, map[k]));
    return keys;
  }
  const stageKeys = table('aggregation stages (vs Oracle support matrix)', stages, 'stage');
  const qKeys = table('query operators in find/aggregate filters (vs Oracle support matrix)', queries, 'query');
  const uKeys = table('update operators (vs Oracle support matrix)', updates, 'update');
  const exprKeys = table('aggregation expressions (vs Oracle support matrix)', exprs, 'expression');

  // Targeted compatibility check: a BSON $regex paired with a separate $options field.
  // Oracle documents $options as supported, but the live API ignores it inside a find filter, which
  // silently turns a case-insensitive match into a case-sensitive one. Measured on this instance:
  //   {name:{$regex:/mug/, $options:'is'}} -> 0 documents on Oracle, 3 on MongoDB 8.0
  //   {name:{$regex:/mug/i}}               -> 3 on both
  const regexOptions = {};
  function scanFilter(filter) {
    if (!filter || typeof filter !== 'object' || Array.isArray(filter)) return;
    for (const field of Object.keys(filter)) {
      const v = filter[field];
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
      if (v.$regex !== undefined && v.$options !== undefined) {
        regexOptions[field] = (regexOptions[field] || 0) + 1;
      } else {
        scanFilter(v); // $and / $or / $not / nested field objects
      }
    }
  }
  for (const d of docs) {
    if (!d.command) continue;
    // find uses `filter`; count/delete/update share the `query` field
    if (d.command.filter) scanFilter(d.command.filter);
    if (d.command.query) scanFilter(d.command.query);
  }
  hr('targeted compatibility check: $regex with a separate $options');
  const regexOptionsFields = Object.keys(regexOptions);
  if (!regexOptionsFields.length) {
    print('(not observed - every regex carries its flags on the pattern)');
  } else {
    for (const field of regexOptionsFields) {
      print('[!!] find filter on "' + field + '": ' + regexOptions[field] +
            ' occurrence(s) of {$regex: …, $options: …}');
    }
    print('     The Oracle Database API for MongoDB IGNORES the separate $options field in find');
    print('     filters, so the match becomes case-sensitive (0 rows instead of 3 for "mug").');
    print('     Put the flags on the pattern: new RegExp(escapeRegex(term), \'i\')');
  }

  hr('verdict');
  let missing = [];
  function check(keys, kind) {
    for (const k of keys) {
      const e = SUPPORT[kind][k];
      if (!e || !e[0]) missing.push(kind + ' ' + k + (e ? ' - ' + e[1] : ''));
    }
  }
  check(stageKeys, 'stage'); check(qKeys, 'query'); check(uKeys, 'update'); check(exprKeys, 'expression');
  for (const field of regexOptionsFields) {
    missing.push('found {$regex, $options} on "' + field + '" - rewrite as new RegExp(escapeRegex(x), \'i\')');
  }
  if (missing.length) {
    print('UNSUPPORTED / INCOMPATIBLE constructs observed:');
    for (const m of missing) print('  !! ' + m);
  } else {
    print('every stage, query operator, update operator and expression observed is supported ' +
          'by the Oracle Database API for MongoDB (see the sources at the top of this file).');
  }
  print('');
  print('profiling is off (level ' + db.getProfilingStatus().was + ').');
}

if (MODE === 'start') start();
else if (MODE === 'report') report();
else status();
