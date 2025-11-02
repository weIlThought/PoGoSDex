# SQL Schema für PoGoSDex Admin

Dieses Verzeichnis enthält SQL-Skripte, um die notwendigen Tabellen in MySQL zu erstellen und diese aus den JSON-Dateien zu befüllen (Seeding).

## Dateien

- `001_create_tables.sql` – legt die Tabellen `users`, `devices`, `news`, `coords` an.
- `002_indexes.sql` – ergänzt sinnvolle Indizes idempotent (über information_schema-Check + PREPARE/EXECUTE).
- `devices.sql` – befüllt die bestehende Tabelle `devices` mit Daten aus `data/devices.json`.
- `news.sql` – befüllt die bestehende Tabelle `news` mit Daten aus `data/news.json`.
- `coords.sql` – befüllt die bestehende Tabelle `coords` mit Daten aus `data/coords.json` (Category: top10/notable/raid_spots).

Hinweise:

- Die Seeding-Skripte führen `DELETE FROM <table>` aus und fügen dann die Daten in einer Transaktion ein (kein ALTER/CREATE der Zieltabellen).
- Die JSON-Felder werden sinnvoll auf die bestehenden Spalten gemappt:
  - devices: `name` (Brand + Model), `description` (zusammengefasste Metadaten/Notes), `image_url` NULL, `status` = 'active'.
  - news: `title`, `content`, `image_url` NULL, `published` aus Vorhandensein von `publishedAt` abgeleitet.
  - coords: `category`, `name`, `lat`, `lng`, `note` (leerer String wenn nicht vorhanden), `tags` als JSON-Array.

## Generierung der Seeding-SQL-Dateien

Die Dateien `devices.sql`, `news.sql` und `coords.sql` werden automatisch aus den JSON-Dateien im Ordner `data/` erzeugt.

```powershell
node server/scripts/generate_sql_from_json.cjs
```

Ausgabeziel ist `server/sql/`. Zeichensatz wird auf `utf8mb4` gesetzt und Einfüge-Operationen sind in einer Transaktion gekapselt.

## Ausführen (MySQL-CLI)

Windows PowerShell (aus dem Repo-Root oder beliebigem Verzeichnis; passe Host/Port/User/DB an):

```powershell
# Schema anlegen
mysql -h <HOST> -P <PORT> -u <USER> -p <DATENBANK> < .\server\sql\001_create_tables.sql

# Indizes anlegen
mysql -h <HOST> -P <PORT> -u <USER> -p <DATENBANK> < .\server\sql\002_indexes.sql

# (Optional) Seeding der Tabellen – Achtung: bestehende Daten werden gelöscht (DELETE)
mysql -h <HOST> -P <PORT> -u <USER> -p <DATENBANK> < .\server\sql\devices.sql
mysql -h <HOST> -P <PORT> -u <USER> -p <DATENBANK> < .\server\sql\news.sql
mysql -h <HOST> -P <PORT> -u <USER> -p <DATENBANK> < .\server\sql\coords.sql
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
