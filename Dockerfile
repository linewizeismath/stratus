FROM node:22-alpine

WORKDIR /app/api

COPY api/package.json ./
RUN npm install --omit=dev

COPY api/ ./

# Railway supplies PORT; the source currently defaults to 3001.
RUN sed -i 's/const PORT = 3001;/const PORT = Number(process.env.PORT || 3001);/' api.js

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "bootstrap.js"]
