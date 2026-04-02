# Production image: static build + static server (no Vite dev server)
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# Docker Compose (UI :3000, API :4000): pass VITE_SERVER_URL=http://localhost:4000 so WS hits the API.
# Single-origin deploy (root Dockerfile / Render): leave unset so the client uses page origin.
ARG VITE_SERVER_URL=
ENV VITE_SERVER_URL=$VITE_SERVER_URL
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve@14
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
