FROM node:24-alpine3.21

WORKDIR /app

COPY ./transactionServer/package*.json ./
RUN npm install

EXPOSE 4001

COPY ./transactionServer .

CMD ["npm", "start"]