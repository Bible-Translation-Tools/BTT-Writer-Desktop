FROM node:14

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
COPY npm-shrinkwrap.json ./

RUN npm install -g bower \
 && npm install -g gulp \
 && npm install

COPY . .

RUN bower install --allow-root
RUN gulp prince

VOLUME /root

CMD npm start
