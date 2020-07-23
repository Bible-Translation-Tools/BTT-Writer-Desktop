FROM node:6

RUN apt update \
 && apt upgrade -y \
 && apt install -y libxtst-dev libxss-dev libgconf2-dev libnss3-dev libasound2-dev

WORKDIR /app

COPY package*.json ./

RUN npm install -g bower \
 && npm install -g gulp \
 && npm install

COPY . .

RUN bower install --allow-root

VOLUME /root

CMD npm start
