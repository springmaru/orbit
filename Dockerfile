FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY README.md ./

RUN npm run build
RUN mkdir -p /app/data

CMD ["npm", "run", "start"]

