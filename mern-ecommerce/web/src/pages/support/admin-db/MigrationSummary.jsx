import { useMemo } from 'react'
import { AlertTriangle, ArrowLeftRight, CheckCircle2, Database, FileJson } from 'lucide-react'
import { Badge, Skeleton } from '../../../components/ui/Display'
import { Button } from '../../../components/ui/Button'
import { StatTile } from '../../../components/support/StatTile'
import { DataTable } from '../../../components/support/DataTable'
import { MatchBadge, SectionCard } from '../../../components/support/Panel'
import { dateTime } from '../../../lib/format'
import { useMigrationStatusQuery } from '../../../features/support/supportApi'
import { QueryBoundary } from './QueryBoundary'
import { TableSkeleton } from './Skeletons'
import { readMigration } from './normalize'
import { usePanel } from './usePanel'

// The pass/fail chip comes from `verified` in the report, not from the live counts:
// the counts move with every write, the report is what a verification run concluded.
function VerificationChip({ migration }) {
  if (migration.verified === true) {
    return <Badge tone="success">Verified {migration.generatedAt ? dateTime(migration.generatedAt) : ''}</Badge>
  }
  if (migration.verified === false) {
    return (
      <Badge tone="brand">
        Verification failed{migration.generatedAt ? ` · ${dateTime(migration.generatedAt)}` : ''}
      </Badge>
    )
  }
  return <Badge tone="neutral">Unverified · no verification report on file</Badge>
}

function Summary({ data }) {
  const migration = useMemo(() => readMigration(data), [data])
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile icon={Database} label="Source collections" value={migration.sourceCollections} tone="duality" hint={migration.sourceLabel} />
        <StatTile
          icon={Database}
          label="Target collections"
          value={migration.targetCollections}
          tone="duality"
          hint={
            migration.targetViews.length > 0
              ? `${migration.targetLabel} · +${migration.targetViews.length} JSON view`
              : migration.targetLabel
          }
        />
        <StatTile icon={FileJson} label="Source documents" value={migration.sourceDocuments} />
        <StatTile icon={FileJson} label="Target documents" value={migration.targetDocuments} />
        <StatTile
          icon={migration.mismatches > 0 ? AlertTriangle : CheckCircle2}
          label="Mismatched"
          value={migration.mismatches}
          hint={migration.unknown > 0 ? `${migration.unknown} undetermined` : 'counts compared per collection'}
          tone={migration.mismatches > 0 ? 'brand' : 'success'}
        />
      </div>

      <div className="mt-4">
        <DataTable
          rows={migration.rows}
          rowKey={(row) => row.name}
          emptyLabel="The migration status endpoint reported no collections."
          columns={[
            { key: 'name', header: 'Collection', render: (row) => <span className="font-mono text-xs">{row.name}</span> },
            { key: 'source', header: `${migration.sourceLabel} docs`, align: 'right', render: (row) => row.source ?? '—' },
            { key: 'target', header: `${migration.targetLabel} docs`, align: 'right', render: (row) => row.target ?? '—' },
            {
              key: 'delta',
              header: 'Delta',
              align: 'right',
              render: (row) => (row.source === null || row.target === null ? '—' : row.target - row.source)
            },
            { key: 'status', header: 'Status', align: 'right', render: (row) => <MatchBadge status={row.status} /> }
          ]}
        />
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-400">
          <VerificationChip migration={migration} />
          <span>{migration.reportFile ? `report ${migration.reportFile}` : 'live counts only'}</span>
          {migration.unknown > 0 && <span>source counts unavailable for {migration.unknown} collections</span>}
        </p>
      </div>
    </>
  )
}

// Same grid and table the loaded panel uses, so nothing shifts when the data lands.
function PanelSkeleton() {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {['Source collections', 'Target collections', 'Source documents', 'Target documents', 'Mismatched'].map((label) => (
          <StatTile key={label} label={label} hint={'\u00a0'} loading />
        ))}
      </div>
      <TableSkeleton className="mt-4" rows={12} columns={5} />
      <Skeleton className="mt-3 h-6 w-72" />
    </>
  )
}

export function MigrationSummary() {
  const panel = usePanel(useMigrationStatusQuery)
  return (
    <SectionCard
      icon={ArrowLeftRight}
      title="Migration summary"
      subtitle="Source (MongoDB API) vs target (Oracle JSON collections), per collection"
      action={
        <Button variant="outline" size="sm" onClick={panel.refresh} loading={panel.isFetching}>
          Refresh
        </Button>
      }
    >
      <QueryBoundary panel={panel} skeleton={<PanelSkeleton />} errorTitle="Migration status unavailable">
        {(data) => <Summary data={data} />}
      </QueryBoundary>
    </SectionCard>
  )
}
