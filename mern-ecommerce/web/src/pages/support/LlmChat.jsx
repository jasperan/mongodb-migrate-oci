import { useEffect, useRef, useState } from 'react'
import { Bot, Eraser, Send, Sparkles } from 'lucide-react'
import { Badge, EmptyState, Spinner } from '../../components/ui/Display'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { ChatBubble, TypingBubble } from '../../components/support/ChatBubble'
import { useAiStatusQuery, useChatMutation } from '../../features/support/supportApi'
import { describeApiError } from '../../lib/apiError'
import { dateTime } from '../../lib/format'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { FormattedAnswer } from './chat/FormattedAnswer'
import { SourceChips } from './chat/SourceChips'

const SUGGESTIONS = [
  'Which brands carry the most products?',
  'Summarise what customers say in recent reviews.',
  'What are the cheapest products under $25?',
  'Which categories have the highest rated items?',
  'How many products are currently out of stock?',
  'Recommend a gift for a home office.'
]

// The API accepts the six most recent turns, each up to 2000 characters, and a
// question of up to 500 characters.
const HISTORY_TURNS = 6
const TURN_CHARS = 2000
const QUESTION_CHARS = 500

let messageId = 0
const nextId = () => {
  messageId += 1
  return `m${messageId}`
}

function SuggestionButton({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={() => onClick(children)}
      disabled={disabled}
      className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-left text-sm text-ink-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  )
}

function StatusPill({ status, isLoading, isError }) {
  if (isLoading) return <Badge tone="neutral">Checking assistant…</Badge>
  if (isError || !status) return <Badge tone="neutral">Assistant status unknown</Badge>
  if (!status.llm.configured) return <Badge tone="warning">Not configured</Badge>
  return <Badge tone="success">Configured · {status.llm.model}</Badge>
}

export default function LlmChat() {
  useDocumentTitle('AI assistant')

  const [sendMessage, { isLoading, reset }] = useChatMutation()
  const { data: status, isLoading: statusLoading, isError: statusError } = useAiStatusQuery()
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')

  const inputRef = useRef(null)
  const scrollerRef = useRef(null)
  const pending = useRef(null)
  // Bumped whenever the thread is cleared or the page closes, so an answer that
  // arrives afterwards is dropped instead of reappearing without its question.
  const generation = useRef(0)

  const notConfigured = Boolean(status) && !status.llm.configured

  useEffect(() => {
    const scroller = scrollerRef.current
    scroller?.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' })
  }, [messages.length, isLoading])

  useEffect(
    () => () => {
      generation.current += 1
      pending.current?.abort()
    },
    []
  )

  const submit = async (raw) => {
    const question = String(raw ?? draft).trim()
    if (!question || isLoading || notConfigured) return

    const token = generation.current
    const history = messages
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .slice(-HISTORY_TURNS)
      .map((message) => ({ role: message.role, content: message.text.slice(0, TURN_CHARS) }))

    reset()
    setMessages((previous) => [...previous, { id: nextId(), role: 'user', text: question, at: Date.now() }])
    setDraft('')
    inputRef.current?.focus()

    const request = sendMessage({ message: question, history })
    pending.current = request
    try {
      const result = await request.unwrap()
      if (token !== generation.current) return
      setMessages((previous) => [
        ...previous,
        result.response
          ? { id: nextId(), role: 'assistant', text: result.response, retrieval: result.retrieval, at: Date.now() }
          : { id: nextId(), role: 'error', text: 'The assistant returned an empty response.', at: Date.now() }
      ])
    } catch (requestError) {
      if (token !== generation.current) return
      const { status: httpStatus, message } = describeApiError(requestError)
      setMessages((previous) => [
        ...previous,
        {
          id: nextId(),
          role: 'error',
          text: `Could not get a response from the assistant${typeof httpStatus === 'number' ? ` (HTTP ${httpStatus})` : ''}: ${message}`,
          at: Date.now()
        }
      ])
    } finally {
      if (token === generation.current) {
        pending.current = null
        inputRef.current?.focus()
      }
    }
  }

  const clear = () => {
    generation.current += 1
    pending.current?.abort()
    pending.current = null
    reset()
    setMessages([])
    inputRef.current?.focus()
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    submit()
  }

  const canAsk = !isLoading && !notConfigured

  return (
    <div className="container-page pt-8 pb-8 lg:pt-10">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div>
          <p className="eyebrow">Support</p>
          <h1 className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            <Sparkles size={22} className="text-brand-600" /> AI shopping assistant
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            Ask about products, prices, stock and what other shoppers said. Answers are drawn from the live catalogue
            and its approved reviews.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={status} isLoading={statusLoading} isError={statusError} />
          <Button variant="outline" size="sm" onClick={clear} disabled={messages.length === 0 && !isLoading}>
            <Eraser size={14} /> Clear
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="card-surface flex h-[calc(100dvh-22rem)] min-h-[22rem] flex-col overflow-hidden sm:h-[calc(100dvh-21rem)]">
          <header className="flex shrink-0 items-center justify-between border-b border-ink-100 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-full bg-duality-50 text-duality-700">
                <Bot size={17} />
              </span>
              <div>
                <h2 className="font-display text-sm font-semibold">Assistant</h2>
                <p className="text-xs text-ink-500">Grounded on the live catalogue and approved reviews</p>
              </div>
            </div>
            {isLoading && (
              <span className="flex items-center gap-2 text-xs text-ink-500">
                <Spinner className="size-4" /> Thinking…
              </span>
            )}
          </header>

          <div
            ref={scrollerRef}
            role="log"
            aria-live="polite"
            aria-label="Conversation"
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-ink-50/60 px-4 py-4"
          >
            {messages.length === 0 && !isLoading ? (
              // m-auto centres the block while keeping its top reachable when it is taller than the pane.
              <div className="m-auto flex w-full max-w-md flex-col items-center gap-3">
                {notConfigured && (
                  <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700" role="status">
                    The assistant is not configured on this server. {status.llm.hint}
                  </p>
                )}
                <EmptyState
                  icon={Sparkles}
                  title="Ask about the store"
                  description="Try one of the suggested questions, or type your own below."
                  className="hidden border-0 bg-transparent py-4 shadow-none lg:flex"
                />
                <p className="text-sm font-medium text-ink-600 lg:hidden">Ask about the store</p>
                <div className="w-full space-y-2 lg:hidden">
                  {SUGGESTIONS.map((suggestion) => (
                    <SuggestionButton key={suggestion} onClick={submit} disabled={!canAsk}>
                      {suggestion}
                    </SuggestionButton>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => {
                if (message.role === 'user') {
                  return (
                    <ChatBubble key={message.id} mine timestamp={dateTime(message.at)}>
                      {message.text}
                    </ChatBubble>
                  )
                }
                if (message.role === 'error') {
                  return (
                    <ChatBubble key={message.id} name="Assistant · error" timestamp={dateTime(message.at)} tone="error">
                      {message.text}
                    </ChatBubble>
                  )
                }
                return (
                  <ChatBubble
                    key={message.id}
                    name="Assistant"
                    avatar={<Sparkles size={13} />}
                    timestamp={dateTime(message.at)}
                    tone="duality"
                    rich
                    footer={<SourceChips retrieval={message.retrieval} />}
                  >
                    <FormattedAnswer text={message.text} />
                  </ChatBubble>
                )
              })
            )}
            {isLoading && <TypingBubble label="Searching the catalogue" />}
          </div>

          <form onSubmit={handleSubmit} className="flex shrink-0 items-center gap-2 border-t border-ink-100 bg-white p-3">
            <Input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about products, brands or reviews…"
              autoComplete="off"
              maxLength={QUESTION_CHARS}
              // readOnly, not disabled: a disabled field drops focus on every send.
              readOnly={isLoading}
              disabled={notConfigured}
              aria-label="Message the assistant"
            />
            <Button type="submit" loading={isLoading} disabled={!draft.trim() || !canAsk} className="shrink-0">
              {!isLoading && <Send size={15} />}
              <span className="hidden sm:inline">Send</span>
            </Button>
          </form>
        </section>

        <aside className="hidden space-y-4 lg:block">
          <div className="card-surface p-4">
            <h2 className="font-display text-sm font-semibold">Suggested questions</h2>
            <div className="mt-3 space-y-2">
              {SUGGESTIONS.map((suggestion) => (
                <SuggestionButton key={suggestion} onClick={submit} disabled={!canAsk}>
                  {suggestion}
                </SuggestionButton>
              ))}
            </div>
          </div>

          <div className="card-surface p-4 text-sm text-ink-600">
            <h2 className="font-display text-sm font-semibold text-ink-900">How this works</h2>
            <ul className="mt-2 space-y-2 text-xs leading-relaxed text-ink-500">
              <li>· Your question is embedded and matched against the catalogue by meaning, inside Oracle AI Database.</li>
              <li>· Price limits (&ldquo;under $25&rdquo;), store-wide totals, ratings and recent reviews come from SQL on the live data.</li>
              <li>· Follow-up questions use the last few turns of this conversation.</li>
              <li>· Chips under an answer link to the products it names.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
