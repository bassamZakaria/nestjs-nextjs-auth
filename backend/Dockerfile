FROM node:22-slim
WORKDIR /app
COPY package*.json ./
# The test-only in-memory MongoDB would otherwise download a ~100 MB binary during npm ci.
ENV MONGOMS_DISABLE_POSTINSTALL=1
RUN npm ci
COPY . .
RUN npm run build
USER node
CMD ["node", "dist/main.js"]
