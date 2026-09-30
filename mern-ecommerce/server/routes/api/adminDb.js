/**
 * Migration / 26ai showcase endpoints.
 *
 * `/collections/*`  - the MongoDB API collections (via mongoose) and the Oracle
 *                     JSON collections that back them (via SQL).
 * `/views`          - relational views and JSON collection views over the
 *                     migrated documents.
 * `/duality-views`  - JSON-relational duality views built from the collections.
 * `/validity`       - JSON schema validity report (DBMS_JSON_SCHEMA).
 * `/migration-status` - per-collection source vs target comparison, from the
 *                     report written by scripts/verify_migration.py.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const { query, isConfigured, schema } = require('../../services/oracle');
const vectorSearch = require('../../services/vectorSearch');

const router = express.Router();

const safeIdentifier = (name) => {
  if (!/^[A-Za-z0-9_$]{1,128}$/.test(String(name || ''))) {
    const error = new Error(`Invalid identifier: ${name}`);
    error.status = 400;
    throw error;
  }
  return name;
};

const handle = (fn) => async (req, res) => {
  try {
    const payload = await fn(req);
    res.json(payload);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

// ---------------------------------------------------------------- collections
router.get(
  '/collections/mongo',
  handle(async () => {
    const collections = await mongoose.connection.db.listCollections().toArray();
    return collections.map((collection) => collection.name);
  })
);

router.get(
  '/collections/mongo/:name/count',
  handle(async (req) => {
    const name = safeIdentifier(req.params.name);
    const count = await mongoose.connection.db.collection(name).countDocuments();
    return { collection: name, count };
  })
);

router.get(
  '/collections/oracle',
  handle(async () => {
    const rows = await query(
      `select collection_name, collection_type from user_json_collections order by collection_name`
    );
    return rows.map((row) => ({ name: row.COLLECTION_NAME, type: row.COLLECTION_TYPE }));
  })
);

router.get(
  '/collections/oracle/:name/count',
  handle(async (req) => {
    const name = safeIdentifier(req.params.name);
    const rows = await query(`select count(*) as documents from "${name}"`);
    return { collection: name, count: rows[0].DOCUMENTS };
  })
);

// ------------------------------------------------------------------- SQL views
router.get(
  '/views',
  handle(async () => {
    const collectionViews = await query(`select collection_name from user_json_collections where collection_type = 'VIEW'`);
    const collectionViewNames = new Set(collectionViews.map((row) => row.COLLECTION_NAME));

    const views = await query(`
      select v.view_name,
             (select count(*) from user_tab_columns c where c.table_name = v.view_name) as column_count
        from user_views v
       where v.view_name not in (
              select view_name from user_json_duality_views
             )
       order by v.view_name`);

    const result = [];
    for (const row of views) {
      let documents = null;
      try {
        const counted = await query(`select count(*) as documents from "${safeIdentifier(row.VIEW_NAME)}"`);
        documents = counted[0].DOCUMENTS;
      } catch {
        documents = null;
      }
      result.push({
        name: row.VIEW_NAME,
        kind: collectionViewNames.has(row.VIEW_NAME)
          ? 'json-collection-view'
          : /_VALIDITY$/.test(row.VIEW_NAME)
            ? 'validity'
            : 'relational',
        columns: row.COLUMN_COUNT,
        documents
      });
    }
    return { views: result, schema: schema.app };
  })
);

// -------------------------------------------------------------- duality views
router.get(
  '/duality-views',
  handle(async () => {
    const rows = await query(
      `select view_name, allow_insert, allow_update, allow_delete
         from ${safeIdentifier(schema.dv)}.duality_view_manifest
        order by view_name`
    );
    const views = [];
    for (const row of rows) {
      let documents = null;
      try {
        const counted = await query(`select count(*) as documents from ${safeIdentifier(schema.dv)}."${safeIdentifier(row.VIEW_NAME)}"`);
        documents = counted[0].DOCUMENTS;
      } catch {
        documents = null;
      }
      views.push({
        name: row.VIEW_NAME,
        source: `${schema.app}.${row.VIEW_NAME.replace(/_DV$/, '').toLowerCase()}`,
        documents
      });
    }
    return { views, schema: schema.dv };
  })
);

// ------------------------------------------------------------- validity report
router.get(
  '/validity',
  handle(async () => {
    const rollup = await query(
      `select collection_name, documents, valid_documents from document_validity order by collection_name`
    );
    const invalid = [];
    for (const view of ['products_validity', 'users_validity', 'orders_validity', 'carts_validity']) {
      const rows = await query(
        `select doc_id, report from ${view} where is_valid = 0 fetch first 5 rows only`
      ).catch(() => []);
      rows.forEach((row) => invalid.push({ view, doc_id: row.DOC_ID, report: row.REPORT }));
    }
    const schemas = await query(
      `select collection_name, dbms_lob.getlength(json_serialize(schema_json returning clob)) as schema_chars
         from json_schemas order by collection_name`
    ).catch(() => []);

    return {
      collections: rollup.map((row) => ({
        name: row.COLLECTION_NAME,
        documents: row.DOCUMENTS,
        valid: row.VALID_DOCUMENTS,
        invalid: row.DOCUMENTS - row.VALID_DOCUMENTS
      })),
      inferredSchemas: schemas.map((row) => ({ collection: row.COLLECTION_NAME, characters: row.SCHEMA_CHARS })),
      invalidDocuments: invalid,
      source: 'DBMS_JSON_SCHEMA.IS_VALID over schemas inferred from the duality views'
    };
  })
);

// ----------------------------------------------------------- migration status
const reportPaths = [
  process.env.MIGRATION_REPORT,
  path.resolve(__dirname, '../../../../docs/26ai/migration-report.json')
].filter(Boolean);

router.get(
  '/migration-status',
  handle(async () => {
    let report = null;
    let reportPath = null;
    for (const candidate of reportPaths) {
      if (fs.existsSync(candidate)) {
        report = JSON.parse(fs.readFileSync(candidate, 'utf8'));
        reportPath = candidate;
        break;
      }
    }

    // Only real collection tables take part in the comparison; JSON collection
    // views (read-only projections) are reported separately.
    const objects = await query(
      `select collection_name, collection_type from user_json_collections order by collection_name`
    );
    const targetCounts = {};
    const targetViews = [];
    for (const row of objects) {
      if (row.COLLECTION_TYPE === 'VIEW') {
        targetViews.push(row.COLLECTION_NAME);
        continue;
      }
      const counted = await query(`select count(*) as documents from "${safeIdentifier(row.COLLECTION_NAME)}"`);
      targetCounts[row.COLLECTION_NAME.toLowerCase()] = counted[0].DOCUMENTS;
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
      reportPath,
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
  })
);

module.exports = router;
