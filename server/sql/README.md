# SQL Schema für PoGoSDex Admin

Dieses Verzeichnis enthält SQL-Skripte, um die notwendigen Tabellen in MySQL zu erstellen.

## Dateien

- `001_create_tables.sql` – legt die Tabellen `users`, `devices`, `news` an.
- `002_indexes.sql` – ergänzt sinvolle Indizes.

Hinweis: Die Skripte erstellen keine Datenbank. Führe sie innerhalb deiner Ziel-Datenbank aus (z. B. `USE railway;`).

## Ausführen (MySQL-CLI)

Windows PowerShell (aus dem Repo-Root oder beliebigem Verzeichnis; passe Host/Port/User/DB an):

```powershell
# Tabellen anlegen
mysql -h <HOST> -P <PORT> -u <USER> -p <DATENBANK> < .\server\sql\001_create_tables.sql

# Indizes anlegen
mysql -h <HOST> -P <PORT> -u <USER> -p <DATENBANK> < .\server\sql\002_indexes.sql
```

Beispiel mit Railway (mit deinen ENV-Werten):

```powershell
# Falls du eine URL hast (MYSQL_URL), kannst du auch in der Bash-Umgebung folgendes Schema nutzen:
# mysql "mysql://<USER>:<PASS>@<HOST>:<PORT>/<DB>" < server/sql/001_create_tables.sql
```

## Hinweise

- Zeichensatz: Alle Tabellen werden mit `utf8mb4` erstellt.
- Engine: `InnoDB`.
- `users.username` ist eindeutig (`UNIQUE`).
- Für `users.email` ist kein UNIQUE erzwungen (kann optional hinzugefügt werden, siehe `002_indexes.sql`).
- `updated_at` wird automatisch per `ON UPDATE CURRENT_TIMESTAMP` gepflegt.
