import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeftRight,
  Binoculars,
  CheckCircle2,
  Database,
  FileJson,
  GitMerge,
  Layers,
  Loader2,
  MessageSquareCode,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Table2,
  Wand2
} from 'lucide-react'
import clsx from 'clsx'
import { Badge, EmptyState, LoadingBlock, Spinner, StatusDot } from '../../components/ui/Display'
import { Button } from '../../components/ui/Button'
import { Textarea } from '../../components/ui/Field'
import { StatTile } from '../../components/support/StatTile'
import { DataTable } from '../../components/support/DataTable'
import { ErrorNotice, MatchBadge, SectionCard, describeApiError } from '../../components/support/Panel'
import { dateTime } from '../../lib/format'
import {
  useAskDatabaseMutation,
  useDatabaseViewsQuery,
  useDualityViewsQuery,
  useMongoCollectionCountQuery,
  useMongoCollectionsQuery,
  useMigrationStatusQuery,
  useOracleCollectionCountQuery,
  useOracleCollectionsQuery,
  useSimilarProductsMutation,
  useValidityReportQuery
} from '../../features/support/supportApi'

/* ------------------------------------------------------------------ *
 * The showcase endpoints are new; normalise their payloads defensively
 * so a slightly different envelope degrades instead of crashing.
 * ------------------------------------------------------------------ */

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const asArray = (value) => (Array.isArray(value) ? value : [])

const num = (value) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const pick = (object, keys) => {
  if (!isObject(object)) return undefined
  for (const key of keys) {
    const value = object[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

const listFrom = (data, keys) => {
  if (Array.isArray(data)) return data
  if (isObject(data)) {
    for (const key of keys) if (Array.isArray(data[key])) return data[key]
  }
  return []
}

const sumBy = (rows, key) => {
  let total = 0
  let found = false
  for (const row of rows) {
    if (typeof row[key] === 'number') {
      total += row[key]
      found = true
    }
  }
  return found ? total : null
}

const MATCH_WORDS = ['match', 'matched', 'ok', 'true', 'yes', 'valid', 'pass', 'passed', 'in-sync', 'synced']
const MISMATCH_WORDS = ['mismatch', 'mismatched', 'fail', 'failed', 'false', 'no', 'invalid', 'error', 'drift']

const normalizeStatus = (value, source, target) => {
  if (value !== undefined && value !== null && value !== '') {
    const text = String(value).toLowerCase()
    if (MATCH_WORDS.includes(text)) return 'MATCH'
    if (MISMATCH_WORDS.includes(text)) return 'MISMATCH'
    return String(value).toUpperCase()
  }
  if (source === null || target === null) return 'UNKNOWN'
  return source === target ? 'MATCH' : 'MISMATCH'
}

const NAME_KEYS = ['name', 'collection', 'collectionName', 'collection_name', 'table', 'tableName', 'table_name', 'view', 'viewName', 'view_name', 'objectName', 'object_name', 'label']

function readMigration(data) {
  const rows = listFrom(data, ['comparisons', 'collections', 'tables', 'details', 'items', 'results', 'comparison', 'status'])
  const table = rows.map((row, index) => {
    if (typeof row === 'string') return { name: row, source: null, target: null, status: 'UNKNOWN' }
    if (!isObject(row)) return { name: `collection-${index + 1}`, source: null, target: null, status: 'UNKNOWN' }
    const name = String(pick(row, NAME_KEYS) ?? `collection-${index + 1}`)
    const source =
      num(pick(row, ['sourceCount', 'source_count', 'sourceDocuments', 'source_documents', 'sourceDocCount', 'mongoCount', 'mongo_count', 'mongoDocuments'])) ??
      (typeof row.source === 'number' ? row.source : null)
    const target =
      num(pick(row, ['targetCount', 'target_count', 'targetDocuments', 'target_documents', 'targetDocCount', 'oracleCount', 'oracle_count', 'oracleDocuments'])) ??
      (typeof row.target === 'number' ? row.target : null)
    return {
      name,
      source,
      target,
      status: normalizeStatus(pick(row, ['status', 'match', 'result', 'state', 'outcome']), source, target)
    }
  })

  const summary = isObject(data) && isObject(data.summary) ? data.summary : isObject(data) ? data : {}
  const sourceDocuments = num(pick(summary, ['sourceDocuments', 'source_documents', 'mongoDocuments', 'mongo_documents'])) ?? sumBy(table, 'source')
  const targetDocuments = num(pick(summary, ['targetDocuments', 'target_documents', 'oracleDocuments', 'oracle_documents'])) ?? sumBy(table, 'target')

  return {
    table,
    sourceLabel: pick(summary, ['sourceLabel', 'source_label']) ?? 'Source',
    targetLabel: pick(summary, ['targetLabel', 'target_label']) ?? 'Target',
    generatedAt: pick(summary, ['generatedAt', 'generated_at']) ?? null,
    reportPath: pick(summary, ['reportPath', 'report_path']) ?? null,
    verified: pick(summary, ['verified']) ?? null,
    embeddingModel: pick(summary, ['embeddingModel', 'embedding_model']) ?? null,
    embeddingDimension: num(pick(summary, ['embeddingDimension', 'embedding_dimension'])),
    sourceCollections: num(pick(summary, ['sourceCollections', 'source_collections', 'mongoCollections', 'mongo_collections'])) ?? (table.length || null),
    targetCollections: num(pick(summary, ['targetCollections', 'target_collections', 'oracleCollections', 'oracle_collections'])) ?? (table.length || null),
    sourceDocuments,
    targetDocuments,
    mismatches: table.filter((row) => row.status === 'MISMATCH').length,
    unknown: table.filter((row) => row.status === 'UNKNOWN').length
  }
}

const KNOWN_RELATIONAL = [
  'PRODUCT_CATALOG',
  'ACTIVE_PRODUCTS_OVER_50',
  'ACTIVE_NONTAXABLE_PRODUCTS',
  'PRODUCT_REVIEW_STATS',
  'ORDER_SUMMARY'
]

function readViews(data) {
  const items = []
  const push = (list, kind) => {
    asArray(list).forEach((item, index) => {
      if (typeof item === 'string') {
        items.push({ name: item, kind, meta: null })
        return
      }
      if (!isObject(item)) return
      const name = String(pick(item, NAME_KEYS) ?? `view-${index + 1}`)
      const declared = kind || String(pick(item, ['kind', 'type', 'viewType', 'view_type', 'objectType', 'object_type', 'collectionType', 'collection_type']) ?? '')
      items.push({ name, kind: declared.toLowerCase(), meta: item })
    })
  }

  if (Array.isArray(data)) {
    push(data, '')
  } else if (isObject(data)) {
    push(data.relationalViews ?? data.relational_views ?? data.relational ?? data.relationalViewsList, 'relational')
    push(
      data.jsonCollectionViews ??
        data.json_collection_views ??
        data.jsonViews ??
        data.json_views ??
        data.collectionViews ??
        data.documentViews ??
        data.jsonCollections ??
        data.json_collections,
      'json'
    )
    push(data.dualityViews ?? data.duality_views, 'duality')
    if (items.length === 0) push(listFrom(data, ['views', 'items', 'objects', 'results', 'tables', 'collections']), '')
  }

  const groups = { relational: [], json: [], duality: [], validity: [], other: [] }
  for (const item of items) {
    const kind = item.kind
    if (kind.includes('duality')) groups.duality.push(item)
    else if (kind.includes('validity')) groups.validity.push(item)
    else if (kind.includes('json') || kind.includes('collection') || kind.includes('document')) groups.json.push(item)
    else if (kind.includes('relation') || kind.includes('table') || kind.includes('sql')) groups.relational.push(item)
    else if (/validity|_schema/i.test(item.name)) groups.validity.push(item)
    else if (KNOWN_RELATIONAL.includes(item.name.toUpperCase())) groups.relational.push(item)
    else if (/enrich/i.test(item.name)) groups.json.push(item)
    else groups.other.push(item)
  }
  return groups
}

function readDuality(data) {
  const rows = listFrom(data, ['dualityViews', 'duality_views', 'views', 'collections', 'items', 'results', 'tables'])
  return {
    schema: pick(data, ['schema', 'targetSchema', 'target_schema']) ?? null,
    total: num(pick(data, ['count', 'total', 'documents'])) ?? null,
    source: pick(data, ['source', 'method']) ?? null,
    rows: rows.map((row, index) => {
      if (typeof row === 'string') return { name: row, count: null, sourceDocuments: null, pending: null, stale: null, inSync: null, status: null }
      if (!isObject(row)) return { name: `view-${index + 1}`, count: null, sourceDocuments: null, pending: null, stale: null, inSync: null, status: null }
      const count = num(pick(row, ['count', 'documents', 'documentCount', 'document_count', 'rows', 'rowCount', 'row_count', 'total', 'totalDocuments']))
      const sourceDocuments = num(
        pick(row, ['collectionDocuments', 'collection_documents', 'sourceDocuments', 'source_documents', 'sourceCount', 'source_count'])
      )
      const pending = num(pick(row, ['pending', 'pendingDocuments', 'pending_documents']))
      const stale = num(pick(row, ['stale', 'staleDocuments', 'stale_documents']))
      const inSync = pick(row, ['inSync', 'in_sync'])
      return {
        name: String(pick(row, NAME_KEYS) ?? `view-${index + 1}`),
        count,
        sourceDocuments,
        pending,
        stale,
        inSync: typeof inSync === 'boolean' ? inSync : pending !== null && stale !== null ? pending === 0 && stale === 0 : null,
        status: pick(row, ['status', 'state', 'updatable', 'isUpdatable', 'valid']) ?? null
      }
    })
  }
}

function readValidity(data) {
  const rows = listFrom(data, ['collections', 'validity', 'items', 'results', 'tables', 'report'])
  const samples = []

  const table = rows.map((row, index) => {
    if (typeof row === 'string') return { name: row, documents: null, valid: null, invalid: null }
    if (!isObject(row)) return { name: `collection-${index + 1}`, documents: null, valid: null, invalid: null }

    const name = String(pick(row, NAME_KEYS) ?? `collection-${index + 1}`)
    const documents = num(pick(row, ['documents', 'documentCount', 'document_count', 'count', 'total', 'totalDocuments', 'total_documents']))
    const valid = num(pick(row, ['valid', 'validDocuments', 'valid_documents', 'validCount', 'valid_count', 'ok']))
    let invalid = num(pick(row, ['invalid', 'invalidDocuments', 'invalid_documents', 'invalidCount', 'invalid_count', 'failed']))

    const invalidList = row.invalidDocuments ?? row.invalid_documents ?? row.invalid ?? row.samples ?? row.drift
    if (Array.isArray(invalidList) && invalidList.length > 0 && typeof invalidList[0] !== 'number') {
      invalidList.forEach((entry) => {
        if (isObject(entry)) {
          samples.push({
            collection: name,
            docId: String(pick(entry, ['docId', 'doc_id', 'id', '_id', 'documentId', 'document_id']) ?? '—'),
            report: pick(entry, ['report', 'message', 'error', 'reason', 'details', 'validate_report']) ?? ''
          })
        } else {
          samples.push({ collection: name, docId: String(entry), report: '' })
        }
      })
      if (invalid === null) invalid = invalidList.length
    }

    if (invalid === null && documents !== null && valid !== null) invalid = Math.max(documents - valid, 0)
    return { name, documents, valid, invalid }
  })

  listFrom(data, ['invalidSamples', 'invalid_samples', 'samples', 'drift', 'invalidDocuments', 'invalid_documents', 'drifted']).forEach((entry) => {
    if (isObject(entry)) {
      samples.push({
        collection: String(pick(entry, ['collection', 'collection_name', 'collectionName', 'name', 'table']) ?? '—'),
        docId: String(pick(entry, ['docId', 'doc_id', 'id', '_id', 'documentId', 'document_id']) ?? '—'),
        report: pick(entry, ['report', 'message', 'error', 'reason', 'details', 'validate_report']) ?? ''
      })
    } else {
      samples.push({ collection: '—', docId: String(entry), report: '' })
    }
  })

  const totals = {
    documents: sumBy(table, 'documents'),
    valid: sumBy(table, 'valid'),
    invalid: sumBy(table, 'invalid')
  }
  const inferredSchemas = listFrom(data, ['inferredSchemas', 'inferred_schemas', 'schemas']).map((entry) =>
    isObject(entry)
      ? {
          collection: String(pick(entry, ['collection', 'name', 'collection_name']) ?? '—'),
          characters: num(pick(entry, ['characters', 'chars', 'length', 'size']))
        }
      : { collection: String(entry), characters: null }
  )

  return { table, samples, totals, inferredSchemas, source: pick(data, ['source', 'method']) ?? null }
}

const renderReport = (value) => {
  if (value === null || value === undefined || value === '') return <span className="text-ink-400">—</span>
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/* ------------------------------------------------------------------ *
 * Small pieces
 * ------------------------------------------------------------------ */

// Counts arrive per collection; a dedicated component keeps the hook count
// stable regardless of how many collections the API returns.
function CollectionCount({ source, name }) {
  const mongo = useMongoCollectionCountQuery(name, { skip: source !== 'mongo' })
  const oracle = useOracleCollectionCountQuery(name, { skip: source !== 'oracle' })
  const query = source === 'mongo' ? mongo : oracle

  if (query.isLoading) return <span className="inline-block h-4 w-10 animate-pulse rounded bg-ink-200" />
  if (query.isError) {
    return (
      <span className="text-xs font-medium text-brand-600" title={describeApiError(query.error).message}>
        unavailable
      </span>
    )
  }
  const count = typeof query.data === 'number' ? query.data : query.data?.count ?? query.data?.documents ?? null
  return <span className="font-mono text-sm tabular-nums text-ink-900">{count ?? '—'}</span>
}

function CollectionList({ title, icon: Icon, query, source, tone }) {
  const items = asArray(query.data).map((entry) =>
    typeof entry === 'string'
      ? { name: entry, type: null }
      : { name: String(pick(entry, NAME_KEYS) ?? '—'), type: pick(entry, ['type', 'objectType', 'object_type', 'kind']) ?? null }
  )
  return (
    <div className="rounded-2xl border border-ink-200">
      <header className="flex items-center justify-between gap-2 border-b border-ink-100 px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink-800">
          <Icon size={15} className={tone === 'duality' ? 'text-duality-600' : 'text-brand-600'} />
          {title}
        </span>
        <Badge tone={tone}>{query.isSuccess ? `${items.length} collections` : '…'}</Badge>
      </header>

      <div className="p-2">
        {query.isLoading ? (
          <LoadingBlock label="Listing collections…" className="py-8" />
        ) : query.isError ? (
          <ErrorNotice error={query.error} title="Could not list collections" onRetry={query.refetch} className="m-2" />
        ) : items.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-ink-500">No collections reported.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {items.map((item) => (
              <li key={item.name} className="flex items-center justify-between gap-3 px-2 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-mono text-sm text-ink-700" title={item.name}>
                    {item.name}
                  </span>
                  {item.type && <Badge tone="neutral">{String(item.type).toLowerCase()}</Badge>}
                </span>
                <CollectionCount source={source} name={item.name} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ViewGroup({ title, icon: Icon, items, tone }) {
  return (
    <div className="rounded-2xl border border-ink-200">
      <header className="flex items-center justify-between gap-2 border-b border-ink-100 px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink-800">
          <Icon size={15} className={tone === 'duality' ? 'text-duality-600' : 'text-brand-600'} />
          {title}
        </span>
        <Badge tone={tone}>{items.length}</Badge>
      </header>
      <div className="p-2">
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-ink-500">Nothing reported in this group.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {items.map((item) => {
              const columns = num(pick(item.meta, ['columns', 'columnCount', 'column_count', 'fields', 'attributes']))
              const documents = num(pick(item.meta, ['documents', 'rows', 'count', 'rowCount', 'row_count']))
              return (
                <li key={item.name} className="flex items-center justify-between gap-3 px-2 py-2">
                  <span className="truncate font-mono text-xs text-ink-700" title={item.name}>
                    {item.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-3 text-xs text-ink-500">
                    {columns !== null && <span>{columns} columns</span>}
                    {documents !== null && <span className="tabular-nums">{documents} rows</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function ScoreBar({ score }) {
  const value = num(score)
  const ratio = value === null ? 0 : value > 1 ? Math.min(value / 100, 1) : Math.max(Math.min(value, 1), 0)
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-100" aria-hidden>
        <span className="block h-full rounded-full bg-duality-600" style={{ width: `${ratio * 100}%` }} />
      </span>
      <span className="font-mono text-xs tabular-nums text-ink-600">{value === null ? '—' : value.toFixed(3)}</span>
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export default function AdminDb() {
  const mongo = useMongoCollectionsQuery()
  const oracle = useOracleCollectionsQuery()
  const migration = useMigrationStatusQuery()
  const views = useDatabaseViewsQuery()
  const duality = useDualityViewsQuery()
  const validity = useValidityReportQuery()

  const [findSimilar, similarState] = useSimilarProductsMutation()
  const [askDatabase, askState] = useAskDatabaseMutation()

  const [searchText, setSearchText] = useState('')
  const [question, setQuestion] = useState('')

  const migrationData = useMemo(() => readMigration(migration.data), [migration.data])
  const viewGroups = useMemo(() => readViews(views.data), [views.data])
  const dualityData = useMemo(() => readDuality(duality.data), [duality.data])
  const validityData = useMemo(() => readValidity(validity.data), [validity.data])

  const similarResults = asArray(similarState.data?.results ?? similarState.data?.products ?? similarState.data)
  const askData = askState.data
  const askRows = asArray(askData?.rows)
  const askColumns = askRows.length > 0 && isObject(askRows[0]) ? Object.keys(askRows[0]).slice(0, 8) : []

  const runSimilar = (event) => {
    event.preventDefault()
    if (searchText.trim()) findSimilar(searchText.trim())
  }

  const runAsk = (event) => {
    event.preventDefault()
    if (question.trim()) askDatabase(question.trim())
  }

  return (
    <div className="container-page space-y-6 py-8 lg:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Oracle AI Database 26ai</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Migration &amp; database showcase</h1>
          <p className="mt-1.5 max-w-3xl text-sm text-ink-500">
            The same documents, read through four lenses: the MongoDB-compatible API, relational SQL views, updatable
            JSON-relational duality views and in-database AI. Collections are the live migrated store.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="duality">JSON + relational</Badge>
          <Badge tone="brand">vector search</Badge>
          <Badge tone="neutral">Select AI</Badge>
        </div>
      </header>

      {/* 1 — migration summary */}
      <SectionCard
        icon={ArrowLeftRight}
        title="Migration summary"
        subtitle="Source (MongoDB API) vs target (Oracle JSON collections), per collection"
        action={
          <Button variant="outline" size="sm" onClick={migration.refetch} loading={migration.isFetching}>
            Refresh
          </Button>
        }
      >
        {migration.isLoading ? (
          <LoadingBlock label="Comparing source and target…" />
        ) : migration.isError ? (
          <ErrorNotice error={migration.error} title="Migration status unavailable" onRetry={migration.refetch} />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <StatTile icon={Database} label={`Source collections`} value={migrationData.sourceCollections} tone="duality" hint={String(migrationData.sourceLabel)} />
              <StatTile icon={Database} label={`Target collections`} value={migrationData.targetCollections} tone="duality" hint={String(migrationData.targetLabel)} />
              <StatTile icon={FileJson} label="Source documents" value={migrationData.sourceDocuments} />
              <StatTile icon={FileJson} label="Target documents" value={migrationData.targetDocuments} />
              <StatTile
                icon={migrationData.mismatches > 0 ? AlertTriangle : CheckCircle2}
                label="Mismatched"
                value={migrationData.mismatches}
                hint={migrationData.unknown > 0 ? `${migrationData.unknown} undetermined` : 'counts compared per collection'}
                tone={migrationData.mismatches > 0 ? 'brand' : 'success'}
              />
            </div>

            <div className="mt-4">
              <DataTable
                rows={migrationData.table}
                rowKey={(row) => row.name}
                emptyLabel="The migration status endpoint reported no collections."
                columns={[
                  { key: 'name', header: 'Collection', render: (row) => <span className="font-mono text-xs">{row.name}</span> },
                  { key: 'source', header: `${migrationData.sourceLabel} docs`, align: 'right', render: (row) => row.source ?? '—' },
                  { key: 'target', header: `${migrationData.targetLabel} docs`, align: 'right', render: (row) => row.target ?? '—' },
                  {
                    key: 'delta',
                    header: 'Delta',
                    align: 'right',
                    render: (row) =>
                      row.source === null || row.target === null ? '—' : row.target - row.source
                  },
                  { key: 'status', header: 'Status', align: 'right', render: (row) => <MatchBadge status={row.status} /> }
                ]}
              />
              <p className="mt-2 text-xs text-ink-400">
                {migrationData.generatedAt ? `Verified ${dateTime(migrationData.generatedAt)} · ` : 'Live counts · '}
                {migrationData.reportPath ? `report ${migrationData.reportPath}` : 'no verification report on file'}
                {migrationData.unknown > 0 && ' · source counts unavailable for the source side'}
              </p>
            </div>
          </>
        )}
      </SectionCard>

      {/* 2 — JSON collections */}
      <SectionCard
        icon={Database}
        title="JSON collections"
        subtitle="Document counts on both sides of the migration"
        tone="duality"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              mongo.refetch()
              oracle.refetch()
            }}
            loading={mongo.isFetching || oracle.isFetching}
          >
            Refresh
          </Button>
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <CollectionList title="MongoDB API collections" icon={Database} query={mongo} source="mongo" tone="brand" />
          <CollectionList title="Oracle JSON collections" icon={FileJson} query={oracle} source="oracle" tone="duality" />
        </div>
      </SectionCard>

      {/* 3 — views */}
      <SectionCard
        icon={Layers}
        title="Views over the JSON store"
        subtitle="Relational SQL views for BI vs read-only JSON collection views for document clients"
        tone="duality"
        action={
          <Button variant="outline" size="sm" onClick={views.refetch} loading={views.isFetching}>
            Refresh
          </Button>
        }
      >
        {views.isLoading ? (
          <LoadingBlock label="Loading views…" />
        ) : views.isError ? (
          <ErrorNotice error={views.error} title="Could not load the view catalogue" onRetry={views.refetch} />
        ) : viewGroups.relational.length + viewGroups.json.length + viewGroups.duality.length + viewGroups.validity.length + viewGroups.other.length === 0 ? (
          <EmptyState icon={Layers} title="No views reported" description="The endpoint returned an empty catalogue." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <ViewGroup title="Relational views" icon={Table2} items={viewGroups.relational} tone="brand" />
            <ViewGroup title="JSON collection views" icon={FileJson} items={viewGroups.json} tone="duality" />
            <ViewGroup title="Validity views" icon={ShieldCheck} items={viewGroups.validity} tone="duality" />
            {viewGroups.duality.length > 0 && (
              <ViewGroup title="Duality views" icon={GitMerge} items={viewGroups.duality} tone="duality" />
            )}
            {viewGroups.other.length > 0 && <ViewGroup title="Other views" icon={Layers} items={viewGroups.other} tone="brand" />}
          </div>
        )}
      </SectionCard>

      {/* 4 — duality views */}
      <SectionCard
        icon={GitMerge}
        title="Duality views"
        subtitle="Updatable JSON-relational views, one per migrated collection, populated by the 26ai duality import"
        action={
          <Button variant="outline" size="sm" onClick={duality.refetch} loading={duality.isFetching}>
            Refresh
          </Button>
        }
      >
        {duality.isLoading ? (
          <LoadingBlock label="Loading duality views…" />
        ) : duality.isError ? (
          <ErrorNotice error={duality.error} title="Could not load duality views" onRetry={duality.refetch} />
        ) : (
          <>
            {dualityData.schema && (
              <p className="mb-3 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                <GitMerge size={13} className="text-duality-600" /> duality schema
                <span className="font-mono text-ink-700">{String(dualityData.schema)}</span>
                <Badge tone="duality">{dualityData.rows.length} views</Badge>
              </p>
            )}
            <DataTable
              rows={dualityData.rows}
              rowKey={(row) => row.name}
              emptyLabel="No duality views reported — the duality schema is generated but no view is exposed yet."
              columns={[
                { key: 'name', header: 'View', render: (row) => <span className="font-mono text-xs">{row.name}</span> },
                { key: 'count', header: 'In the view', align: 'right', render: (row) => row.count ?? '—' },
                { key: 'source', header: 'In the collection', align: 'right', render: (row) => row.sourceDocuments ?? '—' },
                {
                  key: 'sync',
                  header: 'Sync',
                  align: 'right',
                  render: (row) => {
                    if (row.inSync === null) return <Badge tone="neutral">snapshot</Badge>
                    if (row.inSync) return <Badge tone="success">in sync</Badge>
                    return (
                      <Badge tone="warning">
                        {[
                          row.pending ? `${row.pending} awaiting import` : null,
                          row.stale ? `${row.stale} removed` : null
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Badge>
                    )
                  }
                }
              ]}
            />
            {dualityData.rows.some((row) => row.inSync === false) && (
              <p className="mt-2 text-xs text-ink-400">
                Duality views are a point-in-time copy of the collections, filled by{' '}
                <span className="font-mono">DBMS_JSON_DUALITY.IMPORT_ALL</span>. Documents the application writes
                through the MongoDB API after that import show as <em>awaiting import</em> until the duality views are
                refreshed (<span className="font-mono">sql/26ai/06_import_duality_views.sql</span>).
              </p>
            )}
          </>
        )}
      </SectionCard>

      {/* 5 — validity */}
      <SectionCard
        icon={ShieldCheck}
        title="JSON validity report"
        subtitle="Every document validated against the schema inferred from its duality view"
        action={
          <Button variant="outline" size="sm" onClick={validity.refetch} loading={validity.isFetching}>
            Refresh
          </Button>
        }
      >
        {validity.isLoading ? (
          <LoadingBlock label="Validating documents…" />
        ) : validity.isError ? (
          <ErrorNotice error={validity.error} title="Validity report unavailable" onRetry={validity.refetch} />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile icon={FileJson} label="Documents checked" value={validityData.totals.documents} />
              <StatTile icon={CheckCircle2} label="Valid documents" value={validityData.totals.valid} tone="success" />
              <StatTile
                icon={AlertTriangle}
                label="Invalid documents"
                value={validityData.totals.invalid}
                tone={validityData.totals.invalid > 0 ? 'brand' : 'success'}
              />
              <StatTile
                icon={ShieldCheck}
                label="Schemas inferred"
                value={validityData.inferredSchemas.length || null}
                tone="duality"
              />
            </div>
            {validityData.source && (
              <p className="mt-2 font-mono text-xs text-ink-400">{String(validityData.source)}</p>
            )}

            <div className="mt-4">
              <DataTable
                rows={validityData.table}
                rowKey={(row) => row.name}
                emptyLabel="No validity rows reported."
                columns={[
                  { key: 'name', header: 'Collection', render: (row) => <span className="font-mono text-xs">{row.name}</span> },
                  { key: 'documents', header: 'Documents', align: 'right', render: (row) => row.documents ?? '—' },
                  { key: 'valid', header: 'Valid', align: 'right', render: (row) => row.valid ?? '—' },
                  {
                    key: 'invalid',
                    header: 'Invalid',
                    align: 'right',
                    render: (row) => (
                      <span className={clsx(row.invalid > 0 && 'font-semibold text-brand-600')}>{row.invalid ?? '—'}</span>
                    )
                  }
                ]}
              />
            </div>

            <div className="mt-4">
              <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-ink-800">
                <AlertTriangle size={15} className="text-amber-400" /> Drifted document samples
                {validityData.samples.length > 0 && <Badge tone="warning">{validityData.samples.length}</Badge>}
              </h3>
              <div className="mt-2">
                <DataTable
                  dense
                  rows={validityData.samples}
                  rowKey={(row, index) => `${row.collection}-${row.docId}-${index}`}
                  emptyLabel="Every document matches the inferred schema — no drift detected."
                  columns={[
                    { key: 'collection', header: 'Collection', render: (row) => <span className="font-mono text-xs">{row.collection || '—'}</span> },
                    { key: 'docId', header: 'Document', render: (row) => <span className="font-mono text-xs">{row.docId}</span> },
                    {
                      key: 'report',
                      header: 'Validation report',
                      render: (row) => (
                        <span className="line-clamp-2 block max-w-2xl text-xs text-ink-600" title={String(renderReport(row.report))}>
                          {renderReport(row.report)}
                        </span>
                      )
                    }
                  ]}
                />
              </div>
            </div>
          </>
        )}
      </SectionCard>

      {/* 6 — vector search */}
      <SectionCard
        icon={Binoculars}
        title="Vector search"
        subtitle="Semantic similarity over the migrated product descriptions (in-database embeddings)"
        tone="duality"
      >
        <form onSubmit={runSimilar} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="mb-1.5 block text-xs font-semibold tracking-wide text-ink-600 uppercase">
              Describe what you are looking for
            </span>
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="e.g. comfortable running shoes for long distances"
              className="w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-duality-500 focus:outline-none"
              aria-label="Vector search text"
            />
          </label>
          <Button type="submit" variant="duality" loading={similarState.isLoading} disabled={!searchText.trim()}>
            <Search size={15} /> Search
          </Button>
        </form>

        {migrationData.embeddingModel && (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-500">
            <Sparkles size={13} className="text-duality-600" /> embedding model
            <span className="font-mono text-ink-700">{String(migrationData.embeddingModel)}</span>
            {migrationData.embeddingDimension !== null && <Badge tone="duality">{migrationData.embeddingDimension}d</Badge>}
          </p>
        )}

        {similarState.isError && (
          <ErrorNotice
            className="mt-3"
            error={similarState.error}
            title="Vector search needs an embedding provider"
          />
        )}

        {similarState.isSuccess && (
          <div className="mt-4">
            {similarState.data?.model && (
              <p className="mb-2 flex items-center gap-2 text-xs text-ink-500">
                <Sparkles size={13} /> embedding model <span className="font-mono">{String(similarState.data.model)}</span>
              </p>
            )}
            {similarResults.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-500">
                No similar products matched that description.
              </p>
            ) : (
              <ul className="divide-y divide-ink-100 rounded-2xl border border-ink-200">
                {similarResults.slice(0, 12).map((result, index) => (
                  <li key={result?.id ?? index} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink-800">
                        {result?.name ?? result?.title ?? `Product ${result?.id ?? index + 1}`}
                      </span>
                      {result?.id && <span className="font-mono text-[11px] text-ink-400">{String(result.id)}</span>}
                    </span>
                    {result?.score !== undefined && <ScoreBar score={result.score} />}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </SectionCard>

      {/* 7 — ask the database */}
      <SectionCard
        icon={MessageSquareCode}
        title="Ask the database"
        subtitle="Natural language → SQL over the relational views (Oracle Select AI)"
        tone="duality"
      >
        <form onSubmit={runAsk} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="mb-1.5 block text-xs font-semibold tracking-wide text-ink-600 uppercase">Your question</span>
            <Textarea
              rows={2}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="e.g. Which five products have the highest average review rating?"
              className="resize-none"
              aria-label="Question for the database"
            />
          </label>
          <Button type="submit" variant="duality" loading={askState.isLoading} disabled={!question.trim()}>
            <Wand2 size={15} /> Ask
          </Button>
        </form>

        {askState.isError && (
          <ErrorNotice
            className="mt-3"
            error={askState.error}
            title={
              describeApiError(askState.error).status === 403
                ? 'Sign in as an administrator to run generated SQL'
                : 'Ask the database needs a Select AI profile'
            }
          />
        )}

        {askState.isSuccess && askData && (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-duality-100 bg-duality-50 px-4 py-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="eyebrow">Answer</span>
                {askData.provider && <Badge tone="duality">{String(askData.provider)}</Badge>}
              </div>
              <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-ink-800">
                {askData.answer ||
                  (Array.isArray(askData.rows)
                    ? `Generated SQL ran — ${askData.rows.length} row${askData.rows.length === 1 ? '' : 's'} returned below.`
                    : 'Select AI did not return an answer for this question.')}
              </p>
            </div>

            {askData.sql && (
              <div>
                <p className="eyebrow mb-1.5">Generated SQL</p>
                <pre className="overflow-x-auto rounded-xl bg-ink-950 px-4 py-3 font-mono text-xs leading-relaxed text-ink-100">
                  <code>{String(askData.sql)}</code>
                </pre>
              </div>
            )}

            <div>
              <p className="eyebrow mb-1.5">Rows {askRows.length > 0 && <span className="text-ink-400">({askRows.length})</span>}</p>
              <DataTable
                dense
                rows={askRows}
                emptyLabel="The query returned no rows."
                columns={
                  askColumns.length > 0
                    ? askColumns.map((key) => ({
                        key,
                        header: key,
                        render: (row) => {
                          const value = row[key]
                          if (value === null || value === undefined || value === '') return '—'
                          return typeof value === 'object' ? JSON.stringify(value) : String(value)
                        }
                      }))
                    : [{ key: 'value', header: 'Result', render: (row) => String(row) }]
                }
              />
            </div>
          </div>
        )}

        {askState.isLoading && (
          <p className="mt-3 flex items-center gap-2 text-sm text-ink-500">
            <Spinner className="size-4" /> Translating your question…
          </p>
        )}
      </SectionCard>

      <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-ink-200 bg-white px-4 py-3 text-xs text-ink-500">
        <StatusDot ok label="MongoDB API compatible" />
        <StatusDot ok label="JSON-relational duality" />
        <StatusDot ok label="In-database AI" />
        <span className="ml-auto flex items-center gap-2">
          {migration.isFetching || views.isFetching || duality.isFetching || validity.isFetching ? (
            <>
              <Loader2 size={13} className="animate-spin" /> refreshing
            </>
          ) : (
            <>
              <Play size={12} /> live from Oracle 26ai
            </>
          )}
        </span>
      </footer>
    </div>
  )
}
