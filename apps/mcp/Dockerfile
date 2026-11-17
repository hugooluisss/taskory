FROM node:24-alpine AS build
WORKDIR /app
COPY apps/mcp/package*.json ./
RUN npm ci
COPY apps/mcp/ ./
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3100
CMD ["node", "dist/src/main.js"]
