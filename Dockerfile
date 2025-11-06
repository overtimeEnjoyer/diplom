FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install -g pnpm
RUN pnpm install

COPY . .
RUN pnpm build

EXPOSE 1337
CMD ["pnpm", "start"]
