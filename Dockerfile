FROM node:18.12.0-alpine3.16
WORKDIR /app

COPY package*.json ./

RUN npm install -g nodemon

EXPOSE 8888

CMD ["nodemon", "app.js"]