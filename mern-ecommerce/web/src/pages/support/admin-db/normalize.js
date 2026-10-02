/**
 * Display models for the /api/admin-db and /api/ai payloads. Each reader is bound
 * to the documented response (docs/26ai/api-contract.md, sections 3.14 and 3.16):
 * a field is read under the one name the server sends it by, and a payload that
 * does not match fails loudly in the panel's error state instead of being guessed at.
 */

const MATCH_STATUS = { true: 'MATCH', false: 'MISMATCH' }

/** GET /admin-db/migration-status */
export function readMigration(data) {
  const rows = data.comparisons.map(({ collection, source, target, match }) => ({
    name: collection,
    source,
    target,
    status: MATCH_STATUS[match] ?? 'UNKNOWN'
  }))
  return {
    rows,
    sourceLabel: data.sourceLabel,
    targetLabel: data.targetLabel,
    generatedAt: data.generatedAt,
    reportFile: data.reportFile,
    verified: data.verified,
    // A collection counts on a side when that side reported a number for it.
    sourceCollections: rows.filter((row) => row.source !== null).length,
    targetCollections: rows.filter((row) => row.target !== null).length,
    targetViews: data.targetViews,
    sourceDocuments: data.sourceDocuments,
    targetDocuments: data.targetDocuments,
    mismatches: rows.filter((row) => row.status === 'MISMATCH').length,
    unknown: rows.filter((row) => row.status === 'UNKNOWN').length
  }
}

/** GET /admin-db/views: `kind` is relational | json-collection-view | validity. */
export function readViews(data) {
  const groups = { relational: [], json: [], validity: [] }
  for (const view of data.views) {
    if (view.kind === 'json-collection-view') groups.json.push(view)
    else if (view.kind === 'validity') groups.validity.push(view)
    else groups.relational.push(view)
  }
  return { ...groups, total: data.views.length }
}

/** GET /admin-db/validity */
export function readValidity(data) {
  const sum = (key) => data.collections.reduce((total, row) => total + row[key], 0)
  return {
    rows: data.collections,
    totals: { documents: sum('documents'), valid: sum('valid'), invalid: sum('invalid') },
    schemas: data.inferredSchemas.length,
    // Drift samples name the validity view they came from (PRODUCTS_VALIDITY -> products).
    samples: data.invalidDocuments.map(({ view, doc_id: docId, report }) => ({
      collection: view.replace(/_validity$/i, '').toLowerCase(),
      docId,
      report
    })),
    source: data.source
  }
}

/** The label the vector panel shows for the embedding path in GET /ai/status. */
export function embeddingModel(status) {
  const { inDatabaseModel, remoteModel, dimension } = status.embeddings
  const model = inDatabaseModel || remoteModel
  return model ? { model, dimension } : null
}
