import { useMemo } from 'react'
import { AlertTriangle, CheckCircle2, FileJson, ShieldCheck } from 'lucide-react'
import { Badge, Skeleton } from '../../../components/ui/Display'
import { Button } from '../../../components/ui/Button'
import { StatTile } from '../../../components/support/StatTile'
import { DataTable } from '../../../components/support/DataTable'
import { SectionCard } from '../../../components/support/Panel'
import { cn } from '../../../lib/cn'
import { useValidityReportQuery } from '../../../features/support/supportApi'
import { QueryBoundary } from './QueryBoundary'
import { TableSkeleton } from './Skeletons'
import { readValidity } from './normalize'
import { usePanel } from './usePanel'

// The validation report is JSON text from DBMS_JSON_SCHEMA.VALIDATE_REPORT.
const reportText = (report) => (typeof report === 'string' ? report : JSON.stringify(report))

function Report({ data }) {
  const validity = useMemo(() => readValidity(data), [data])
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={FileJson} label="Documents checked" value={validity.totals.documents} />
        <StatTile icon={CheckCircle2} label="Valid documents" value={validity.totals.valid} tone="success" />
        <StatTile
          icon={AlertTriangle}
          label="Invalid documents"
          value={validity.totals.invalid}
          tone={validity.totals.invalid > 0 ? 'brand' : 'success'}
        />
        <StatTile icon={ShieldCheck} label="Schemas inferred" value={validity.schemas} tone="duality" />
      </div>
      <p className="mt-2 font-mono text-xs text-ink-400">{validity.source}</p>

      <div className="mt-4">
        <DataTable
          rows={validity.rows}
          rowKey={(row) => row.name}
          emptyLabel="No validity rows reported."
          columns={[
            { key: 'name', header: 'Collection', render: (row) => <span className="font-mono text-xs">{row.name}</span> },
            { key: 'documents', header: 'Documents', align: 'right' },
            { key: 'valid', header: 'Valid', align: 'right' },
            {
              key: 'invalid',
              header: 'Invalid',
              align: 'right',
              render: (row) => <span className={cn(row.invalid > 0 && 'font-semibold text-brand-600')}>{row.invalid}</span>
            }
          ]}
        />
      </div>

      <div className="mt-4">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-ink-800">
          <AlertTriangle size={15} className="text-amber-400" /> Drifted document samples
          {validity.samples.length > 0 && <Badge tone="warning">{validity.samples.length}</Badge>}
        </h3>
        <div className="mt-2">
          <DataTable
            dense
            rows={validity.samples}
            rowKey={(row, index) => `${row.collection}-${row.docId}-${index}`}
            emptyLabel="Every document matches the inferred schema — no drift detected."
            columns={[
              { key: 'collection', header: 'Collection', render: (row) => <span className="font-mono text-xs">{row.collection}</span> },
              { key: 'docId', header: 'Document', render: (row) => <span className="font-mono text-xs">{row.docId}</span> },
              {
                key: 'report',
                header: 'Validation report',
                render: (row) => (
                  <span className="line-clamp-2 block max-w-2xl text-xs text-ink-600" title={reportText(row.report)}>
                    {reportText(row.report)}
                  </span>
                )
              }
            ]}
          />
        </div>
      </div>
    </>
  )
}

export function ValidityReport() {
  const panel = usePanel(useValidityReportQuery)
  return (
    <SectionCard
      icon={ShieldCheck}
      title="JSON validity report"
      subtitle="Every document validated against the schema inferred from its duality view"
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
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {['Documents checked', 'Valid documents', 'Invalid documents', 'Schemas inferred'].map((label) => (
                <StatTile key={label} label={label} loading />
              ))}
            </div>
            <Skeleton className="mt-2 h-4 w-96 max-w-full" />
            <TableSkeleton className="mt-4" rows={4} columns={4} />
            <Skeleton className="mt-4 h-5 w-52" />
            <Skeleton className="mt-2 h-16" />
          </>
        }
        errorTitle="Validity report unavailable"
      >
        {(data) => <Report data={data} />}
      </QueryBoundary>
    </SectionCard>
  )
}
