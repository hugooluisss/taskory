FROM node:24-alpine AS build
WORKDIR /workspace
COPY packages/llm/package*.json packages/llm/
COPY packages/llm/tsconfig.json packages/llm/
COPY packages/llm/src packages/llm/src
RUN cd packages/llm && npm ci && npm run build

WORKDIR /workspace/apps/api
COPY apps/api/package*.json ./
COPY packages/llm /workspace/packages/llm
RUN apk add --no-cache python3 make g++ && npm ci
RUN npm install-scripts approve bcrypt \
    && npm rebuild bcrypt
COPY apps/api/ .
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /workspace/apps/api/package.json ./package.json
COPY --from=build --chown=node:node /workspace/apps/api/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/apps/api/dist ./dist
COPY --from=build --chown=node:node /workspace/packages/llm/package.json /workspace/packages/llm/dist /packages/llm/
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
