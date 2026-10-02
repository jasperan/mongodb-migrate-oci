FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /usr/src/app

# Dependencies first so the layer is cached until the manifests change
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node . .

USER node

EXPOSE 3000

# /api/health answers 503 while MongoDB is down; the fetch exits non-zero on that
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

CMD ["npm", "start"]
