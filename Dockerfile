FROM node:22-alpine

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY src ./src
COPY api ./api
COPY sequelize.config.cjs .sequelizerc ./

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "src/server.js"]
