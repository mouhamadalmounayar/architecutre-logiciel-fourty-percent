FROM node:20-alpine

# build arg: path to app within repository (example: src/preprocessing or src/postprocessing)
ARG APP_DIR=src/app
WORKDIR /usr/src/app

# copy only the app directory into the image
COPY ${APP_DIR} ./app

# If the app provides a package.json, install dependencies there
WORKDIR /usr/src/app/app
RUN if [ -f package.json ]; then npm install --omit=dev; fi

EXPOSE 3000
CMD ["node", "index.js"]
