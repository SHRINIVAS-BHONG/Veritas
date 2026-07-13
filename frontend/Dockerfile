# Build Stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package configurations
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy client source code
COPY . .

# Compile TypeScript and bundle production assets
RUN npm run build

# Nginx Server Stage
FROM nginx:alpine

# Copy compiled static assets to Nginx html directory
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
