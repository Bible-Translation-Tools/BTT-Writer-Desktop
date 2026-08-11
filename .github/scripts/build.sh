#!/bin/bash

set -x
set -e

brew install --cask wine-stable
brew install fakeroot
brew install dpkg

wine --version

#update version number in package.json with build number
PACKAGEJSONVER=$(cat package.json | jq --compact-output --raw-output '.version') && VER_ARRAY=($(echo $PACKAGEJSONVER | tr "+" "\n")) && ENVVER="${VER_ARRAY[0]}+$GITHUB_RUN_NUMBER"
export ENVVER
cat package.json | jq --arg variable "$ENVVER" '.version = $variable' > package.json.tmp && cp package.json.tmp package.json && rm package.json.tmp

# expose the built version to later jobs (windows installer build/signing)
if [ -n "$GITHUB_OUTPUT" ]; then echo "APP_VERSION=$ENVVER" >> "$GITHUB_OUTPUT"; fi

npm install
npm test
npx gulp test
wget --no-verbose "https://btt-writer-resources.s3.amazonaws.com/resource_containers.zip"
if [ -f resource_containers.zip ]; then rm -r ./src/index; fi
unzip -qq resource_containers.zip -d ./src/index/
test -f src/index/index.sqlite
test -d src/index/resource_containers
rm src/index/resource_containers/en_ta-audio_vol2.tsrc
rm src/index/resource_containers/en_ta-checking_vol1.tsrc
rm src/index/resource_containers/en_ta-checking_vol2.tsrc
rm src/index/resource_containers/en_ta-gateway_vol3.tsrc
rm src/index/resource_containers/en_ta-intro_vol1.tsrc
rm src/index/resource_containers/en_ta-process_vol1.tsrc
rm src/index/resource_containers/en_ta-translate_vol1.tsrc
rm src/index/resource_containers/en_ta-translate_vol2.tsrc
npx bower install
test -d src/components
npx gulp prince
test -d src/prince
npx gulp build --win
npx gulp build --linux
npx gulp build --osx
# TRICKY: the windows installer is built on a windows runner instead, so that both the
# packaged app binaries and the installer itself can be code signed (see sign-windows job).
npx gulp release --linux --osx
