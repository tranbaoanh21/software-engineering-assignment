#!/usr/bin/env bash
set -euo pipefail

package_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd /opt/semh

region=${1:?AWS region is required}
app_image=${2:?App image digest is required}
public_url=${3:?HTTPS product URL is required}
[[ "$region" =~ ^[a-z0-9-]+$ ]]
[[ "$app_image" =~ ^([A-Za-z0-9.-]+)/semh-app@sha256:([0-9a-f]{64})$ ]]
registry=${BASH_REMATCH[1]}
digest=${BASH_REMATCH[2]}
[[ "$public_url" =~ ^https://([A-Za-z0-9.-]+)$ ]]
host=${BASH_REMATCH[1]}
test -r .env.production
systemctl is-active --quiet nginx.service
nginx -t
umask 077

exec 9>.deploy.lock
flock 9

work="$(mktemp -d "$PWD/.deploy.XXXXXXXX")"
web_root=/var/www/semh
web_release="$web_root/releases/$digest"
previous_web="$(readlink "$web_root/current" || true)"
asset_stage=
asset_container=
switching=false
compose=(docker compose --project-name semh --project-directory "$PWD" --env-file .env.production)
candidate=("${compose[@]}" --env-file "$work/release.env" -f "$package_dir/compose.production.yaml")
previous=()

switch_web() {
  ln -sfnT -- "$1" "$web_root/.current.next" &&
  mv -Tf -- "$web_root/.current.next" "$web_root/current"
}

cleanup() {
  local status=$?
  trap - EXIT
  set +e
  if [[ "$switching" == true ]]; then
    echo 'Release failed. Restoring previous app and frontend.' >&2
    if [[ -n "$previous_web" ]]; then
      switch_web "$previous_web" || echo 'Could not restore the previous frontend.' >&2
    else
      rm -f -- "$web_root/current"
    fi
    if (("${#previous[@]}")); then
      cp -- "$work/previous.yaml" compose.production.yaml
      cp -- "$work/previous.env" .release.env
      "${previous[@]}" up -d --pull never --wait --wait-timeout 120 app ||
        echo 'The previous container did not recover.' >&2
    else
      "${candidate[@]}" stop app
      rm -f -- .release.env
    fi
  fi
  if [[ -n "$asset_container" ]]; then docker rm "$asset_container" >/dev/null; fi
  if [[ -n "$asset_stage" ]]; then rm -rf -- "$asset_stage"; fi
  rm -f -- "$web_root/.current.next"
  rm -rf -- "$work"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if [[ -r .release.env ]]; then
  cp -- .release.env "$work/previous.env"
  cp -- compose.production.yaml "$work/previous.yaml"
  previous=("${compose[@]}" --env-file "$work/previous.env" -f "$work/previous.yaml")
  active_files="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}' semh-app-1 2>/dev/null || true)"
  if [[ ",$active_files," == *",/opt/semh/compose.host-nginx.yaml,"* ]]; then
    # The first host-Nginx release can roll back to the manually migrated container.
    previous+=(-f /opt/semh/compose.host-nginx.yaml)
  fi
  "${previous[@]}" config --quiet
fi

printf 'APP_IMAGE=%s\n' "$app_image" > "$work/release.env"
cp -- "$package_dir/compose.production.yaml" "$work/compose.production.yaml"
export DOCKER_CONFIG="$work/docker"
mkdir -- "$DOCKER_CONFIG"
aws ecr get-login-password --region "$region" |
  docker login --username AWS --password-stdin "$registry"

"${candidate[@]}" config --quiet
"${candidate[@]}" pull app
install -d -m 0755 -- "$web_root/releases"
if [[ ! -d "$web_release" ]]; then
  asset_stage="$(mktemp -d "$web_root/releases/.build.XXXXXXXX")"
  asset_container="$(docker create "$app_image")"
  docker cp "$asset_container:/app/apps/web/dist/." "$asset_stage/"
  test -s "$asset_stage/index.html"
  test -d "$asset_stage/assets"
  chmod 0755 "$asset_stage"
  mv -T -- "$asset_stage" "$web_release"
  asset_stage=
fi
runuser -u www-data -- test -r "$web_release/index.html"

"${candidate[@]}" run --rm --no-deps --pull never --user node --env-from-file .env.production app sh -ec '
  test -n "$DATABASE_URL_UNPOOLED" || { echo "DATABASE_URL_UNPOOLED is required for production migrations" >&2; exit 1; }
  exec npm run db:migrate -w @semh/api
'

switching=true
"${candidate[@]}" up -d --pull never --wait --wait-timeout 120 app
switch_web "$web_release"

https_check=(curl --resolve "$host:443:127.0.0.1" --max-time 5 -fsS)
"${https_check[@]}" --retry 3 --retry-all-errors "$public_url/api/health"
"${https_check[@]}" "$public_url/login" | cmp -s "$web_release/index.html" -
"${https_check[@]}" -o /dev/null "$public_url/register"

if [[ -r "$work/previous.env" ]]; then cp -- "$work/previous.env" .release.previous.env; fi
mv -f -- "$work/compose.production.yaml" compose.production.yaml
mv -f -- "$work/release.env" .release.env
switching=false
printf '\nDeployed app=%s\n' "$app_image"
