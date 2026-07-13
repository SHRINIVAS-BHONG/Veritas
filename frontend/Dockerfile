# Build Stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package configurations
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy client source code
COPY . .

# Accept API URL at build time (default: localhost for Docker Compose)
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

# Compile TypeScript and bundle production assets
RUN npm run build

# Nginx Server Stage
FROM nginx:alpine

# Copy compiled static assets to Nginx html directory
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
