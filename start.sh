#!/usr/bin/env bash
echo "$(date +"%F %T.%N") Script started"
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
echo "$(date +"%F %T.%N") cd aiyiny"
cd aiyiny
echo "$(date +"%F %T.%N") node save.js"
node save.js
echo "$(date +"%F %T.%N") cd .."
cd ..
echo "$(date +"%F %T.%N") node download.js"
node download.js
echo "$(date +"%F %T.%N") cd downloads"
cd downloads
echo "$(date +"%F %T.%N") ./split-wav-to-flac.sh"
./split-wav-to-flac.sh
echo "$(date +"%F %T.%N") cd .."
cd ..
echo "$(date +"%F %T.%N") node upload.js"
node upload.js
echo "$(date +"%F %T.%N") Script completed"
