import { useState } from 'react'
import { Binoculars, Search, Sparkles } from 'lucide-react'
import { Badge } from '../../../components/ui/Display'
import { Button } from '../../../components/ui/Button'
import { Field, Input } from '../../../components/ui/Field'
import { ErrorNotice, SectionCard } from '../../../components/support/Panel'
import { useAiStatusQuery, useSimilarProductsMutation } from '../../../features/support/supportApi'
import { embeddingModel } from './normalize'

// Cosine similarity: 1 is identical, so the score doubles as the bar length.
function ScoreBar({ score }) {
  const ratio = Math.max(Math.min(score, 1), 0)
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-100" aria-hidden>
        <span className="block h-full rounded-full bg-duality-600" style={{ width: `${ratio * 100}%` }} />
      </span>
      <span className="font-mono text-xs text-ink-600 tabular-nums">{score.toFixed(3)}</span>
    </span>
  )
}

export function VectorSearch() {
  const { data: status } = useAiStatusQuery()
  const [findSimilar, search] = useSimilarProductsMutation()
  const [text, setText] = useState('')
  const embedding = status ? embeddingModel(status) : null

  const submit = (event) => {
    event.preventDefault()
    if (text.trim()) findSimilar(text.trim())
  }

  return (
    <SectionCard
      icon={Binoculars}
      title="Vector search"
      subtitle="Semantic similarity over the migrated product descriptions (in-database embeddings)"
      tone="duality"
    >
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Describe what you are looking for" className="flex-1">
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="e.g. comfortable running shoes for long distances"
            maxLength={500}
            autoComplete="off"
          />
        </Field>
        <Button type="submit" variant="duality" loading={search.isLoading} disabled={!text.trim()}>
          <Search size={15} /> Search
        </Button>
      </form>

      {embedding && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-500">
          <Sparkles size={13} className="text-duality-600" /> embedding model
          <span className="font-mono text-ink-700">{embedding.model}</span>
          {embedding.model === status.embeddings.inDatabaseModel && <Badge tone="duality">{embedding.dimension}d</Badge>}
        </p>
      )}

      {search.isError && (
        <ErrorNotice className="mt-3" error={search.error} title="Vector search is not available" />
      )}

      {search.isSuccess && (
        <div className="mt-4">
          {search.data.results.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-500">
              No similar products matched that description.
            </p>
          ) : (
            <ul className="divide-y divide-ink-100 rounded-2xl border border-ink-200">
              {search.data.results.map((result) => (
                <li key={result.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink-800">{result.name}</span>
                    <span className="font-mono text-[11px] text-ink-400">{result.id}</span>
                  </span>
                  <ScoreBar score={result.score} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </SectionCard>
  )
}
