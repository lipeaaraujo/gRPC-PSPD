FROM node:24-alpine3.21

WORKDIR /app

COPY ./clientServer/package*.json ./
RUN npm install

EXPOSE 4000

COPY ./clientServer .

CMD ["sh", "-c", "npm run db:deploy && npm start"]