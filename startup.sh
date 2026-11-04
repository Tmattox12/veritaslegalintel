#!/bin/sh
# Azure App Service (Linux) startup. Installs dependencies once into the
# persistent app folder (on Linux, so sqlite3 gets its Linux binary), then
# starts the server. Later restarts skip the install.
cd /home/site/wwwroot
if [ -L node_modules ]; then rm node_modules; fi
if [ ! -f node_modules/sqlite3/build/Release/node_sqlite3.node ] || [ ! -d node_modules/express ]; then
  npm ci --omit=dev --no-audit --no-fund
fi
exec node server/index.js
