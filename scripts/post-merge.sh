#!/bin/bash
set -e
pnpm install --frozen-lockfile
# Database migrations are intentionally excluded from post-merge.
# Apply migrations manually via the Replit PostgreSQL console.
# To sync the operational schema in development: pnpm --filter db push:ops
