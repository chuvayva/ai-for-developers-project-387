# One image for the whole app: Fastify serves the API under /api and the built
# interface everywhere else, on the port the platform passes in PORT.

FROM node:24.22.3-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json api/
COPY server/package.json server/
COPY web/package.json web/
COPY e2e/package.json e2e/
RUN pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY api api
COPY server server
COPY web web
RUN pnpm --filter @calendar/api build \
 && pnpm --filter @calendar/web build \
 && pnpm --filter @calendar/server deploy --prod --legacy /out/server

FROM node:24.22.3-slim
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    WEB_DIST=/app/web
WORKDIR /app/server
COPY --from=build --chown=node:node /out/server ./
COPY --from=build --chown=node:node /app/web/dist /app/web
USER node
EXPOSE 3000
CMD ["node", "src/main.ts"]
