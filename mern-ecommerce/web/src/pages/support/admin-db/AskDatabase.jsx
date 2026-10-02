import { useState } from 'react'
import { useSelector } from 'react-redux'
import { MessageSquareCode, Wand2 } from 'lucide-react'
import { Badge, Spinner } from '../../../components/ui/Display'
import { Button } from '../../../components/ui/Button'
import { Field, Textarea } from '../../../components/ui/Field'
import { DataTable } from '../../../components/support/DataTable'
import { ErrorNotice, SectionCard } from '../../../components/support/Panel'
import { selectRole } from '../../../features/auth/authSlice'
import { useAiStatusQuery, useAskDatabaseMutation } from '../../../features/support/supportApi'
import { describeApiError } from '../../../lib/apiError'

const ADMIN = 'ROLE ADMIN'

const cell = (value) => {
  if (value === null || value === undefined || value === '') return '—'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

// Why the form is not usable right now, or null. Checked before the click so the
// page explains itself instead of failing with a 4xx afterwards.
function unavailableReason(status, role) {
  if (status && !status.selectAi.configured) {
    return 'No Select AI profile is configured on this server (set SELECT_AI_PROFILE; see sql/26ai/09_select_ai.sql).'
  }
  if (role !== ADMIN) return 'Sign in as an administrator to run generated SQL.'
  return null
}

function Answer({ result }) {
  const columns = result.rows?.length ? Object.keys(result.rows[0]).slice(0, 8) : []
  return (
    <div className="mt-4 space-y-4">
      {result.skipped && (
        <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700" role="status">
          {result.skipped}
        </p>
      )}
      {result.error && (
        <p className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700" role="status">
          {result.error}
        </p>
      )}

      {result.sql && (
        <div>
          <p className="eyebrow mb-1.5 flex items-center gap-2">
            Generated SQL <Badge tone="duality">{result.provider}</Badge>
          </p>
          <pre className="overflow-x-auto rounded-xl bg-ink-950 px-4 py-3 font-mono text-xs leading-relaxed text-ink-100">
            <code>{result.sql}</code>
          </pre>
        </div>
      )}

      {result.rows && (
        <div>
          <p className="eyebrow mb-1.5">
            Rows <span className="text-ink-400">({result.rows.length}{result.truncated ? '+' : ''})</span>
          </p>
          <DataTable
            dense
            rows={result.rows}
            emptyLabel="The query returned no rows."
            columns={columns.map((key) => ({ key, header: key, render: (row) => cell(row[key]) }))}
          />
          {result.truncated && <p className="mt-1.5 text-xs text-ink-400">Showing the first {result.rows.length} rows.</p>}
        </div>
      )}
    </div>
  )
}

export function AskDatabase() {
  const { data: status } = useAiStatusQuery()
  const role = useSelector(selectRole)
  const [askDatabase, ask] = useAskDatabaseMutation()
  const [question, setQuestion] = useState('')
  const reason = unavailableReason(status, role)

  const submit = (event) => {
    event.preventDefault()
    if (question.trim() && !reason) askDatabase(question.trim())
  }

  return (
    <SectionCard
      icon={MessageSquareCode}
      title="Ask the database"
      subtitle="Natural language → SQL over the relational views (Oracle Select AI)"
      tone="duality"
    >
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Your question" className="flex-1">
          <Textarea
            rows={2}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="e.g. Which five products have the highest average review rating?"
            maxLength={500}
            className="resize-none"
          />
        </Field>
        <Button type="submit" variant="duality" loading={ask.isLoading} disabled={!question.trim() || Boolean(reason)}>
          <Wand2 size={15} /> Ask
        </Button>
      </form>

      {reason && <p className="mt-3 text-xs text-ink-500">{reason}</p>}

      {ask.isLoading && (
        <p className="mt-3 flex items-center gap-2 text-sm text-ink-500">
          <Spinner className="size-4" /> Translating your question…
        </p>
      )}

      {ask.isError && (
        <ErrorNotice
          className="mt-3"
          error={ask.error}
          title={
            [401, 403].includes(describeApiError(ask.error).status)
              ? 'Sign in as an administrator to run generated SQL'
              : 'Ask the database failed'
          }
        />
      )}

      {ask.isSuccess && <Answer result={ask.data} />}
    </SectionCard>
  )
}
