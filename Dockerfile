FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json pnpm-lock.yaml .npmrc ./
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

EXPOSE 1337
CMD ["pnpm", "start"]
