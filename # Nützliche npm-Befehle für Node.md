# Nützliche npm-Befehle für Node.js-Projekte

## Installation & Initialisierung

```sh
npm init -y
# Erstellt eine neue package.json mit Standardwerten

npm install
# Installiert alle Abhängigkeiten aus der package.json im aktuellen Ordner

npm install --prefix server
# Installiert alle Abhängigkeiten im Unterordner "server"

npm install <paketname>
# Installiert ein bestimmtes Paket im aktuellen Ordner

npm install <paketname> --workspace=server
# Installiert ein Paket gezielt im Workspace "server" (bei Workspaces)

npm install --force
# Erzwingt die Installation aller Abhängigkeiten, auch bei Konflikten
```

## Pakete & Abhängigkeiten prüfen

```sh
npm ls <paketname>
# Zeigt an, ob und wo ein Paket installiert ist

npm fund
# Zeigt an, welche Pakete um Unterstützung bitten
```

## Cache & Fehlerbehebung

```sh
npm cache clean --force
# Leert den npm-Cache

del package-lock.json
# Löscht die package-lock.json (Windows)

rm package-lock.json
# Löscht die package-lock.json (Linux/Mac)
```

## Sonstiges

```sh
npm run <scriptname>
# Führt ein Skript aus der package.json aus

npm outdated
# Zeigt veraltete Pakete an

npm update
# Aktualisiert alle Pakete auf die neueste erlaubte Version

npx -y  @tailwindcss/cli -i ./public/styles.css -o ./public/output.css --minify
# styles.css to output.css
```

---

**Tipp:**  
Immer im richtigen Ordner arbeiten (`cd <ordner>`) und bei Workspaces Installationen bevorzugt im Projekt-Root ausführen!
