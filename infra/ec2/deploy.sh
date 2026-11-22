#!/usr/bin/env bash
set -euo pipefail
cd /opt/semh

region=${1:?AWS region is required}
app_image=${2:?App image digest is required}
public_url=${3:?HTTPS product URL is required}
[[ "$region" =~ ^[a-z0-9-]+$ ]]
[[ "$app_image" =~ ^([A-Za-z0-9.-]+)/semh-app@sha256:[0-9a-f]{64}$ ]]
registry=${BASH_REMATCH[1]}
[[ "$public_url" =~ ^https://([A-Za-z0-9.-]+)$ ]]
host=${BASH_REMATCH[1]}
test -r .env.production
test -r tls/fullchain.pem
test -r tls/privkey.pem
umask 077

exec 9>.deploy.lock
flock 9

next="$(mktemp .release.XXXXXXXX)"
docker_config="$(mktemp -d)"
trap 'rm -f "$next"; rm -rf "$docker_config"' EXIT
printf 'APP_IMAGE=%s\n' "$app_image" > "$next"

export DOCKER_CONFIG="$docker_config"
aws ecr get-login-password --region "$region" |
  docker login --username AWS --password-stdin "$registry"

compose() {
  docker compose --project-name semh --env-file .env.production --env-file "$next" -f compose.production.yaml "$@"
}

compose config --quiet
compose pull app
compose run --rm --no-deps --pull never --user node --env-from-file .env.production app sh -ec '
  test -n "$DATABASE_URL_UNPOOLED" || { echo "DATABASE_URL_UNPOOLED is required for production migrations" >&2; exit 1; }
  exec npm run db:migrate -w @semh/api
'
compose up -d --wait --wait-timeout 120 app
compose exec -T app nginx -s reload
curl --resolve "$host:443:127.0.0.1" --retry 3 --retry-all-errors --max-time 5 -fsS "$public_url/api/health"
curl --resolve "$host:443:127.0.0.1" --max-time 5 -fsS -o /dev/null "$public_url/login"
curl --resolve "$host:443:127.0.0.1" --max-time 5 -fsS -o /dev/null "$public_url/register"

if [[ -f .release.env ]]; then cp .release.env .release.previous.env; fi
mv -f "$next" .release.env
printf 'Deployed app=%s\n' "$app_image"
