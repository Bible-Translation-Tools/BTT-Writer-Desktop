FROM node:20

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

# Install wine
RUN apt install -y software-properties-common
RUN dpkg --add-architecture i386 && \
    wget -nc https://dl.winehq.org/wine-builds/winehq.key && \
    apt-key add winehq.key && \
    add-apt-repository 'deb https://dl.winehq.org/wine-builds/debian/ bullseye main'
RUN apt-get update
RUN apt-get install -y --install-recommends wine innoextract

# Install InnoSetup
COPY scripts/innosetup/iscc /usr/local/bin/iscc
RUN chmod +x /usr/local/bin/iscc
COPY scripts/innosetup/innoinstall.sh /innoinstall.sh
RUN chmod +x /innoinstall.sh
RUN /bin/bash -c '/innoinstall.sh'
RUN rm /innoinstall.sh

WORKDIR /app

COPY package.json ./

RUN npm install -g bower \
 && npm install -g gulp \
 && npm install

# Install prince
COPY gulpfile.js ./
COPY src/js/lib ./src/js/lib
COPY src/js/prince-packager.js ./src/js/
RUN gulp prince

COPY . .

RUN chmod -R +x scripts/git/*.sh

RUN bower install --allow-root

VOLUME /root

CMD ["npm", "start"]