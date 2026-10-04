#!/bin/sh
# Execute une seule fois, a la creation du volume MySQL : base dediee aux tests de l'API.
set -e
mysql -uroot -p"$MYSQL_ROOT_PASSWORD" <<SQL
CREATE DATABASE IF NOT EXISTS hope_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON hope_test.* TO '$MYSQL_USER'@'%';
SQL
