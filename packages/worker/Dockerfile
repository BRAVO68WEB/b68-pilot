FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lockb ./
COPY packages/core/package.json packages/core/
COPY packages/worker/package.json packages/worker/

RUN bun install

COPY tsconfig.json ./
COPY packages/core/ packages/core/
COPY packages/worker/ packages/worker/

RUN bun run build

FROM oven/bun:1-slim AS runtime
WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages/core ./packages/core
COPY --from=base /app/packages/worker ./packages/worker
COPY --from=base /app/package.json ./

RUN mkdir -p /app/.data

ENTRYPOINT ["bun", "run"]
