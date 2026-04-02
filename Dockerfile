# Single origin: React UI + REST + WebSockets on PORT (default 4000).
# Build: docker build -t markflow .
# Run:   docker run -p 4000:4000 markflow
FROM node:20-alpine AS client-build
WORKDIR /build/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build
COPY --from=client-build /build/client/dist ./client-dist
ENV CLIENT_DIST=/app/client-dist
ENV PORT=4000
EXPOSE 4000
CMD ["node", "dist/index.js"]
