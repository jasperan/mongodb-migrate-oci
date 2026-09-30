import { useEffect, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { Headphones, MessageSquarePlus, RefreshCw, Send, Users2 } from 'lucide-react'
import clsx from 'clsx'
import { Badge, EmptyState, Spinner } from '../../components/ui/Display'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { ChatBubble } from '../../components/support/ChatBubble'
import { ErrorNotice } from '../../components/support/Panel'
import { SOCKET_URL, useSupportSocket } from '../../components/support/useSupportSocket'
import { selectAuth } from '../../features/auth/authSlice'
import { initials, roleLabel } from '../../lib/format'

const SELECTED_KEY = 'mern26.support.selectedUser'

const formatClock = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

const STATUS_META = {
  idle: { label: 'Not connected', tone: 'neutral', dot: 'bg-ink-300' },
  connecting: { label: 'Connecting…', tone: 'warning', dot: 'bg-amber-400' },
  connected: { label: 'Connected', tone: 'success', dot: 'bg-emerald-500' },
  reconnecting: { label: 'Reconnecting…', tone: 'warning', dot: 'bg-amber-400' },
  error: { label: 'Connection error', tone: 'brand', dot: 'bg-brand-500' },
  disconnected: { label: 'Disconnected', tone: 'neutral', dot: 'bg-ink-300' }
}

function ConnectionBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.idle
  return (
    <Badge tone={meta.tone}>
      <span className={clsx('size-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </Badge>
  )
}

function UserRow({ user, me, selected, unread, onSelect }) {
  const isAdmin = Boolean(user.isAdmin) || user.role === 'ROLE ADMIN'
  return (
    <button
      type="button"
      onClick={() => onSelect(user)}
      className={clsx(
        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
        selected ? 'bg-brand-50 ring-1 ring-brand-200' : 'hover:bg-ink-50'
      )}
    >
      <span className="relative shrink-0">
        <span
          className={clsx(
            'grid size-9 place-items-center rounded-full text-xs font-semibold',
            selected ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-700'
          )}
        >
          {initials(user.name) || '?'}
        </span>
        <span
          className={clsx(
            'absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-white',
            user.online ? 'bg-emerald-500' : 'bg-ink-300'
          )}
          title={user.online ? 'Online' : 'Offline'}
        />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-ink-900">{user.name || user.id}</span>
          {isAdmin && <Badge tone="duality">{user.id === me?.id ? 'you' : 'admin'}</Badge>}
        </span>
        <span className="block truncate text-xs text-ink-500">{roleLabel(user.role) || 'User'}</span>
      </span>

      {unread > 0 && (
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-600 text-[10px] font-semibold text-white">
          {unread}
        </span>
      )}
    </button>
  )
}

export default function Support() {
  const { token, user: me } = useSelector(selectAuth)
  const { status, error, users, messages, sendMessage, retry } = useSupportSocket(token)

  const [selectedId, setSelectedId] = useState(() => localStorage.getItem(SELECTED_KEY) || null)
  const [draft, setDraft] = useState('')
  const [seen, setSeen] = useState({})
  const endRef = useRef(null)

  const others = useMemo(() => users.filter((user) => user.id !== me?.id), [users, me?.id])

  // Drop a stale persisted selection that is no longer connected.
  useEffect(() => {
    if (!selectedId) return
    if (others.length > 0 && !others.some((user) => user.id === selectedId)) {
      setSelectedId(null)
      localStorage.removeItem(SELECTED_KEY)
    }
  }, [others, selectedId])

  const selected = others.find((user) => user.id === selectedId) || null

  const conversation = useMemo(() => {
    if (!selected) return []
    return messages
      .filter((message) => message.from === selected.id || message.to === selected.id)
      .slice()
      .sort((a, b) => (a.time || 0) - (b.time || 0))
  }, [messages, selected])

  const unreadByUser = useMemo(() => {
    const counts = {}
    for (const message of messages) {
      if (!message || message.from === me?.id) continue
      if (message.from === selectedId) continue
      if (seen[message.id]) continue
      counts[message.from] = (counts[message.from] || 0) + 1
    }
    return counts
  }, [messages, me?.id, selectedId, seen])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [conversation.length, selectedId])

  const selectUser = (user) => {
    setSelectedId(user.id)
    localStorage.setItem(SELECTED_KEY, user.id)
    setSeen((previous) => {
      const next = { ...previous }
      for (const message of messages) if (message.to === user.id || message.from === user.id) next[message.id] = true
      return next
    })
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!selected || !draft.trim()) return
    if (sendMessage(draft, selected.id)) setDraft('')
  }

  const connectionError = status === 'error'

  return (
    <div className="container-page py-8 lg:py-12">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Support</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Live support chat</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-ink-500">
            Real-time messaging with the store team. Conversations are held in memory on the API process and reset when
            it restarts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ConnectionBadge status={status} />
          {(status === 'error' || status === 'disconnected') && (
            <Button variant="outline" size="sm" onClick={retry}>
              <RefreshCw size={14} /> Reconnect
            </Button>
          )}
        </div>
      </header>

      {connectionError && (
        <div className="mb-6">
          <ErrorNotice
            error={{ status: null, message: error }}
            title="Could not connect to the support service"
            onRetry={retry}
          />
          <p className="mt-2 text-xs text-ink-500">
            The support socket authenticates with your session token — if it has expired, sign in again and the chat
            will reconnect automatically.
          </p>
        </div>
      )}

      {!token ? (
        <EmptyState
          icon={Headphones}
          title="Sign in to chat with support"
          description="Live support is available to signed-in customers and staff."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[19rem_1fr]">
          <aside className="card-surface flex max-h-[32rem] flex-col overflow-hidden lg:max-h-[36rem]">
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
              <h2 className="font-display text-sm font-semibold">Conversations</h2>
              <Badge tone="neutral">{others.length}</Badge>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {status === 'connecting' && others.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-ink-500">
                  <Spinner className="size-4" /> Loading contacts…
                </div>
              ) : others.length === 0 ? (
                <p className="px-3 py-10 text-center text-sm text-ink-500">
                  {connectionError ? 'Contacts unavailable while offline.' : 'No users connected.'}
                </p>
              ) : (
                <div className="space-y-1">
                  {others.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      me={me}
                      selected={user.id === selectedId}
                      unread={unreadByUser[user.id] || 0}
                      onSelect={selectUser}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-ink-100 px-4 py-2.5 text-[11px] text-ink-400">
              socket.io · {SOCKET_URL.replace(/^https?:\/\//, '')}
            </div>
          </aside>

          <section className="card-surface flex min-h-[32rem] flex-col overflow-hidden lg:min-h-[36rem]">
            {!selected ? (
              <div className="flex flex-1 items-center justify-center p-6">
                <EmptyState
                  icon={MessageSquarePlus}
                  title="Select a chat to start messaging"
                  description="Pick a contact from the list to open the conversation."
                  className="border-0 bg-transparent shadow-none"
                />
              </div>
            ) : (
              <>
                <header className="flex items-center gap-3 border-b border-ink-100 px-4 py-3">
                  <span className="grid size-9 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                    {initials(selected.name) || '?'}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-sm font-semibold">{selected.name || selected.id}</h2>
                    <p className="text-xs text-ink-500">
                      {selected.online ? 'Online' : 'Offline'} · {roleLabel(selected.role) || 'User'}
                    </p>
                  </div>
                </header>

                <div className="flex-1 space-y-3 overflow-y-auto bg-ink-50/60 px-4 py-4">
                  {conversation.length === 0 ? (
                    <p className="py-16 text-center text-sm text-ink-500">
                      No messages yet — say hello to {selected.name || 'this user'}.
                    </p>
                  ) : (
                    conversation.map((message, index) => {
                      const mine = message.from === me?.id
                      const previous = conversation[index - 1]
                      const grouped = previous && previous.from === message.from
                      return (
                        <ChatBubble
                          key={message.id || index}
                          mine={mine}
                          showAvatar={!grouped}
                          name={grouped || mine ? undefined : message.user?.name || selected.name}
                          timestamp={grouped ? undefined : formatClock(message.time)}
                        >
                          {message.value}
                        </ChatBubble>
                      )
                    })
                  )}
                  <div ref={endRef} />
                </div>

                <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-ink-100 bg-white p-3">
                  <Input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={`Message ${selected.name || 'user'}…`}
                    autoComplete="off"
                    disabled={status !== 'connected'}
                    aria-label="Message"
                  />
                  <Button type="submit" disabled={!draft.trim() || status !== 'connected'} className="shrink-0">
                    <Send size={15} />
                    <span className="hidden sm:inline">Send</span>
                  </Button>
                </form>

                {status !== 'connected' && (
                  <p className="border-t border-ink-100 bg-amber-50 px-4 py-2 text-xs text-amber-700">
                    You are not connected — messages cannot be sent until the socket reconnects.
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      )}

      <p className="mt-6 flex items-center gap-2 text-xs text-ink-400">
        <Users2 size={13} /> {others.length} contact{others.length === 1 ? '' : 's'} visible · {messages.length} message
        {messages.length === 1 ? '' : 's'} in this session
      </p>
    </div>
  )
}
