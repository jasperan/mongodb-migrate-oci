import { Database, Play } from 'lucide-react'
import { Badge, StatusDot } from '../../components/ui/Display'
import { useCollectionsQuery } from '../../features/support/supportApi'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { AskDatabase } from './admin-db/AskDatabase'
import { DualityViews } from './admin-db/DualityViews'
import { JsonCollections } from './admin-db/JsonCollections'
import { MigrationSummary } from './admin-db/MigrationSummary'
import { ValidityReport } from './admin-db/ValidityReport'
import { VectorSearch } from './admin-db/VectorSearch'
import { ViewsCatalogue } from './admin-db/ViewsCatalogue'
import { usePanel } from './admin-db/usePanel'

export default function AdminDb() {
  useDocumentTitle('Database showcase')

  // The collections request also says whether SQL access exists at all; without
  // it the Oracle-backed panels would only repeat the same error.
  const collections = usePanel(useCollectionsQuery)
  const sqlMissing = collections.data?.oracleStatus === 'not-configured'

  return (
    <div className="container-page space-y-6 pt-8 pb-8 lg:pt-10 lg:pb-12">
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

      {sqlMissing ? (
        <>
          <p className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3.5 text-sm text-amber-700" role="status">
            <Database size={17} className="mt-0.5 shrink-0" />
            <span>
              <span className="font-semibold">Oracle SQL access is not configured.</span> This API only serves the
              MongoDB side. Set ORACLE_APP_USER, ORACLE_APP_PASSWORD and ORACLE_CONNECT_STRING in server/.env to enable
              the migration comparison, views, duality views, validity report and AI panels.
            </span>
          </p>
          <JsonCollections panel={collections} />
        </>
      ) : (
        <>
          <MigrationSummary />
          <JsonCollections panel={collections} />
          <ViewsCatalogue />
          <DualityViews />
          <ValidityReport />
          <VectorSearch />
          <AskDatabase />
        </>
      )}

      <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-ink-200 bg-white px-4 py-3 text-xs text-ink-500">
        <StatusDot ok label="MongoDB API compatible" />
        <StatusDot ok label="JSON-relational duality" />
        <StatusDot ok label="In-database AI" />
        <span className="ml-auto flex items-center gap-2">
          <Play size={12} /> live from Oracle 26ai
        </span>
      </footer>
    </div>
  )
}
