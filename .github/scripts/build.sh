#!/bin/bash
#
# Builds and packages BTT-Writer for ONE platform, on that platform's own runner.
#
#   Usage: build.sh <win|linux|osx>
#
# Runs under bash on every runner (Git Bash on Windows). Platform tooling is
# installed by the workflow beforehand:
#   win   - Inno Setup 5.5.3 on PATH (iscc)
#   linux - fakeroot + dpkg (for the .deb)
#   osx   - nothing extra (dmg tooling comes from npm)
#
# Unit and e2e tests run in the separate `test` job of the workflow.

set -x
set -e

TARGET="$1"
case "$TARGET" in
    win|linux|osx) ;;
    *)
        echo "Usage: $0 <win|linux|osx>" >&2
        exit 1
        ;;
esac

if [ "$TARGET" = "win" ]; then
    # The .iss script uses preprocessor directives, so ISPP must be present
    iscc '/?' 2> /dev/null | grep "Inno Setup Preprocessor"
fi

# Stamp the build number into package.json: 1.6.0+x -> 1.6.0+<run number>
PACKAGEJSONVER=$(jq --raw-output '.version' package.json)
ENVVER="${PACKAGEJSONVER%%+*}+${GITHUB_RUN_NUMBER}"
export ENVVER
jq --arg variable "$ENVVER" '.version = $variable' package.json > package.json.tmp && mv package.json.tmp package.json

if [ "$TARGET" = "win" ]; then
    # electron-installer-debian declares os: [darwin, linux] and npm refuses to
    # install it on win32 (EBADPLATFORM). Not needed for the Windows build, and
    # gulpfile.js only requires it inside the .deb release step.
    jq 'del(.devDependencies["electron-installer-debian"])' package.json > package.json.tmp && mv package.json.tmp package.json
fi

npm install

# Resource index (shared by every platform)
curl --fail --silent --show-error --location \
    --output resource_containers.zip \
    "https://btt-writer-resources.s3.amazonaws.com/resource_containers.zip"
rm -rf ./src/index
mkdir -p ./src/index
if command -v unzip > /dev/null 2>&1; then
    unzip -qq resource_containers.zip -d ./src/index/
else
    # Git Bash on the Windows runner has no unzip; 7-Zip is on the image
    7z x -y -o./src/index resource_containers.zip > /dev/null
fi
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

# The prince task swallows download errors, so verify the binary this
# platform actually ships (paths per src/js/prince-packager.js info())
npx gulp prince
case "$TARGET" in
    win)   test -f src/prince/win/bin/prince.exe ;;
    linux) test -x src/prince/linux/lib/prince/bin/prince ;;
    osx)   test -x src/prince/osx/lib/prince/bin/prince ;;
esac

npx gulp build "--$TARGET"
npx gulp release "--$TARGET"

ls -la release/
