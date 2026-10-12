#!/bin/sh
# Point d'entree du service compose `backup` (image alpine) : installe les outils puis lance
# backup.sh selon BACKUP_CRON (defaut 02:30 UTC chaque nuit) avec crond de busybox.
# BACKUP_RUN_NOW=true lance aussi une sauvegarde immediate au demarrage.
set -eu

PACKAGES="mariadb-client mariadb-connector-c gzip tar coreutils"
[ -n "${BACKUP_PASSPHRASE:-}" ] && PACKAGES="$PACKAGES gnupg"
[ -n "${S3_BUCKET:-}" ] && PACKAGES="$PACKAGES aws-cli"
# shellcheck disable=SC2086
apk add --no-cache $PACKAGES >/dev/null

# crond ne transmet pas l'environnement du conteneur : il est fige dans un fichier lu par la tache.
ENV_FILE=/tmp/backup.env
export -p | grep -E ' (DB_|BACKUP_|UPLOADS_DIR|KEEP_|S3_|AWS_)' > "$ENV_FILE"
chmod 600 "$ENV_FILE"

mkdir -p /etc/crontabs
echo "${BACKUP_CRON:-30 2 * * *} . $ENV_FILE && /bin/sh /opt/backup/backup.sh >> /proc/1/fd/1 2>&1" > /etc/crontabs/root

if [ "${BACKUP_RUN_NOW:-false}" = "true" ]; then
    . "$ENV_FILE" && /bin/sh /opt/backup/backup.sh
fi

echo "[backup] planification : ${BACKUP_CRON:-30 2 * * *} (UTC)"
exec crond -f -l 8
