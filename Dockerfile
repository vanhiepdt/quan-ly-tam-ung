# Next.js 16 standalone — server.js + public + .next/static (docs/output.md).
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/var/lib/tam-ung/tep
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates wget \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/lib/tam-ung/tep
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/Mau ./Mau
COPY --from=builder /app/db ./db
COPY --from=builder /app/scripts ./scripts
RUN chown -R node:node /app /var/lib/tam-ung
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=40s \
  CMD wget -qO- http://127.0.0.1:3000/dang-nhap >/dev/null || exit 1
CMD ["node", "server.js"]
