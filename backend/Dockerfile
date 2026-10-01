FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production DB_PATH=/data/digilago.db PORT=3000
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .
RUN mkdir -p /data && rm -rf data
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/connexion >/dev/null || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
