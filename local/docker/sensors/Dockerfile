FROM node:20-alpine

WORKDIR /app

COPY src/sensors ./src/sensors
COPY package*.json ./

RUN npm install

CMD ["node", "src/sensors/iot-gateway.js"]