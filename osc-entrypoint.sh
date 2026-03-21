#!/bin/bash
set -e

# Set graphics storage path to persistent volume
export GRAPHICS_STORAGE_PATH="${GRAPHICS_STORAGE_PATH:-/data/localGraphicsStorage}"
mkdir -p "$GRAPHICS_STORAGE_PATH"

# OSC_HOSTNAME → used by server.ts to inject the correct API URL into the controller UI
# (No export needed here; server.ts reads process.env.OSC_HOSTNAME directly)

# S3/MinIO sync for graphics storage
# Set S3_GRAPHICS_URL to enable bidirectional sync with an S3-compatible bucket
# Set S3_ENDPOINT_URL for MinIO or other non-AWS endpoints (e.g. https://minio.example.com)
ENDPOINT_ARG=""
if [ -n "$S3_ENDPOINT_URL" ]; then
  ENDPOINT_ARG="--endpoint-url $S3_ENDPOINT_URL"
  echo "[OSC] Using custom S3 endpoint: $S3_ENDPOINT_URL"
fi

SYNC_INTERVAL="${S3_SYNC_INTERVAL:-60}"

if [ -n "$S3_GRAPHICS_URL" ]; then
  echo "[OSC] Performing initial S3 graphics download from $S3_GRAPHICS_URL..."
  aws s3 sync "$S3_GRAPHICS_URL" "$GRAPHICS_STORAGE_PATH" $ENDPOINT_ARG 2>&1 | while IFS= read -r line; do
    echo "[S3 Graphics Init] $line"
  done

  echo "[OSC] Starting bidirectional S3 graphics sync (interval: ${SYNC_INTERVAL}s, source of truth: S3)"
  (
    while true; do
      sleep "$SYNC_INTERVAL"
      aws s3 sync "$GRAPHICS_STORAGE_PATH" "$S3_GRAPHICS_URL" $ENDPOINT_ARG 2>&1 | while IFS= read -r line; do
        echo "[S3 Graphics Upload] $line"
      done
      aws s3 sync "$S3_GRAPHICS_URL" "$GRAPHICS_STORAGE_PATH" --delete $ENDPOINT_ARG 2>&1 | while IFS= read -r line; do
        echo "[S3 Graphics Download] $line"
      done
    done
  ) &
fi

exec "$@"
