FROM node:20-alpine
WORKDIR /usr/src/app
COPY src/app ./app
RUN npm install mqtt
EXPOSE 3000
CMD ["node", "app/index.js"]
