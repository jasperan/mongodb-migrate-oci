import { GitMerge } from 'lucide-react'
import { Badge } from '../../../components/ui/Display'
import { Button } from '../../../components/ui/Button'
import { DataTable } from '../../../components/support/DataTable'
import { SectionCard } from '../../../components/support/Panel'
import { useDualityViewsQuery } from '../../../features/support/supportApi'
import { QueryBoundary } from './QueryBoundary'
import { TableSkeleton } from './Skeletons'
import { usePanel } from './usePanel'

// `inSync` is null when the server could not read the view, which the page
// shows as a plain snapshot rather than a verdict.
function SyncBadge({ view }) {
  if (view.inSync === null) return <Badge tone="neutral">snapshot</Badge>
  if (view.inSync) return <Badge tone="success">in sync</Badge>
  return (
    <Badge tone="warning">
      {[view.pending ? `${view.pending} awaiting import` : null, view.stale ? `${view.stale} removed` : null]
        .filter(Boolean)
        .join(' · ')}
    </Badge>
  )
}

function Views({ data }) {
  return (
    <>
      <p className="mb-3 flex flex-wrap items-center gap-2 text-xs text-ink-500">
        <GitMerge size={13} className="text-duality-600" /> duality schema
        <span className="font-mono text-ink-700">{data.schema}</span>
        <Badge tone="duality">{data.views.length} views</Badge>
      </p>
      <DataTable
        rows={data.views}
        rowKey={(row) => row.name}
        emptyLabel="No duality views reported — the duality schema is generated but no view is exposed yet."
        columns={[
          { key: 'name', header: 'View', render: (row) => <span className="font-mono text-xs">{row.name}</span> },
          { key: 'documents', header: 'In the view', align: 'right', render: (row) => row.documents ?? '—' },
          { key: 'collectionDocuments', header: 'In the collection', align: 'right', render: (row) => row.collectionDocuments ?? '—' },
          { key: 'sync', header: 'Sync', align: 'right', render: (row) => <SyncBadge view={row} /> }
        ]}
      />
      {data.views.some((row) => row.inSync === false) && (
        <p className="mt-2 text-xs text-ink-400">
          Duality views are a point-in-time copy of the collections, filled by{' '}
          <span className="font-mono">DBMS_JSON_DUALITY.IMPORT_ALL</span>. Documents the application writes through the
          MongoDB API after that import show as <em>awaiting import</em> until the duality views are refreshed (
          <span className="font-mono">sql/26ai/06_import_duality_views.sql</span>).
        </p>
      )}
    </>
  )
}

export function DualityViews() {
  const panel = usePanel(useDualityViewsQuery)
  return (
    <SectionCard
      icon={GitMerge}
      title="Duality views"
      subtitle="Updatable JSON-relational views, one per migrated collection, populated by the 26ai duality import"
      action={
        <Button variant="outline" size="sm" onClick={panel.refresh} loading={panel.isFetching}>
          Refresh
        </Button>
      }
    >
      <QueryBoundary
        panel={panel}
        skeleton={
          <>
            <div className="mb-3 h-5" aria-hidden />
            <TableSkeleton rows={12} columns={4} />
          </>
        }
        errorTitle="Could not load duality views"
      >
        {(data) => <Views data={data} />}
      </QueryBoundary>
    </SectionCard>
  )
}
