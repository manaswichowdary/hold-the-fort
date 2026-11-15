# Hold the Fort agent, deployed on Maritime.
# Contract: listens on $PORT, GET /health, POST /chat
FROM node:22-slim AS build
WORKDIR /app
COPY agent/package*.json ./
RUN npm ci
COPY agent/tsconfig.json ./
COPY agent/src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY agent/package.json ./
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/server.js"]
