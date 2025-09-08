#!/bin/sh


if [ ! -z "$OSC_HOSTNAME" ]; then
  SERVER_API_URL="https://$OSC_HOSTNAME"
  RENDERER_API_URL="wss://$OSC_HOSTNAME"
else
  SERVER_API_URL="http://localhost:8080"
  RENDERER_API_URL="ws://localhost:8080"
fi
# Replace SERVER_API_URL in App.jsx
sed -i "s|const SERVER_API_URL = .*|const SERVER_API_URL = \"$SERVER_API_URL\";|g" controller/src/App.jsx
sed -i "s|const serverApiUrl = .*|const serverApiUrl = \"$SERVER_API_URL\";|g" renderer/using-layers/renderer.html
sed -i "s|const rendererApiUrl = .*|const rendererApiUrl = \"$RENDERER_API_URL\";|g" renderer/using-layers/renderer.html
sed -i "s|http://localhost:8080/|$SERVER_API_URL/|g" server/public/index.html

npm install
npm run build

exec "$@"