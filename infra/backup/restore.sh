#!/bin/sh
# Restauration d'une sauvegarde produite par backup.sh.
#
#   infra/backup/restore.sh --db backups/daily/db-20261012-023000.sql.gz[.gpg|.enc] \
#       [--uploads backups/daily/uploads-20261012-023000.tar.gz[.gpg|.enc]] \
#       [--target-db hope_restore_test] [--uploads-dir /tmp/uploads-restore] [--yes]
#
# - Dechiffre automatiquement (.gpg / .enc) avec BACKUP_PASSPHRASE ; verifie l'empreinte .sha256 si presente.
# - Par defaut, la base cible est DB_NAME : restaurer d'abord dans une base de test (--target-db) pour
#   valider la sauvegarde (voir README, procedure de test de restauration).
# - Ecraser la base courante (cible = DB_NAME) exige --yes.
# - La creation de la base cible exige un compte ayant le droit CREATE (ex. root : DB_USER=root).
set -eu
# shellcheck disable=SC3040
(set -o pipefail 2>/dev/null) && set -o pipefail

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-hope}"
DB_NAME="${DB_NAME:-hope_platform}"
DB_FILE=""
UPLOADS_FILE=""
TARGET_DB=""
TARGET_UPLOADS="${UPLOADS_DIR:-}"
CONFIRMED=0

while [ $# -gt 0 ]; do
    case "$1" in
        --db) DB_FILE="$2"; shift 2 ;;
        --uploads) UPLOADS_FILE="$2"; shift 2 ;;
        --target-db) TARGET_DB="$2"; shift 2 ;;
        --uploads-dir) TARGET_UPLOADS="$2"; shift 2 ;;
        --yes) CONFIRMED=1; shift ;;
        -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
        *) echo "Option inconnue : $1" >&2; exit 1 ;;
    esac
done

TARGET_DB="${TARGET_DB:-$DB_NAME}"
[ -n "$DB_FILE" ] || [ -n "$UPLOADS_FILE" ] || { echo "Indiquer --db et/ou --uploads." >&2; exit 1; }
if [ -z "${DB_PASSWORD:-}" ] && [ -n "$DB_FILE" ]; then
    echo "DB_PASSWORD manquant." >&2
    exit 1
fi
export MYSQL_PWD="${DB_PASSWORD:-}"

log() { echo "[restore] $*"; }

verify() {
    if [ -f "$1.sha256" ]; then
        (cd "$(dirname "$1")" && sha256sum -c "$(basename "$1").sha256" >/dev/null) || { echo "Empreinte invalide : $1" >&2; exit 1; }
        log "Empreinte SHA-256 verifiee : $(basename "$1")"
    else
        log "Pas d'empreinte pour $(basename "$1") (non verifiee)"
    fi
}

# Ecrit le contenu dechiffre (mais encore compresse) sur la sortie standard.
decrypt() {
    case "$1" in
        *.gpg)
            [ -n "${BACKUP_PASSPHRASE:-}" ] || { echo "BACKUP_PASSPHRASE requis pour $1" >&2; exit 1; }
            printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 0 -d "$1" ;;
        *.enc)
            [ -n "${BACKUP_PASSPHRASE:-}" ] || { echo "BACKUP_PASSPHRASE requis pour $1" >&2; exit 1; }
            openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$1" ;;
        *) cat "$1" ;;
    esac
}

if [ -n "$DB_FILE" ]; then
    [ -f "$DB_FILE" ] || { echo "Fichier introuvable : $DB_FILE" >&2; exit 1; }
    verify "$DB_FILE"
    if [ "$TARGET_DB" = "$DB_NAME" ] && [ "$CONFIRMED" -ne 1 ]; then
        echo "La base cible est la base courante ($DB_NAME) : ses donnees seront REMPLACEES." >&2
        echo "Relancer avec --yes pour confirmer, ou --target-db <base_de_test> pour un essai." >&2
        exit 1
    fi
    log "Restauration de $(basename "$DB_FILE") dans $TARGET_DB ($DB_HOST:$DB_PORT)"
    mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" \
        -e "CREATE DATABASE IF NOT EXISTS \`$TARGET_DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
    decrypt "$DB_FILE" | gunzip -c | mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" \
        --default-character-set=utf8mb4 "$TARGET_DB"
    # Controle minimal : tables principales et nombre de dons.
    mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" "$TARGET_DB" -e \
        "SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM payments) AS payments,
                (SELECT MAX(name) FROM schema_migrations) AS last_migration"
fi

if [ -n "$UPLOADS_FILE" ]; then
    [ -f "$UPLOADS_FILE" ] || { echo "Fichier introuvable : $UPLOADS_FILE" >&2; exit 1; }
    [ -n "$TARGET_UPLOADS" ] || { echo "Indiquer --uploads-dir (ou UPLOADS_DIR)." >&2; exit 1; }
    verify "$UPLOADS_FILE"
    mkdir -p "$TARGET_UPLOADS"
    log "Extraction de $(basename "$UPLOADS_FILE") dans $TARGET_UPLOADS"
    decrypt "$UPLOADS_FILE" | tar -xzf - -C "$TARGET_UPLOADS"
    log "$(find "$TARGET_UPLOADS" -type f | wc -l | tr -d ' ') fichier(s) restaure(s)"
fi

log "Termine."
