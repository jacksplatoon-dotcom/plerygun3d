FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY multiplayer-server.cjs .
ENV PORT=8765
CMD ["node", "multiplayer-server.cjs"]