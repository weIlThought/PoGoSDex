# Discord Bot Webhook Setup

## 🎯 Übersicht

Deine Website bietet jetzt Webhook-Endpoints, die externe Services (oder dein Discord Bot) nutzen können, um automatisch Benachrichtigungen zu triggern.

## 📍 Webhook URLs

Alle Webhooks sind unter deiner Domain verfügbar:

```
https://pogosdex.com/api/discord-webhook/...
```

### Verfügbare Endpoints:

| Endpoint                        | Methode | Beschreibung                                |
| ------------------------------- | ------- | ------------------------------------------- |
| `/api/discord-webhook/version`  | POST    | Version-Updates (PGSharp, Pokeminers, PoGO) |
| `/api/discord-webhook/news`     | POST    | News-Updates                                |
| `/api/discord-webhook/proposal` | POST    | Geräte-Vorschläge                           |
| `/api/discord-webhook/event`    | POST    | Generische Events                           |
| `/api/discord-webhook/health`   | GET     | Health Check                                |

## 🔒 Authentifizierung

Alle POST-Endpoints erfordern einen Secret-Key im Header:

```bash
# Option 1: X-Webhook-Secret Header
curl -X POST https://pogosdex.com/api/discord-webhook/version \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: 3eb578aa9935de78ba320b6ed3346affe4319c4529fe4f49127e2ee81fc34297" \
  -d '{"source": "pgsharp", "version": "1.234.0"}'

# Option 2: Authorization Bearer Token
curl -X POST https://pogosdex.com/api/discord-webhook/version \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 3eb578aa9935de78ba320b6ed3346affe4319c4529fe4f49127e2ee81fc34297" \
  -d '{"source": "pgsharp", "version": "1.234.0"}'
```

**Dein Webhook Secret:**

```
3eb578aa9935de78ba320b6ed3346affe4319c4529fe4f49127e2ee81fc34297
```

⚠️ **WICHTIG:** Halte diesen Secret geheim! Teile ihn niemals öffentlich.

## 📡 Webhook Beispiele

### 1. Version Update Webhook

Benachrichtige über neue Versionen:

```bash
POST https://pogosdex.com/api/discord-webhook/version
Content-Type: application/json
X-Webhook-Secret: 3eb578aa9935de78ba320b6ed3346affe4319c4529fe4f49127e2ee81fc34297

{
  "source": "pgsharp",
  "version": "1.234.0",
  "message": "Neue PGSharp Version verfügbar!",
  "url": "https://www.pgsharp.com"
}
```

**Quellen:** `pgsharp`, `pokeminers`, `pogo`

**Response:**

```json
{
  "ok": true,
  "message": "Webhook received",
  "data": {
    "source": "pgsharp",
    "version": "1.234.0",
    "receivedAt": "2025-11-12T10:30:00.000Z"
  }
}
```

### 2. News Update Webhook

Benachrichtige über neue News:

```bash
POST https://pogosdex.com/api/discord-webhook/news
Content-Type: application/json
X-Webhook-Secret: 3eb578aa9935de78ba320b6ed3346affe4319c4529fe4f49127e2ee81fc34297

{
  "title": "Wichtiges Update!",
  "excerpt": "Neue Funktionen verfügbar",
  "url": "https://pogosdex.com/news/update-2025",
  "tags": ["update", "wichtig"]
}
```

### 3. Device Proposal Webhook

Benachrichtige über Geräte-Vorschläge:

```bash
POST https://pogosdex.com/api/discord-webhook/proposal
Content-Type: application/json
X-Webhook-Secret: 3eb578aa9935de78ba320b6ed3346affe4319c4529fe4f49127e2ee81fc34297

{
  "proposalId": 123,
  "action": "created",
  "device": {
    "brand": "Samsung",
    "model": "Galaxy S21"
  }
}
```

**Actions:** `created`, `approved`, `rejected`

### 4. Generic Event Webhook

Für benutzerdefinierte Events:

```bash
POST https://pogosdex.com/api/discord-webhook/event
Content-Type: application/json
X-Webhook-Secret: 3eb578aa9935de78ba320b6ed3346affe4319c4529fe4f49127e2ee81fc34297

{
  "event": "custom_event",
  "data": {
    "key": "value",
    "anything": "you want"
  }
}
```

## 🔧 Integration mit Discord Bot

### Option A: Von externen Services

Externe Services (z.B. GitHub Actions, IFTTT, Zapier) können direkt die Webhooks aufrufen:

```yaml
# GitHub Actions Beispiel
- name: Notify Discord Bot
  run: |
    curl -X POST https://pogosdex.com/api/discord-webhook/version \
      -H "Content-Type: application/json" \
      -H "X-Webhook-Secret: ${{ secrets.DISCORD_WEBHOOK_SECRET }}" \
      -d '{"source": "github", "version": "${{ github.ref_name }}"}'
```

### Option B: Von deinem Discord Bot aus

Der Discord Bot kann die Webhooks regelmäßig abfragen (Polling) oder Events triggern:

```javascript
// Im Discord Bot
import axios from 'axios';

async function notifyVersionUpdate(source, version) {
  try {
    await axios.post(
      'https://pogosdex.com/api/discord-webhook/version',
      {
        source,
        version,
      },
      {
        headers: {
          'X-Webhook-Secret': process.env.DISCORD_WEBHOOK_SECRET,
        },
      }
    );
    console.log('✅ Webhook triggered successfully');
  } catch (error) {
    console.error('❌ Webhook failed:', error.message);
  }
}
```

### Option C: Von deiner Website aus

Wenn du auf der Website neue News erstellst, kannst du automatisch eine Benachrichtigung senden:

```javascript
// In server/routes/admin.js (nach dem Erstellen von News)
import axios from 'axios';

// Nach dem Erstellen von News
const news = await createNews({ title, excerpt, content });

// Webhook triggern (optional)
try {
  await axios.post(
    'http://localhost:3000/api/discord-webhook/news',
    {
      title: news.title,
      excerpt: news.excerpt,
      url: `https://pogosdex.com/news/${news.slug}`,
      tags: news.tags,
    },
    {
      headers: {
        'X-Webhook-Secret': process.env.DISCORD_WEBHOOK_SECRET,
      },
    }
  );
} catch (error) {
  console.error('Failed to trigger Discord webhook:', error);
  // Fehler nicht nach außen werfen - News wurde bereits erstellt
}
```

## 🧪 Testen der Webhooks

### 1. Health Check

```bash
curl https://pogosdex.com/api/discord-webhook/health
```

Erwartete Response:

```json
{
  "status": "ok",
  "service": "discord-webhook",
  "timestamp": "2025-11-12T10:30:00.000Z"
}
```

### 2. Test Version Webhook

```bash
curl -X POST https://pogosdex.com/api/discord-webhook/version \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: 3eb578aa9935de78ba320b6ed3346affe4319c4529fe4f49127e2ee81fc34297" \
  -d '{"source": "pgsharp", "version": "TEST"}'
```

### 3. Test ohne Auth (sollte fehlschlagen)

```bash
curl -X POST https://pogosdex.com/api/discord-webhook/version \
  -H "Content-Type: application/json" \
  -d '{"source": "pgsharp", "version": "TEST"}'
```

Erwartete Response:

```json
{
  "error": "Unauthorized"
}
```

## 🔄 Automatische Integration

### IFTTT / Zapier

Du kannst IFTTT oder Zapier nutzen, um automatisch Webhooks zu triggern:

1. **Trigger:** RSS-Feed Update (z.B. von Pokeminers Blog)
2. **Action:** Webhook POST zu `https://pogosdex.com/api/discord-webhook/version`
3. **Body:**
   ```json
   {
     "source": "pokeminers",
     "version": "{{FeedItemTitle}}",
     "message": "{{FeedItemDescription}}",
     "url": "{{FeedItemUrl}}"
   }
   ```

### Cron Job (für regelmäßige Checks)

```bash
#!/bin/bash
# check-pgsharp-version.sh

# Hole aktuelle Version von PGSharp API
VERSION=$(curl -s https://pogosdex.com/api/pgsharp/version | jq -r '.version')

# Vergleiche mit letzter bekannter Version
LAST_VERSION=$(cat /tmp/last_pgsharp_version 2>/dev/null || echo "0")

if [ "$VERSION" != "$LAST_VERSION" ]; then
  echo "Neue Version erkannt: $VERSION (alt: $LAST_VERSION)"

  # Trigger Webhook
  curl -X POST https://pogosdex.com/api/discord-webhook/version \
    -H "Content-Type: application/json" \
    -H "X-Webhook-Secret: 3eb578aa9935de78ba320b6ed3346affe4319c4529fe4f49127e2ee81fc34297" \
    -d "{\"source\": \"pgsharp\", \"version\": \"$VERSION\"}"

  # Speichere neue Version
  echo "$VERSION" > /tmp/last_pgsharp_version
fi
```

Füge in Crontab ein (alle 5 Minuten):

```bash
crontab -e
*/5 * * * * /path/to/check-pgsharp-version.sh
```

## 🛡️ Sicherheit

### Best Practices:

1. ✅ **Webhook Secret immer mitschicken**
2. ✅ **HTTPS verwenden** (nicht HTTP)
3. ✅ **Secret niemals in Code commiten** (nur in .env)
4. ✅ **Rate Limiting beachten** (nicht zu viele Requests)
5. ✅ **Logs regelmäßig prüfen** auf unauthorisierte Zugriffe

### Secret rotieren:

Falls der Secret kompromittiert wurde:

```bash
# Neuen Secret generieren
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# In .env aktualisieren
DISCORD_WEBHOOK_SECRET=NEUER_SECRET_HIER

# Server neu starten
docker-compose restart
```

## 📊 Monitoring

Webhook-Logs findest du in:

- Console-Output: `docker-compose logs -f`
- Server-Logs: Alle Webhook-Requests werden geloggt

Beispiel-Log:

```
2025-11-12T10:30:00.000Z info: 📡 Discord webhook triggered: pgsharp version 1.234.0
```

Bei unauthorized Zugriffen:

```
2025-11-12T10:30:00.000Z warn: Unauthorized Discord webhook attempt from 192.168.1.1
```

## 🎉 Zusammenfassung

**Deine Webhook URLs:**

- `https://pogosdex.com/api/discord-webhook/version`
- `https://pogosdex.com/api/discord-webhook/news`
- `https://pogosdex.com/api/discord-webhook/proposal`
- `https://pogosdex.com/api/discord-webhook/event`

**Dein Webhook Secret:**

```
3eb578aa9935de78ba320b6ed3346affe4319c4529fe4f49127e2ee81fc34297
```

**Header:**

```
X-Webhook-Secret: 3eb578aa9935de78ba320b6ed3346affe4319c4529fe4f49127e2ee81fc34297
```

**ODER:**

```
Authorization: Bearer 3eb578aa9935de78ba320b6ed3346affe4319c4529fe4f49127e2ee81fc34297
```

---

🎯 **Nächste Schritte:**

1. Server neu starten: `docker-compose restart`
2. Health Check testen: `curl https://pogosdex.com/api/discord-webhook/health`
3. Version Webhook testen (siehe Beispiele oben)
4. In externen Services integrieren
