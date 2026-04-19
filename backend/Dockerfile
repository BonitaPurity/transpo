FROM node:18-alpine

# Production-ready backend Dockerfile
# Optimized for asynchronous PostgreSQL driver (pg)

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000

ENV NODE_ENV=production

CMD ["npm", "start"]
