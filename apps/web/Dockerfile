FROM node:22-alpine

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json

RUN npm ci --workspace @opspilot/web --include-workspace-root

COPY apps/web ./apps/web

WORKDIR /workspace/apps/web
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]

