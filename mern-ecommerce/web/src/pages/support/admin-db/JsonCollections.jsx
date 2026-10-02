import { Database, FileJson } from 'lucide-react'
import { Badge } from '../../../components/ui/Display'
import { Button } from '../../../components/ui/Button'
import { SectionCard } from '../../../components/support/Panel'
import { QueryBoundary } from './QueryBoundary'
import { ListCardSkeleton } from './Skeletons'

const ORACLE_STATUS_MESSAGE = {
  'not-configured': 'Oracle SQL access is not configured on this server.',
  unavailable: 'Oracle SQL could not be reached just now. Refresh to try again.'
}

function CollectionList({ title, icon: Icon, collections, tone, notice }) {
  return (
    <div className="rounded-2xl border border-ink-200">
      <header className="flex items-center justify-between gap-2 border-b border-ink-100 px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink-800">
          <Icon size={15} className={tone === 'duality' ? 'text-duality-600' : 'text-brand-600'} />
          {title}
        </span>
        <Badge tone={tone}>{collections.length} collections</Badge>
      </header>

      <div className="p-2">
        {notice ? (
          <p className="px-3 py-8 text-center text-sm text-amber-700">{notice}</p>
        ) : collections.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-ink-500">No collections reported.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {collections.map((collection) => (
              <li key={collection.name} className="flex items-center justify-between gap-3 px-2 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-mono text-sm text-ink-700" title={collection.name}>
                    {collection.name}
                  </span>
                  {collection.type && <Badge tone="neutral">{collection.type.toLowerCase()}</Badge>}
                </span>
                <span className="font-mono text-sm text-ink-900 tabular-nums" title={collection.count === null ? 'count unavailable' : undefined}>
                  {collection.count ?? '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/** Both sides of the migration with their document counts, from one request. */
export function JsonCollections({ panel }) {
  return (
    <SectionCard
      icon={Database}
      title="JSON collections"
      subtitle="Document counts on both sides of the migration"
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
            <ListCardSkeleton rows={12} />
            <ListCardSkeleton rows={13} />
          </div>
        }
        errorTitle="Could not list collections"
      >
        {(data) => (
          <div className="grid gap-4 lg:grid-cols-2">
            <CollectionList title="MongoDB API collections" icon={Database} collections={data.mongo} tone="brand" />
            <CollectionList
              title="Oracle JSON collections"
              icon={FileJson}
              collections={data.oracle}
              tone="duality"
              notice={ORACLE_STATUS_MESSAGE[data.oracleStatus]}
            />
          </div>
        )}
      </QueryBoundary>
    </SectionCard>
  )
}
