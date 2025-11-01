PoGoSDex - PogoSDex-like design (Railway-ready). Deploy using Docker on Railway.

## Deployment & Cache-Busting

This project uses simple query-string cache busting for `output.css` and `main.js` in the static HTML files (`public/index.html`, `public/privacy.html`, `public/tos.html`).

### Bump asset version

- Automatically update the version query string to a new value (UTC timestamp by default):

```powershell
npm run bump:assets
```

- Or provide your own version explicitly (e.g., YYYYMMDD):

```powershell
node scripts/bump-asset-version.mjs 20251101
```

This replaces `/output.css?v=...` and `/main.js?v=...` in the HTML files.

### Cloudflare cache purge (recommended after deploy)

After a deploy or version bump, purge cached HTML/CSS/JS so clients get the latest files.

Options:

1. Cloudflare Dashboard

- Navigate to: Caching → Configuration → Purge Cache
- Use “Purge Everything” (simple) or “Custom Purge” with specific URLs, e.g.:
  - `https://<your-domain>/`
  - `https://<your-domain>/index.html`
  - `https://<your-domain>/privacy.html`
  - `https://<your-domain>/tos.html`
  - `https://<your-domain>/output.css?v=<newVersion>`
  - `https://<your-domain>/main.js?v=<newVersion>`

2. Cloudflare API (PowerShell example)

Create an API Token with “Zone.Cache Purge” permissions for your zone, then:

```powershell
# Set once per session
$env:CLOUDFLARE_API_TOKEN = "<YOUR_API_TOKEN>"
$zoneId = "<YOUR_ZONE_ID>"

# Purge Everything (fastest to avoid missing anything)
Invoke-RestMethod -Method POST `
	-Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/purge_cache" `
	-Headers @{ Authorization = "Bearer $env:CLOUDFLARE_API_TOKEN" } `
	-ContentType 'application/json' `
	-Body '{"purge_everything":true}'

# Or purge specific URLs
$urls = @(
	"https://<your-domain>/",
	"https://<your-domain>/index.html",
	"https://<your-domain>/privacy.html",
	"https://<your-domain>/tos.html",
	"https://<your-domain>/output.css?v=<newVersion>",
	"https://<your-domain>/main.js?v=<newVersion>"
)

Invoke-RestMethod -Method POST `
	-Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/purge_cache" `
	-Headers @{ Authorization = "Bearer $env:CLOUDFLARE_API_TOKEN" } `
	-ContentType 'application/json' `
	-Body (@{ files = $urls } | ConvertTo-Json)
```

### Browser Hard Reload

To bypass local cache during verification:

- Windows: Ctrl + Shift + R (oder Strg+F5 in vielen Browsern)
- Öffne DevTools → Network → Disable cache (aktiv während DevTools geöffnet)

### Post-deploy checks

- In DevTools → Network prüfen, dass `index.html`, `privacy.html`, `tos.html` die URLs
  mit `?v=<newVersion>` für `main.js` und `output.css` referenzieren.
- In der Konsole verifizieren, dass keine alten Fehler (z. B. `LANG_LOCK` ReferenceError) auftauchen.

## CSP Hinweise

Die App sendet eine strikte Content-Security-Policy:

- `script-src 'self' https://cdn.jsdelivr.net` (DOMPurify via jsDelivr)
- `style-src 'self' 'unsafe-inline' https:` (für Google Fonts CSS)
- `font-src 'self' https://fonts.gstatic.com data:`

Inline-Injections von Drittanbietern (z. B. Schutz-/Analyse-Snippets) werden blockiert. Das ist erwartetes Verhalten und beeinträchtigt die Funktion nicht, solange die Kern-Skripte/CSS aus `self` und die erlaubten CDNs geladen werden.

## Troubleshooting (häufige Muster)

- Alte Konsole-Fehler (LANG_LOCK, fehlende Abschnitte, PGSharp-Nullzugriff):
  - Ursache: veraltete `main.js` im Cache. Lösung: Version bump + Cloudflare Purge + Hard Reload.
- Google Fonts geblockt:
  - Prüfe, dass `font-src` `https://fonts.gstatic.com` erlaubt (Server sendet diesen Header).
- ToS/Privacy Inhalte überschrieben:
  - Beide Seiten sind mit `data-no-i18n` versehen bzw. i18n ist entsprechend zurückhaltend — falls Texte trotzdem verändert werden, prüfe individuelle Markup-Attribute.

## Adminpanel (Login, CRUD für Devices/News)

Dieses Repository enthält ein schlankes Adminpanel mit sicherem Login, JWT-Cookies und CSRF-Schutz. Es nutzt eine MySQL-Datenbank (z. B. über Railway).

### Endpunkte und Dateien

- Login-Seite: `GET /login.html` (öffentlich)
- Admin-Oberfläche: `GET /admin.html` (nur mit Login)
- Admin-Assets: `/admin.js`, `/admin.css` (nur mit Login)
- Auth API:
  - `POST /admin/login` – Login mit Benutzername/Passwort
  - `POST /admin/logout` – Logout
  - `GET /admin/me` – Session prüfen und CSRF-Token erneuern
- CRUD-API (auth + CSRF):
  - Devices: `GET /admin/api/devices`, `POST /admin/api/devices`, `PUT /admin/api/devices/:id`, `DELETE /admin/api/devices/:id`
  - News: `GET /admin/api/news`, `POST /admin/api/news`, `PUT /admin/api/news/:id`, `DELETE /admin/api/news/:id`

### Sicherheit

- Authentifizierung via JWT in httpOnly Cookie (`admintoken`) mit `SameSite=Lax`, `Secure` in Production.
- CSRF-Schutz: Double-Submit Cookie Muster (`csrf_token` Cookie + `X-CSRF-Token` Header bei schreibenden Requests).
- Login ist Rate-Limited. Keine Inline-Skripte (CSP-konform).

### Datenbank (MySQL)

Beim Start migriert der Server automatisch das Schema, falls Tabellen fehlen:

- `users (id, username, password_hash, ...)`
- `devices (id, name, description, image_url, status, created_at, updated_at)`
- `news (id, title, content, image_url, published, created_at, updated_at)`

Optionales Seeding eines Admin-Users per ENV (nur wenn beide gesetzt sind):

- `ADMIN_USERNAME` – Benutzername
- `ADMIN_PASSWORD_HASH` – Bcrypt-Hash für das Passwort

Erzeuge einen Bcrypt-Hash beispielsweise so (im `server`-Ordner):

```powershell
# Beispiel: Passwort "admin123" hashen
npm run hash:pw -- admin123
```

### Notwendige ENV Variablen (Railway)

- Bevorzugt: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`
- Alternativ (werden ebenfalls erkannt): `MYSQL_URL` oder `MYSQL_PUBLIC_URL`
- Railway-Keys werden unterstützt, falls gesetzt: `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`, `RAILWAY_PRIVATE_DOMAIN`, `RAILWAY_TCP_PROXY_DOMAIN`, `RAILWAY_TCP_PROXY_PORT`, `MYSQL_ROOT_PASSWORD`
- `JWT_SECRET` – starker geheimer Schlüssel für JWT
- (optional) `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` – initiales Admin-Seed

Hinweis: In Railway kannst du ENV-Referenzen wie `${{VAR}}` verwenden. Lokale `.env`-Dateien erweitern solche Referenzen nicht automatisch; verwende dort konkret aufgelöste Werte oder eine vollständige `MYSQL_URL`.

### Nutzung

1. ENV Variablen in Railway setzen (inkl. MySQL-Verbindungsdaten). Optional Admin-Seed angeben.
2. Deployen/Starten – der Server migriert DB automatisch.
3. `https://<domain>/login.html` aufrufen, einloggen, anschließend `admin.html` nutzen.
4. In der UI: Devices/News suchen, anlegen, bearbeiten, löschen. Logout über Button oben rechts.

### Hinweise

- Bild-Uploads sind als URL-Feld integriert. Ein echtes Datei-Upload-Backend kann später ergänzt werden (z. B. S3/Cloudflare R2 + Signierte Uploads).
- Pagination/Suche sind rudimentär (Query `?q=` und Limit/Offset intern begrenzt) – kann erweitert werden.

### Admin-CSS mit Tailwind bauen (optional)

Das Adminpanel verwendet eine separate `admin.css`. Standardmäßig ist das eine kleine, manuell gepflegte CSS-Datei. Falls du Tailwind dafür nutzen möchtest, ist die Pipeline vorbereitet:

- Quelle: `server/admin/styles.css` (enthält `@import 'tailwindcss'` + die bisherigen Admin-Regeln)
- Ziel: `server/admin/admin.css`

Build/Watch:

```powershell
# Nur Admin-CSS beobachten
npm run dev:admin

# Admin-CSS minifiziert bauen (z. B. für Deploy)
npm run build:admin
```

Hinweis: Die Tailwind-Content-Globs scannen auch `server/**/*.{html,js,...}` – Admin-HTML/-JS wird also berücksichtigt.
