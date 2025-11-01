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

1) Cloudflare Dashboard
- Navigate to: Caching → Configuration → Purge Cache
- Use “Purge Everything” (simple) or “Custom Purge” with specific URLs, e.g.:
	- `https://<your-domain>/`
	- `https://<your-domain>/index.html`
	- `https://<your-domain>/privacy.html`
	- `https://<your-domain>/tos.html`
	- `https://<your-domain>/output.css?v=<newVersion>`
	- `https://<your-domain>/main.js?v=<newVersion>`

2) Cloudflare API (PowerShell example)

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

