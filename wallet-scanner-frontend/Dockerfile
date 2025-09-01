# Use Node.js 18 (Alpine Linux) for a minimal image size
FROM node:18-alpine

# Set working directory inside the container
WORKDIR /app

# Install dependencies (copy package.json first for better caching)
COPY package.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose port 3000 for the Next.js dev server
EXPOSE 3000

# Start the Next.js app in development mode, binding to all interfaces
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]

