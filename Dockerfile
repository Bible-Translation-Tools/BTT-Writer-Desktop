FROM node:16.16.0

RUN apt update \
 && apt upgrade -y \
 && apt install -y \
        libasound2-dev \
        libatk-bridge2.0-dev \
        libcanberra-gtk-dev \
        libdrm-dev \
        libgconf2-dev \
        libgtk-3-dev \
        libnss3-dev \
        libxshmfence-dev \
        libxss-dev \
        libxtst-dev

WORKDIR /app

COPY package.json ./

RUN npm install -g bower \
 && npm install -g gulp \
 && npm install

COPY . .

RUN bower install --allow-root
RUN gulp prince

VOLUME /root

CMD npm start
