FROM node:20-slim

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy prisma schema first for generation
COPY prisma ./prisma/
RUN npx prisma generate

# Copy the rest
COPY . .

EXPOSE 4000

CMD ["npm", "start"]
