FROM node:22-alpine

WORKDIR /app

COPY package*.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/service/package*.json ./packages/service/
COPY packages/shared/package*.json ./packages/shared/
COPY tsconfig.base.json ./

RUN npm install -g pnpm

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm -r --filter @myst/service build

ENV PORT=3000

EXPOSE 3000

USER node

CMD ["pnpm", "--filter", "@myst/service", "start"]
