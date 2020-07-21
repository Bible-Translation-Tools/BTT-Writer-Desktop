FROM node:12

RUN apt update
RUN apt upgrade -y

WORKDIR /app

COPY package*.json ./

RUN npm install -g bower
RUN npm install -g gulp
RUN npm install


RUN bower install --allow-root

RUN apt install -y libxtst-dev libxss-dev libgconf2-dev libnss3-dev libasound2-dev

COPY . .

CMD npm start
