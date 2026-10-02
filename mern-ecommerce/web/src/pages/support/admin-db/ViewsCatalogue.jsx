import { useMemo } from 'react'
import { FileJson, Layers, ShieldCheck, Table2 } from 'lucide-react'
import { Badge, EmptyState } from '../../../components/ui/Display'
import { Button } from '../../../components/ui/Button'
import { SectionCard } from '../../../components/support/Panel'
import { useDatabaseViewsQuery } from '../../../features/support/supportApi'
import { QueryBoundary } from './QueryBoundary'
import { ListCardSkeleton } from './Skeletons'
import { readViews } from './normalize'
import { usePanel } from './usePanel'

function ViewGroup({ title, icon: Icon, views, tone }) {
  return (
    <div className="rounded-2xl border border-ink-200">
      <header className="flex items-center justify-between gap-2 border-b border-ink-100 px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink-800">
          <Icon size={15} className={tone === 'duality' ? 'text-duality-600' : 'text-brand-600'} />
          {title}
        </span>
        <Badge tone={tone}>{views.length}</Badge>
      </header>
      <div className="p-2">
        {views.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-ink-500">Nothing reported in this group.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {views.map((view) => (
              <li key={view.name} className="flex items-center justify-between gap-3 px-2 py-2">
                <span className="truncate font-mono text-xs text-ink-700" title={view.name}>
                  {view.name}
                </span>
                <span className="flex shrink-0 items-center gap-3 text-xs text-ink-500">
                  <span>{view.columns} columns</span>
                  {view.documents !== null && <span className="tabular-nums">{view.documents} rows</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Views({ data }) {
  const groups = useMemo(() => readViews(data), [data])
  if (groups.total === 0) {
    return <EmptyState icon={Layers} title="No views reported" description="The endpoint returned an empty catalogue." />
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ViewGroup title="Relational views" icon={Table2} views={groups.relational} tone="brand" />
      <ViewGroup title="JSON collection views" icon={FileJson} views={groups.json} tone="duality" />
      <ViewGroup title="Validity views" icon={ShieldCheck} views={groups.validity} tone="duality" />
    </div>
  )
}

export function ViewsCatalogue() {
  const panel = usePanel(useDatabaseViewsQuery)
  return (
    <SectionCard
      icon={Layers}
      title="Views over the JSON store"
      subtitle="Relational SQL views for BI vs read-only JSON collection views for document clients"
      tone="duality"
      action={
        <Button variant="outline" size="sm" onClick={panel.refresh} loading={panel.isFetching}>
          Refresh
        </Button>
      }
    >
      <QueryBoundary
        panel={panel}
        skeleton={
          <div className="grid gap-4 lg:grid-cols-2">
            <ListCardSkeleton rows={5} />
            <ListCardSkeleton rows={1} />
            <ListCardSkeleton rows={4} />
          </div>
        }
        errorTitle="Could not load the view catalogue"
      >
        {(data) => <Views data={data} />}
      </QueryBoundary>
    </SectionCard>
  )
}
