const { randomUUID } = require('crypto');

const MAX_MESSAGES = 500;
const MAX_TEXT_LENGTH = 2000;
const MESSAGE_BURST = 5;
const MESSAGE_WINDOW_MS = 10 * 1000;

// Process-local state (a single API instance serves the support chat).
// users: id -> { id, name, role, isAdmin, connections }
const users = new Map();
const messages = [];

const ADMIN_ROOM = 'admins';

// The only shape of a user that ever leaves the server.
const publicUser = user => ({
  id: user.id,
  name: user.name,
  role: user.role,
  isAdmin: user.isAdmin
});

const listedUser = user => ({ ...publicUser(user), online: user.connections > 0 });

const toMessage = stored => ({
  id: stored.id,
  value: stored.value,
  time: stored.time,
  from: stored.from,
  to: stored.to,
  user: stored.user
});

// A user is kept while they are connected or still appear in a stored message.
const pruneOfflineUsers = () => {
  for (const user of users.values()) {
    if (user.connections > 0) continue;
    const inUse = messages.some(m => m.from === user.id || m.to === user.id);
    if (!inUse) users.delete(user.id);
  }
};

// Called on every handshake: refreshes name and role from the database so a
// demoted or renamed account never keeps its cached privileges.
const registerConnection = (profile, socket) => {
  const existing = users.get(profile.id);
  const user = existing || { ...profile, connections: 0 };
  Object.assign(user, profile);
  user.connections += 1;
  users.set(user.id, user);
  socket.data.userId = user.id;
  return user;
};

// A listener that throws would take the whole process down, so every handler
// is wrapped and a bad payload is dropped silently.
const safe = handler => (...args) => {
  try {
    handler(...args);
  } catch (error) {
    console.warn(`support socket handler failed: ${error.message}`);
  }
};

exports.supportHandler = (io, socket) => {
  const self = () => users.get(socket.data.userId);

  // Token bucket per socket: the 500-message buffer is shared, so without a quota
  // one member could evict every other conversation. Excess messages are dropped.
  let tokens = MESSAGE_BURST;
  let refilledAt = Date.now();
  const takeToken = () => {
    const now = Date.now();
    tokens = Math.min(MESSAGE_BURST, tokens + ((now - refilledAt) / MESSAGE_WINDOW_MS) * MESSAGE_BURST);
    refilledAt = now;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };

  socket.join(socket.data.userId);
  if (self()?.isAdmin) socket.join(ADMIN_ROOM);

  socket.on(
    'connectUser',
    safe(() => {
      const user = self();
      if (!user) return;

      // admin connected => everyone hears it; member connected => admins hear it
      if (user.isAdmin) {
        socket.broadcast.emit('connectUser', listedUser(user));
      } else {
        socket.to(ADMIN_ROOM).emit('connectUser', listedUser(user));
      }
    })
  );

  socket.on(
    'getUsers',
    safe(() => {
      const user = self();
      if (!user) return;

      const visible = [...users.values()].filter(x =>
        user.isAdmin ? x.id !== user.id : x.isAdmin
      );
      socket.emit('getUsers', visible.map(listedUser));
    })
  );

  socket.on(
    'getMessages',
    safe(() => {
      const user = self();
      if (!user) return;

      socket.emit(
        'getMessages',
        messages.filter(m => m.from === user.id || m.to === user.id).map(toMessage)
      );
    })
  );

  socket.on(
    'message',
    safe(body => {
      const user = self();
      if (!user || !body || typeof body !== 'object') return;

      if (!takeToken()) return;

      const { text, to } = body;
      if (typeof text !== 'string' || typeof to !== 'string') return;
      const value = text.trim();
      if (value.length < 1 || value.length > MAX_TEXT_LENGTH) return;

      const recipient = users.get(to);
      if (!recipient || recipient.id === user.id) return;
      // Members reach the support team only; admins may write to anyone.
      if (!user.isAdmin && !recipient.isAdmin) return;

      const message = {
        id: randomUUID(),
        value,
        time: Date.now(),
        from: user.id,
        to: recipient.id,
        user: publicUser(user)
      };

      messages.push(message);
      if (messages.length > MAX_MESSAGES) messages.splice(0, messages.length - MAX_MESSAGES);

      io.to(recipient.id).to(user.id).emit('message', toMessage(message));
    })
  );

  socket.on(
    'disconnect',
    safe(() => {
      const user = self();
      if (!user) return;

      user.connections = Math.max(0, user.connections - 1);
      // another tab of the same account may still be open
      if (user.connections === 0) {
        // same audience as connectUser: members never see other customers' presence
        if (user.isAdmin) {
          socket.broadcast.emit('disconnectUser', listedUser(user));
        } else {
          socket.to(ADMIN_ROOM).emit('disconnectUser', listedUser(user));
        }
        pruneOfflineUsers();
      }
    })
  );
};

exports.registerConnection = registerConnection;
