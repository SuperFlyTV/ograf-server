# ---------- Build Stage ----------
FROM node:24-alpine AS builder

# Set working directory
WORKDIR /app

# Enable Corepack and prepare Yarn 4
RUN corepack enable && corepack prepare yarn@4.9.1 --activate

# Copy the entire repo
COPY . .

# Install all dependencies (incl. devDeps)
RUN yarn install --frozen-lockfile

RUN mkdir /app/namespaces

# Build the app
RUN yarn build

# Purge dev-dependencies:
RUN yarn workspaces focus -A --production


# Default command (adjust as needed)
# CMD ["yarn", "start"]

# EXPOSE 8080/tcp




# Create deploy-image:
FROM node:24-alpine

COPY --from=builder /app /app

WORKDIR /app/packages/server

# Enable Corepack and prepare Yarn 4
# RUN corepack enable && corepack prepare yarn@4.9.1 --activate

# ENV NAMESPACE_SETTINGS_NAMESPACE_PATH=/app/namespaces

EXPOSE 8080

# CMD ["yarn", "start"]
CMD ["node", "dist/main.js"]
