# Single-container self-hosted build: the Elysia backend serves the API and the built frontend.
FROM oven/bun:1.3 AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
RUN bun install --frozen-lockfile
COPY . .
RUN cd apps/frontend && bun run build

FROM oven/bun:1.3-slim
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/backend ./apps/backend
COPY --from=build /app/apps/frontend/dist ./apps/frontend/dist
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data
# SQLite files and the setup wizard's config.json live here.
VOLUME /data
EXPOSE 3000
CMD ["bun", "apps/backend/src/index.ts"]
