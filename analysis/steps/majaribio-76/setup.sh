# setup.sh <case-dir> <target> : fake HOME with compose dir in the shape of the 75 inventory
C="$1"; T="$2"; rm -rf "$C"; mkdir -p "$C/home/backups/daily" "$C/fk"
D="$C/home/lsms-deployment"; [ "$T" = staging ] && D="$C/home/lsms-staging"; mkdir -p "$D"
cat > "$D/.env" <<E
POSTGRES_DB=Lsms
POSTGRES_USER=postgres
POSTGRES_PASSWORD=pgsiri123
SERVER_PORT=8080
JWT_SECRET=jwtsiri456
JWT_EXPIRATION=86400000
ADMIN_EMAIL=admin@x.tz
ADMIN_PASSWORD=adminsiri789
DOCKERHUB_USERNAME=chiefmaster
DOCKERHUB_PASSWORD=hubsiri000
ROOT_EMAIL=root@system.com
FRONTEND_V3_VERSION=3.1.11
BACKEND_VERSION=2.3.0
E
cat > "$D/docker-compose.yml" <<'Y'
services:
  backend:
    image: chiefmaster/my-lsms-backend:${BACKEND_VERSION}
    environment:
      - SPRING_DATASOURCE_PASSWORD=${POSTGRES_PASSWORD}
      - JWT_SECRET=${JWT_SECRET}
      - JWT_EXPIRATION=${JWT_EXPIRATION}
      - ADMIN_EMAIL=${ADMIN_EMAIL}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
      - ROOT_EMAIL=${ROOT_EMAIL}
      - ROOT_PASSWORD=${ROOT_PASSWORD}
  frontend-v3:
    image: chiefmaster/lsms-frontend-v3:${FRONTEND_V3_VERSION}
Y
if [ "$T" = prod ]; then cp "$D/docker-compose.yml" "$D/docker-compose.aws.yml"; printf 'services:\n  nginx:\n    restart: always\n' > "$D/docker-compose.override.yml"; fi
echo 2.2.72 > "$D/.backend.prev"
echo 2.3.0 > "$C/fk/be"; echo 3.1.11 > "$C/fk/v3"; echo 135 > "$C/fk/fly"
printf 'chiefmaster/my-lsms-backend:2.3.0\nchiefmaster/lsms-frontend-v3:3.1.11\n' > "$C/fk/images"
head -c 6000000 /dev/zero > "$C/home/backups/daily/lsms_$(TZ=Africa/Dar_es_Salaam date +%Y%m%d)_0200.dump"
