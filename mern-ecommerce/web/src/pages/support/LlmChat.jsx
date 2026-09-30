import { useEffect, useRef, useState } from 'react'
import { Bot, Eraser, Send, Sparkles } from 'lucide-react'
import { Badge, EmptyState, Spinner } from '../../components/ui/Display'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { ChatBubble, TypingBubble } from '../../components/support/ChatBubble'
import { ErrorNotice, describeApiError } from '../../components/support/Panel'
import { useChatMutation } from '../../features/support/supportApi'
import { dateTime } from '../../lib/format'

const SUGGESTIONS = [
  'Which brands carry the most products?',
  'Summarise what customers say in recent reviews.',
  'What are the cheapest products under $25?',
  'Which categories have the highest rated items?',
  'How many products are currently out of stock?',
  'Recommend a gift for a home office.'
]

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

export default function LlmChat() {
  const [sendMessage, { isLoading, error, reset }] = useChatMutation()
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages.length, isLoading])

  const submit = async (raw) => {
    const question = String(raw || draft).trim()
    if (!question || isLoading) return

    reset()
    setMessages((previous) => [...previous, { id: nextId(), role: 'user', text: question, at: Date.now() }])
    setDraft('')

    try {
      const result = await sendMessage(question).unwrap()
      const answer = result?.response ?? result?.answer ?? ''
      setMessages((previous) => [
        ...previous,
        {
          id: nextId(),
          role: 'assistant',
          text: answer || 'The assistant returned an empty response.',
          at: Date.now()
        }
      ])
    } catch (requestError) {
      const { status, message } = describeApiError(requestError)
      // Even when generation is unconfigured, retrieval already ran inside Oracle:
      // surface what the database returned instead of showing the error alone.
      const retrieval = requestError?.data?.retrieval
      const contextLines = String(retrieval?.context || '')
        .split('\n')
        .filter(Boolean)
        .slice(0, 3)
      setMessages((previous) => [
        ...previous,
        {
          id: nextId(),
          role: 'error',
          text:
            `Could not get a response from the assistant${status ? ` (HTTP ${status})` : ''}: ${message}. ` +
            'The RAG service behind POST /api/chat returned this error.',
          at: Date.now()
        },
        ...(contextLines.length
          ? [
              {
                id: nextId(),
                role: 'assistant',
                text: `Retrieval still ran inside the database (${retrieval.source}) and returned:\n${contextLines.join('\n')}`,
                at: Date.now()
              }
            ]
          : [])
      ])
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    submit()
  }

  return (
    <div className="container-page py-8 lg:py-12">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Support</p>
          <h1 className="mt-1 flex items-center gap-2 font-display text-3xl font-semibold tracking-tight">
            <Sparkles size={22} className="text-brand-600" /> AI shopping assistant
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-ink-500">
            Ask about products, prices, stock or what other shoppers said — answers are drawn from the live catalogue
            and customer reviews.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="duality">Grounded answers</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setMessages([])
              reset()
            }}
            disabled={messages.length === 0 && !error}
          >
            <Eraser size={14} /> Clear
          </Button>
        </div>
      </header>

      {error && messages.length === 0 && (
        <ErrorNotice
          className="mb-6"
          error={error}
          title="The assistant endpoint failed"
          action={
            <Button variant="outline" size="sm" onClick={() => reset()}>
              Dismiss
            </Button>
          }
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="card-surface flex min-h-[30rem] flex-col overflow-hidden lg:min-h-[34rem]">
          <header className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-full bg-duality-50 text-duality-700">
                <Bot size={17} />
              </span>
              <div>
                <h2 className="font-display text-sm font-semibold">Assistant</h2>
                <p className="text-xs text-ink-500">Grounded on the live catalogue and customer reviews</p>
              </div>
            </div>
            {isLoading && (
              <span className="flex items-center gap-2 text-xs text-ink-500">
                <Spinner className="size-4" /> Thinking…
              </span>
            )}
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-ink-50/60 px-4 py-4">
            {messages.length === 0 && !isLoading ? (
              <div className="flex h-full items-center justify-center">
                <EmptyState
                  icon={Sparkles}
                  title="Ask about the store"
                  description="Try one of the suggested questions, or type your own below."
                  className="border-0 bg-transparent shadow-none"
                />
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
                return (
                  <ChatBubble
                    key={message.id}
                    name={message.role === 'error' ? 'Assistant · error' : 'Assistant'}
                    timestamp={dateTime(message.at)}
                    tone={message.role === 'error' ? 'error' : 'duality'}
                  >
                    {message.text}
                  </ChatBubble>
                )
              })
            )}
            {isLoading && <TypingBubble label="Searching the catalogue" />}
            <div ref={endRef} />
          </div>

          <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-ink-100 bg-white p-3">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about products, brands or reviews…"
              autoComplete="off"
              disabled={isLoading}
              aria-label="Message the assistant"
            />
            <Button type="submit" loading={isLoading} disabled={!draft.trim() || isLoading} className="shrink-0">
              {!isLoading && <Send size={15} />}
              <span className="hidden sm:inline">Send</span>
            </Button>
          </form>
        </section>

        <aside className="space-y-4">
          <div className="card-surface p-4">
            <h2 className="font-display text-sm font-semibold">Suggested questions</h2>
            <div className="mt-3 space-y-2">
              {SUGGESTIONS.map((suggestion) => (
                <SuggestionButton key={suggestion} onClick={submit} disabled={isLoading}>
                  {suggestion}
                </SuggestionButton>
              ))}
            </div>
          </div>

          <div className="card-surface p-4 text-sm text-ink-600">
            <h2 className="font-display text-sm font-semibold text-ink-900">How this works</h2>
            <ul className="mt-2 space-y-2 text-xs leading-relaxed text-ink-500">
              <li>· Ask in plain language — “do you sell camping gear?”, “which brands are cheapest?”.</li>
              <li>· The assistant looks up matching products, prices, stock and reviews before answering.</li>
              <li>· Answers reflect the catalogue as it is right now, so newly listed products are included.</li>
              <li>· Product recommendations are suggestions, not a guarantee of availability.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
