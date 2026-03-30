FROM node:20-alpine

WORKDIR /app

# Arguments for build time configuration
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Install dependencies  
COPY package*.json ./
RUN npm install

# Build the app
COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
