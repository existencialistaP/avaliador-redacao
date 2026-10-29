# API somente (o front é estático). Build a partir da raiz do projeto.
FROM oven/bun:1-alpine

WORKDIR /app
COPY package.json ./
COPY server.ts ./
COPY src ./src

# Só a API: o front vai para um host estático.
ENV SERVE_FRONT=false
ENV PORT=8080
EXPOSE 8080

USER bun
CMD ["bun", "run", "server.ts"]
