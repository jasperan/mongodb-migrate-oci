import clsx from 'clsx'
import { Sparkles } from 'lucide-react'
import { initials } from '../../lib/format'

// Avatar tint is derived from the speaker so a conversation keeps the same
// colours across re-renders without storing anything.
const AVATAR_TONES = [
  'bg-brand-100 text-brand-700',
  'bg-duality-100 text-duality-700',
  'bg-amber-50 text-amber-700',
  'bg-emerald-50 text-emerald-700',
  'bg-ink-100 text-ink-700'
]

const toneFor = (seed = '') => {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 99991
  return AVATAR_TONES[hash % AVATAR_TONES.length]
}

/**
 * One chat message. `mine` renders the right-aligned brand bubble (the signed-in
 * user / the prompt), the default renders a left-aligned surface bubble with an
 * avatar, name and timestamp header.
 *
 * tone: 'plain' | 'duality' (assistant) | 'error'
 * rich: the children are already structured (paragraphs, lists), so line breaks in
 *       the source text are not preserved.
 * footer: content under the bubble, inside the same column (source chips).
 */
export function ChatBubble({ mine = false, name, timestamp, avatar, showAvatar = true, tone = 'plain', rich = false, footer, className, children }) {
  const mineAvatar = typeof avatar === 'string' ? avatar : initials(name)

  return (
    <div className={clsx('flex w-full items-end gap-2.5', mine ? 'flex-row-reverse' : 'flex-row', className)}>
      {!mine && showAvatar && (
        <span
          className={clsx(
            'grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold',
            // The assistant keeps the tint of its typing bubble.
            tone === 'duality' ? 'bg-duality-100 text-duality-700' : toneFor(name || '?')
          )}
          aria-hidden
        >
          {avatar || initials(name) || <Sparkles size={13} />}
        </span>
      )}

      <div className={clsx('flex min-w-0 max-w-[82%] flex-col gap-1 sm:max-w-[75%]', mine ? 'items-end' : 'items-start')}>
        {!mine && (name || timestamp) && (
          <span className="flex items-center gap-2 px-1 text-[11px] text-ink-500">
            {name && <span className="font-semibold text-ink-600">{name}</span>}
            {timestamp && <span>{timestamp}</span>}
          </span>
        )}

        <div
          className={clsx(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words',
            rich ? 'whitespace-normal' : 'whitespace-pre-wrap',
            mine && 'rounded-br-md bg-brand-600 text-white',
            !mine && tone === 'plain' && 'rounded-bl-md border border-ink-200 bg-white text-ink-800 shadow-sm',
            !mine && tone === 'duality' && 'rounded-bl-md border border-duality-100 bg-duality-50 text-ink-800',
            !mine && tone === 'error' && 'rounded-bl-md border border-brand-200 bg-brand-50 text-brand-700'
          )}
        >
          {children}
        </div>

        {footer}

        {mine && timestamp && <span className="px-1 text-[11px] text-ink-400">{timestamp}</span>}
      </div>

      {mine && mineAvatar && (
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink-900 text-[11px] font-semibold text-white" aria-hidden>
          {mineAvatar}
        </span>
      )}
    </div>
  )
}

/** Three-dot "assistant is typing" bubble. */
export function TypingBubble({ label = 'Thinking' }) {
  return (
    <div className="flex w-full items-end gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-duality-100 text-duality-700" aria-hidden>
        <Sparkles size={13} />
      </span>
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-ink-200 bg-white px-4 py-2.5 text-sm text-ink-500 shadow-sm">
        <span className="flex gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-1.5 animate-bounce rounded-full bg-ink-300"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </span>
        {label}…
      </div>
    </div>
  )
}

export default ChatBubble
