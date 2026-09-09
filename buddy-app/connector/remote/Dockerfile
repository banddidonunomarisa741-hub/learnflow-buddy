FROM node:24-bookworm-slim
WORKDIR /app/service
COPY service/package.json service/package-lock.json ./
RUN npm ci --omit=dev
WORKDIR /app
COPY service/ ./service/
COPY assets/ ./assets/
RUN node service/ui/build-ui.mjs && mkdir -p /data && chown node:node /data
USER node
ENV LF_HOST=0.0.0.0 LF_PORT=4318 LF_DATA_DIR=/data
EXPOSE 4318
CMD ["node", "service/server.mjs", "--production"]
