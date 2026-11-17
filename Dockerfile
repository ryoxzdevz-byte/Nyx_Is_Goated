FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY . .
RUN pnpm install --frozen-lockfile && pnpm web:build

FROM node:22-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate
ENV NODE_ENV=production PORT=8787 HOST=0.0.0.0
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/tsconfig.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/electron ./electron
COPY --from=build /app/server ./server
COPY --from=build /app/dist ./dist
EXPOSE 8787
CMD ["pnpm", "api"]
