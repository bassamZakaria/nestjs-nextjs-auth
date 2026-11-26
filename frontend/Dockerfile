FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# The /api rewrite destination is baked in by next build, so it must be set here, not at run time.
ARG API_URL=http://backend:4000
ENV API_URL=$API_URL
RUN npm run build && chown -R node:node .next
USER node
CMD ["npm", "start"]
