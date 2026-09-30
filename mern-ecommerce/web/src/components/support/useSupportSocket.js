import { useCallback, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

// The Vite dev server only proxies /api (HTML/JSON); the socket.io transport is
// served by Express itself, so in dev we talk to the API origin directly. In a
// production deployment both are behind the same reverse proxy.
export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin)

const mergeMessages = (previous, incoming) => {
  if (!Array.isArray(incoming) || incoming.length === 0) return previous
  const map = new Map(previous.map((message) => [message.id, message]))
  let added = false
  for (const message of incoming) {
    if (!message || !message.id || map.has(message.id)) continue
    map.set(message.id, message)
    added = true
  }
  if (!added) return previous
  return [...map.values()].sort((a, b) => (a.time || 0) - (b.time || 0))
}

const upsertUser = (list, user) => {
  if (!user || user.id === undefined) return list
  const index = list.findIndex((entry) => entry.id === user.id)
  if (index === -1) return [...list, user]
  const next = [...list]
  next[index] = { ...next[index], ...user }
  return next
}

/**
 * Owns the support-chat socket lifecycle.
 *
 * Server contract (server/socket/support.js):
 *   auth is read from handshake.auth.token and MUST be the full "Bearer <jwt>".
 *   C→S: connectUser, getUsers, getMessages, message {text,to}, (disconnect)
 *   S→C: connectUser(user), getUsers(user[]), getMessages(message[]),
 *        message({id,value,time,user,from,to}), disconnectUser(user)
 *   connect_error(Error) on auth failure.
 *
 * State is process-local and in-memory: a reload loses history.
 */
export function useSupportSocket(token) {
  const socketRef = useRef(null)
  const [status, setStatus] = useState(token ? 'connecting' : 'idle')
  const [error, setError] = useState(null)
  const [users, setUsers] = useState([])
  const [messages, setMessages] = useState([])

  useEffect(() => {
    if (!token) {
      setStatus('idle')
      return undefined
    }

    setStatus('connecting')
    setError(null)

    const socket = io(SOCKET_URL, {
      auth: { token },
      reconnectionAttempts: 8
    })
    socketRef.current = socket

    const onConnect = () => {
      setStatus('connected')
      setError(null)
      socket.emit('connectUser')
      socket.emit('getUsers')
      socket.emit('getMessages')
    }
    const onDisconnect = (reason) => {
      setStatus(reason === 'io client disconnect' ? 'disconnected' : 'reconnecting')
    }
    const onConnectError = (err) => {
      setStatus('error')
      setError(err?.message || 'Could not reach the support service')
    }
    const onUsers = (list) => setUsers(Array.isArray(list) ? list : [])
    const onUser = (user) => setUsers((previous) => upsertUser(previous, user))
    const onMessages = (list) => setMessages((previous) => mergeMessages(previous, list))
    const onMessage = (message) => setMessages((previous) => mergeMessages(previous, [message]))

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)
    socket.on('getUsers', onUsers)
    socket.on('connectUser', onUser)
    socket.on('disconnectUser', onUser)
    socket.on('getMessages', onMessages)
    socket.on('message', onMessage)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
      socket.off('getUsers', onUsers)
      socket.off('connectUser', onUser)
      socket.off('disconnectUser', onUser)
      socket.off('getMessages', onMessages)
      socket.off('message', onMessage)
      socket.disconnect()
      socketRef.current = null
      setUsers([])
      setMessages([])
    }
  }, [token])

  const sendMessage = useCallback((text, to) => {
    const socket = socketRef.current
    if (!socket || !text?.trim() || to === undefined || to === null) return false
    socket.emit('message', { text: text.trim(), to })
    return true
  }, [])

  const retry = useCallback(() => {
    const socket = socketRef.current
    if (!socket) return
    setError(null)
    setStatus('connecting')
    socket.connect()
  }, [])

  return { status, error, users, messages, sendMessage, retry }
}

export default useSupportSocket
