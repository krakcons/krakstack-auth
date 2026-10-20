FROM oven/bun:latest

WORKDIR /app

# Env
ARG VITE_SITE_URL
ARG VITE_KRAKSTACK_AUTH_URL
ARG VITE_KRAKSTACK_AUTH_ORGANIZATION_ID

ENV VITE_SITE_URL=$VITE_SITE_URL
ENV VITE_KRAKSTACK_AUTH_URL=$VITE_KRAKSTACK_AUTH_URL
ENV VITE_KRAKSTACK_AUTH_ORGANIZATION_ID=$VITE_KRAKSTACK_AUTH_ORGANIZATION_ID

# Install dependencies
COPY package.json bun.lock ./
COPY packages/sdk/package.json ./packages/sdk/package.json
RUN bun install --frozen-lockfile --ignore-scripts

# Copy source
COPY . .

RUN bun run prepare
RUN bun run build

EXPOSE 3000

CMD ["bun", "run", "start"]
