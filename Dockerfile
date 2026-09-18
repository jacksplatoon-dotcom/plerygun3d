FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY multiplayer-server.cjs ./
ENV PORT=8765
EXPOSE 8765
CMD ["node", "multiplayer-server.cjs"]
