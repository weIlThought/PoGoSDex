# Discord Webhook Events Integration

## 🎯 Übersicht

Deine Website unterstützt jetzt **zwei Arten von Discord Webhooks**:

### 1. **Custom Webhooks** (für externe Services)

- URL: `https://pogosdex.com/api/discord-webhook/*`
- Authentifizierung: Custom Secret
- Verwendung: Externe Services (IFTTT, Zapier, GitHub Actions, etc.)

### 2. **Discord Webhook Events** (offiziell von Discord)

- URL: `https://pogosdex.com/api/discord-events`
- Authentifizierung: Ed25519 Signature Verification
- Verwendung: Offizielle Discord Events (App Authorized, Entitlements, etc.)

---

## 📡 Discord Webhook Events (Offiziell)

### Setup im Discord Developer Portal

1. **Gehe zu:** https://discord.com/developers/applications
2. **Wähle deine App** aus
3. **Navigiere zu:** Webhooks (linke Sidebar)
4. **Endpoint URL:** `https://pogosdex.com/api/discord-events`
5. **Enable Events:** Toggle aktivieren
6. **Select Events:** Wähle die Events aus, die du empfangen möchtest

### Public Key kopieren

1. **Gehe zu:** General Information
2. **Kopiere:** PUBLIC KEY
3. **Füge in .env ein:**
   ```env
   DISCORD_PUBLIC_KEY=dein_public_key_hier
   ```

### Unterstützte Events

| Event Type                   | Beschreibung                                       |
| ---------------------------- | -------------------------------------------------- |
| `APPLICATION_AUTHORIZED`     | App wurde zu Server oder User-Account hinzugefügt  |
| `APPLICATION_DEAUTHORIZED`   | App wurde entfernt                                 |
| `ENTITLEMENT_CREATE`         | Nutzer hat ein Entitlement erworben (Monetization) |
| `LOBBY_MESSAGE_CREATE`       | Nachricht in Lobby erstellt                        |
| `LOBBY_MESSAGE_UPDATE`       | Nachricht in Lobby aktualisiert                    |
| `LOBBY_MESSAGE_DELETE`       | Nachricht in Lobby gelöscht                        |
| `GAME_DIRECT_MESSAGE_CREATE` | Game DM erstellt                                   |
| `GAME_DIRECT_MESSAGE_UPDATE` | Game DM aktualisiert                               |
| `GAME_DIRECT_MESSAGE_DELETE` | Game DM gelöscht                                   |

### Event Payload Struktur

```json
{
  "version": 1,
  "application_id": "123456789012345678",
  "type": 1,
  "event": {
    "type": "APPLICATION_AUTHORIZED",
    "timestamp": "2025-11-12T10:30:00.000Z",
    "data": {
      "integration_type": 0,
      "user": { ... },
      "guild": { ... },
      "scopes": ["applications.commands"]
    }
  }
}
```

### PING Event

Discord sendet beim Setup einen PING-Event (type: 0):

```json
{
  "version": 1,
  "application_id": "123456789012345678",
  "type": 0
}
```

**Deine App antwortet automatisch mit:** `204 No Content`

### Signature Verification

Discord signiert alle Requests mit Ed25519:

**Headers:**

- `X-Signature-Ed25519`: Signatur
- `X-Signature-Timestamp`: Zeitstempel

**Verification:**

```javascript
const nacl = require('tweetnacl');

const message = timestamp + JSON.stringify(body);
const isValid = nacl.sign.detached.verify(
  Buffer.from(message),
  Buffer.from(signature, 'hex'),
  Buffer.from(PUBLIC_KEY, 'hex')
);
```

Deine App macht das **automatisch**! ✅

### Event Handlers

Du kannst die Event Handler in `server/routes/discord-events.js` anpassen:

```javascript
async function handleApplicationAuthorized(data, logger) {
  const { user, scopes, integration_type, guild } = data;

  // Deine Custom Logic hier
  // z.B. Datenbank-Update, Discord Bot Benachrichtigung, etc.

  logger.info(`✅ App authorized by user ${user.id}`);
}
```

---

## 🔧 Custom Webhooks (für externe Services)

Diese Webhooks sind für **deine eigenen Integrationen** gedacht.

### Endpoints

| Endpoint                             | Beschreibung      |
| ------------------------------------ | ----------------- |
| `POST /api/discord-webhook/version`  | Version-Updates   |
| `POST /api/discord-webhook/news`     | News-Updates      |
| `POST /api/discord-webhook/proposal` | Geräte-Vorschläge |
| `POST /api/discord-webhook/event`    | Custom Events     |
| `GET /api/discord-webhook/health`    | Health Check      |

### Authentifizierung

**Header erforderlich:**

```
X-Webhook-Secret: 3eb578aa9935de78ba320b6ed3346affe4319c4529fe4f49127e2ee81fc34297
```

**ODER:**

```
Authorization: Bearer 3eb578aa9935de78ba320b6ed3346affe4319c4529fe4f49127e2ee81fc34297
```

### Beispiel: Version Update

```bash
curl -X POST https://pogosdex.com/api/discord-webhook/version \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: 3eb578aa9935de78ba320b6ed3346affe4319c4529fe4f49127e2ee81fc34297" \
  -d '{
    "source": "pgsharp",
    "version": "1.234.0",
    "message": "Neue Version verfügbar!",
    "url": "https://www.pgsharp.com"
  }'
```

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

---

## 🚀 Installation

### 1. Dependencies installieren

```bash
cd server
npm install tweetnacl
```

### 2. Environment Variables setzen

```env
# .env

# Discord Public Key (von Discord Developer Portal)
DISCORD_PUBLIC_KEY=your_public_key_here

# Discord Webhook Secret (für Custom Webhooks)
DISCORD_WEBHOOK_SECRET=3eb578aa9935de78ba320b6ed3346affe4319c4529fe4f49127e2ee81fc34297
```

### 3. Server neu starten

```bash
docker-compose restart
# ODER
npm start
```

### 4. Discord Developer Portal konfigurieren

1. Gehe zu: https://discord.com/developers/applications
2. Wähle deine App
3. Webhooks → Endpoint URL: `https://pogosdex.com/api/discord-events`
4. Click "Save Changes"
5. Discord sendet PING → Deine App antwortet automatisch ✅
6. Enable Events und wähle die gewünschten Events

---

## 🧪 Testing

### Discord Events testen

Discord sendet automatisch Test-Events. Du siehst sie in den Logs:

```
2025-11-12T10:30:00.000Z info: 📡 Discord PING event received
2025-11-12T10:30:15.000Z info: 📡 Discord event received: APPLICATION_AUTHORIZED at 2025-11-12T10:30:00.000Z
2025-11-12T10:30:15.000Z info: ✅ App authorized by user 123456789012345678
```

### Custom Webhooks testen

```bash
# Health Check
curl https://pogosdex.com/api/discord-webhook/health

# Version Webhook
curl -X POST https://pogosdex.com/api/discord-webhook/version \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: 3eb578aa9935de78ba320b6ed3346affe4319c4529fe4f49127e2ee81fc34297" \
  -d '{"source": "test", "version": "1.0.0"}'
```

---

## 🔒 Sicherheit

### Discord Events

✅ **Ed25519 Signature Verification** (automatisch)
✅ **Timestamp Validation** (verhindert Replay Attacks)
✅ **Public Key Verification** (nur Discord kann valide Requests senden)

### Custom Webhooks

✅ **Secret-basierte Authentifizierung**
✅ **Header-basierte Validation**
✅ **IP-Logging** (für Security Audits)

---

## 📊 Monitoring

### Logs prüfen

```bash
# Docker
docker-compose logs -f

# Direct
tail -f logs/app.log
```

### Wichtige Log-Einträge

```
✅ Discord Events Webhook registered
🔒 Discord events signature verification enabled
📡 Discord PING event received
📡 Discord event received: APPLICATION_AUTHORIZED
⚠️  WARNING: DISCORD_PUBLIC_KEY not set!
```

---

## 🛠️ Troubleshooting

### "Invalid request signature"

**Problem:** Public Key falsch oder fehlt

**Lösung:**

1. Public Key aus Discord Developer Portal kopieren
2. In `.env` setzen: `DISCORD_PUBLIC_KEY=...`
3. Server neu starten

### "Endpoint URL validation failed"

**Problem:** Server antwortet nicht auf PING

**Lösung:**

1. Prüfe ob Server läuft: `curl https://pogosdex.com/health`
2. Prüfe Logs: `docker-compose logs -f`
3. Stelle sicher dass `/api/discord-events` erreichbar ist

### "Discord stopped sending events"

**Problem:** Zu viele fehlgeschlagene Responses (> 3 Sekunden Timeout)

**Lösung:**

1. Optimiere Event Handler (async/await korrekt verwenden)
2. Verschiebe lange Operationen in Background Jobs
3. Prüfe Server Performance

---

## 📚 Weiterführende Links

- [Discord Webhook Events Docs](https://discord.com/developers/docs/events/webhook-events)
- [Signature Verification](https://discord.com/developers/docs/interactions/receiving-and-responding#security-and-authorization)
- [Event Types Reference](https://discord.com/developers/docs/events/webhook-events#event-types)
- [tweetnacl Library](https://github.com/dchest/tweetnacl-js)

---

## ✅ Zusammenfassung

### Discord Events (Offiziell)

- **URL:** `https://pogosdex.com/api/discord-events`
- **Auth:** Ed25519 Signature (automatisch)
- **Setup:** Discord Developer Portal → Webhooks

### Custom Webhooks (Extern)

- **URL:** `https://pogosdex.com/api/discord-webhook/*`
- **Auth:** `X-Webhook-Secret: 3eb578aa9935de78ba320b6ed3346affe4319c4529fe4f49127e2ee81fc34297`
- **Setup:** Externe Services konfigurieren

**Beide Systeme laufen parallel und unabhängig voneinander!** 🎉
