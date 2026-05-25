FROM node:22-alpine

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json

RUN npm ci --workspace @opspilot/api --include-workspace-root

COPY apps/api ./apps/api

WORKDIR /workspace/apps/api
RUN npx prisma generate
RUN npm run build

EXPOSE 4000

CMD ["node", "dist/main.js"]

