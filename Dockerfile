FROM node:20-slim

# Install Chromium, fonts/libs, and tzdata for timezone support
RUN apt-get update && apt-get install -y \
  chromium \
  fonts-liberation \
  libatk-bridge2.0-0 libnss3 libx11-xcb1 libxcb-dri3-0 libxcomposite1 libxdamage1 \
  libxfixes3 libxrandr2 libgbm1 libxkbcommon0 \
  tzdata \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Ensure Puppeteer uses system Chromium and skips downloading
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NODE_ENV=production
# Set timezone to Europe/Dublin to align date formatting and time parsing
ENV TZ=Europe/Dublin

CMD ["node", "index.js"]


