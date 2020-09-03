FROM node:6

RUN apt update \
 && apt upgrade -y \
 && apt install -y \
        libasound2-dev \
        libcanberra-gtk-dev \
        libgconf2-dev \
        libnss3-dev \
        libxss-dev \
        libxtst-dev

WORKDIR /app

COPY package*.json ./

RUN npm install -g bower \
 && npm install -g gulp \
 && npm install

COPY . .

RUN bower install --allow-root

VOLUME /root

CMD npm start
