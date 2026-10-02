const socketio = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const { ROLES } = require('../constants');
const keys = require('../config/keys');
const User = mongoose.model('User');

const support = require('./support');

const authHandler = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || !token) {
      return next(new Error('no token'));
    }

    const [authType, tokenValue] = token.trim().split(' ');
    if (authType !== 'Bearer' || !tokenValue) {
      return next(new Error('no token'));
    }

    const payload = jwt.verify(tokenValue, keys.jwt.secret, {
      algorithms: ['HS256']
    });
    const id = String(payload.id);
    const user = await User.findById(id).select('firstName lastName role');

    if (!user) {
      return next(new Error('no user found'));
    }

    support.registerConnection(
      {
        id,
        role: user.role,
        isAdmin: user.role === ROLES.Admin,
        name: [user.firstName, user.lastName].filter(Boolean).join(' ')
      },
      socket
    );

    next();
  } catch (error) {
    // A bad/expired token must only reject this handshake - an uncaught throw
    // here rejected the socket.io middleware promise and killed the process.
    next(new Error('invalid token'));
  }
};

const socket = server => {
  const io = socketio(server, {
    cors: {
      origin: keys.corsOrigins,
      methods: ['GET', 'POST']
    }
  });

  io.use(authHandler);

  io.on('connection', socket => {
    support.supportHandler(io, socket);
  });

  return io;
};

module.exports = socket;
