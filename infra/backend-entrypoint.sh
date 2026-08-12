#!/bin/sh
set -eu

cd /app/apps/backend
npx prisma migrate deploy
exec node dist/src/main.js
