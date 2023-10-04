#!/bin/bash

set -x

#sudo add-apt-repository --yes ppa:ubuntu-wine/ppa
sudo dpkg --add-architecture i386
sudo add-apt-repository --yes ppa:arx/release
sudo apt-get update -d
sudo apt-get install -y -q innoextract wine32 wine64 software-properties-common
wine --version
innoextract --version

#update version number in package.json with build number
PACKAGEJSONVER=$(cat package.json | jq --compact-output --raw-output '.version') && VER_ARRAY=($(echo $PACKAGEJSONVER | tr "+" "\n")) && ENVVER="${VER_ARRAY[0]}+$GITHUB_RUN_NUMBER"
export ENVVER
cat package.json | jq --arg variable "$ENVVER" '.version = $variable' > package.json.tmp && cp package.json.tmp package.json && rm package.json.tmp

"./scripts/innosetup/innoinstall.sh"
sudo cp scripts/innosetup/iscc /usr/local/bin/iscc
iscc /? 2> /dev/null | grep "Inno Setup Preprocessor"
npm install
patch --forward --reject-file=- node_modules/gogs-client/lib/request.js < gogs-client-lib-request.diff || ( EXIT_CODE=$?; if [ $EXIT_CODE -gt 1 ]; then exit $EXIT_CODE; fi )
npm install gulp -g
npm install bower -g
npm test
wget --no-verbose "https://btt-writer-resources.s3.amazonaws.com/resource_containers.zip"
if [ -f resource_containers.zip ]; then rm -r ./src/index; fi
unzip -qq resource_containers.zip -d ./src/index/
test -f src/index/index.sqlite
test -d src/index/resource_containers
bower install
test -d src/components
gulp prince
test -d src/prince
gulp build --win
gulp build --linux
gulp build --osx
gulp release
