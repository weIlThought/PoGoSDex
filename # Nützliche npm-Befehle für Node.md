# Nützliche npm-Befehle für dieses Projekt (Windows PowerShell)

## Installation & Initialisierung

```powershell
# Abhängigkeiten für Root + Workspaces (server) installieren
npm ci

# Optional: Nur im Unterordner "server" installieren
npm install --prefix server
```

## Pakete & Abhängigkeiten prüfen

```powershell
# Zeigt an, ob und wo ein Paket installiert ist
npm ls <paketname>

# Zeigt an, welche Pakete um Unterstützung bitten
npm fund
```

## Cache & Fehlerbehebung

```powershell
# npm-Cache leeren
npm cache clean --force

# package-lock.json löschen (PowerShell)
Remove-Item -Force package-lock.json
```

## Projekt-spezifische Skripte

```powershell
# Frontend-Dev-Server (Vite, nur statische Vorschau)
npm run dev

# Produktion-Build (Vite Multi-Page nach dist/)
npm run build

# Express-Server starten (liefert public/ oder dist/ + APIs)
npm start

# Öffentliche CSS beobachten/minifizieren (Tailwind v4)
npm run dev:css
npm run build:css

# Admin-CSS beobachten/minifizieren
npm run dev:admin
npm run build:admin

# Cache-Busting-Version in HTMLs hochzählen
npm run bump:assets

# Linting
npm run lint
npm run lint:fix

# Tests (Jest + Supertest)
npm test
```

## Sonstiges

```powershell
# Veraltete Pakete anzeigen / Updates ausführen
npm outdated
npm update

# Tailwind CSS direkt per CLI bauen (falls benötigt)
npx --yes @tailwindcss/cli -i ./public/styles.css -o ./public/output.css --minify
npx --yes @tailwindcss/cli -i .\server\admin\styles.css -o .\server\admin\admin.css --minify
```

---

Tipp: Bei Workspaces Installationen bevorzugt im Projekt-Root ausführen. Für reine Frontend-Vorschauen `npm run dev` nutzen; für vollständige Tests mit API den Express-Server via `npm start` starten (ggf. parallel `dev:css`/`dev:admin`).
