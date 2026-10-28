#!/bin/sh
# Sauvegarde HOPE International Project : base MySQL + images televersees.
#
#   - mysqldump --single-transaction (coherent sans bloquer l'API), compresse (gzip) ;
#   - archive tar.gz du dossier des uploads ;
#   - chiffrement optionnel (BACKUP_PASSPHRASE) : gpg si disponible, sinon openssl AES-256 (PBKDF2) ;
#   - empreintes SHA-256 a cote de chaque fichier ;
#   - rotation locale : KEEP_DAILY sauvegardes quotidiennes (7), KEEP_WEEKLY hebdomadaires (4, le dimanche) ;
#   - envoi optionnel vers un stockage S3-compatible si S3_BUCKET est defini (aws-cli requis).
#
# Usage : infra/backup/backup.sh   (variables ci-dessous ; service compose `backup`, profil backup)
# Ne pas lancer sur une base de developpement partagee sans le vouloir : le dump lit toute la base.
set -eu
# shellcheck disable=SC3040
(set -o pipefail 2>/dev/null) && set -o pipefail

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-hope}"
DB_NAME="${DB_NAME:-hope_platform}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
UPLOADS_DIR="${UPLOADS_DIR:-apps/api/uploads}"
KEEP_DAILY="${KEEP_DAILY:-7}"
KEEP_WEEKLY="${KEEP_WEEKLY:-4}"
S3_PREFIX="${S3_PREFIX:-hope-backups}"

if [ -z "${DB_PASSWORD:-}" ]; then
    echo "DB_PASSWORD manquant." >&2
    exit 1
fi
# Mot de passe transmis par l'environnement (jamais visible dans la liste des processus).
export MYSQL_PWD="$DB_PASSWORD"

log() { echo "[backup $(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

STAMP="$(date -u +%Y%m%d-%H%M%S)"
DAILY="$BACKUP_DIR/daily"
WEEKLY="$BACKUP_DIR/weekly"
mkdir -p "$DAILY" "$WEEKLY"
umask 077

# Chiffre un fichier si BACKUP_PASSPHRASE est defini ; affiche le nom du fichier final.
encrypt() {
    file="$1"
    if [ -z "${BACKUP_PASSPHRASE:-}" ]; then
        echo "$file"
        return
    fi
    if command -v gpg >/dev/null 2>&1; then
        printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 0 \
            --symmetric --cipher-algo AES256 -o "$file.gpg" "$file"
        rm -f "$file"
        echo "$file.gpg"
    elif command -v openssl >/dev/null 2>&1; then
        openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -in "$file" -out "$file.enc"
        rm -f "$file"
        echo "$file.enc"
    else
        echo "BACKUP_PASSPHRASE defini mais ni gpg ni openssl ne sont installes." >&2
        exit 1
    fi
}

checksum() {
    (cd "$(dirname "$1")" && sha256sum "$(basename "$1")" > "$(basename "$1").sha256")
}

# ---------- Base de donnees ----------
DB_FILE="$DAILY/db-$STAMP.sql.gz"
log "Dump de $DB_NAME ($DB_HOST:$DB_PORT)"
mysqldump --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" \
    --single-transaction --quick --routines --triggers --no-tablespaces \
    --default-character-set=utf8mb4 "$DB_NAME" | gzip -9 > "$DB_FILE"
DB_FILE="$(encrypt "$DB_FILE")"
checksum "$DB_FILE"

# ---------- Images televersees ----------
UPLOADS_FILE=""
if [ -d "$UPLOADS_DIR" ]; then
    UPLOADS_FILE="$DAILY/uploads-$STAMP.tar.gz"
    log "Archive de $UPLOADS_DIR"
    tar -czf "$UPLOADS_FILE" -C "$UPLOADS_DIR" .
    UPLOADS_FILE="$(encrypt "$UPLOADS_FILE")"
    checksum "$UPLOADS_FILE"
else
    log "Dossier des uploads absent ($UPLOADS_DIR) : ignore"
fi

# ---------- Copie hebdomadaire (dimanche) ----------
if [ "$(date -u +%u)" = "7" ]; then
    log "Copie hebdomadaire"
    for file in "$DB_FILE" "$UPLOADS_FILE"; do
        [ -n "$file" ] && cp "$file" "$file.sha256" "$WEEKLY/"
    done
fi

# ---------- Rotation ----------
# Garde les N horodatages les plus recents d'un dossier (fichiers db-<stamp>.* et uploads-<stamp>.*).
rotate() {
    dir="$1"
    keep="$2"
    ls "$dir" | sed -n 's/^db-\([0-9]\{8\}-[0-9]\{6\}\)\..*/\1/p' | sort -ru | tail -n +"$((keep + 1))" | while read -r old; do
        log "Rotation : suppression de $dir/*-$old.*"
        rm -f "$dir"/db-"$old".* "$dir"/uploads-"$old".*
    done
}
rotate "$DAILY" "$KEEP_DAILY"
rotate "$WEEKLY" "$KEEP_WEEKLY"

# ---------- Envoi S3-compatible (optionnel) ----------
# Variables : S3_BUCKET, S3_PREFIX, S3_ENDPOINT (MinIO, Scaleway, OVH, Backblaze...), AWS_ACCESS_KEY_ID,
# AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION. La retention distante se regle par une regle de cycle
# de vie du bucket (ex. expiration a 35 jours pour daily/, 120 jours pour weekly/).
if [ -n "${S3_BUCKET:-}" ]; then
    if ! command -v aws >/dev/null 2>&1; then
        echo "S3_BUCKET defini mais aws-cli est absent." >&2
        exit 1
    fi
    set --
    [ -n "${S3_ENDPOINT:-}" ] && set -- --endpoint-url "$S3_ENDPOINT"
    for file in "$DB_FILE" "$UPLOADS_FILE"; do
        [ -n "$file" ] || continue
        for part in "$file" "$file.sha256"; do
            log "Envoi de $(basename "$part") vers s3://$S3_BUCKET/$S3_PREFIX/daily/"
            aws "$@" s3 cp --only-show-errors "$part" "s3://$S3_BUCKET/$S3_PREFIX/daily/$(basename "$part")"
        done
    done
fi

log "Termine : $(basename "$DB_FILE")${UPLOADS_FILE:+, $(basename "$UPLOADS_FILE")}"
