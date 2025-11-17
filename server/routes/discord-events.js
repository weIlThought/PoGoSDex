import { Router } from 'express';
import crypto from 'crypto';

/**
 * Discord Events Handler
 * Implementiert die offizielle Discord Events API
 * @see https://discord.com/developers/docs/events/intro
 */
export function registerDiscordEventsRoutes(app, logger) {
  const router = Router();

  // Public Key für Signature Verification (aus Discord Developer Portal)
  const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;

  /**
   * Verify Discord signature using Ed25519
   * @see https://discord.com/developers/docs/interactions/receiving-and-responding#security-and-authorization
   */
  function verifyDiscordSignature(req, res, next) {
    const signature = req.headers['x-signature-ed25519'];
    const timestamp = req.headers['x-signature-timestamp'];
    const rawBody = req.rawBody || JSON.stringify(req.body);

    if (!PUBLIC_KEY) {
      logger.warn('⚠️  DISCORD_PUBLIC_KEY not set - signature verification disabled!');
      return next();
    }

    if (!signature || !timestamp) {
      logger.warn('Missing signature headers from Discord webhook');
      return res.status(401).json({ error: 'Invalid request signature' });
    }

    try {
      // Import nacl for Ed25519 verification
      // Note: You need to install 'tweetnacl' package
      // npm install tweetnacl
      const nacl = require('tweetnacl');

      const isValid = nacl.sign.detached.verify(
        Buffer.from(timestamp + rawBody),
        Buffer.from(signature, 'hex'),
        Buffer.from(PUBLIC_KEY, 'hex')
      );

      if (!isValid) {
        logger.warn('Invalid Discord signature detected');
        return res.status(401).json({ error: 'Invalid request signature' });
      }

      next();
    } catch (error) {
      logger.error('Error verifying Discord signature:', error);
      return res.status(401).json({ error: 'Invalid request signature' });
    }
  }

  /**
   * Main Discord Events Endpoint
   * POST /api/discord-events
   *
   * Handles alle Discord Events inklusive PING
   */
  router.post('/', verifyDiscordSignature, async (req, res) => {
    try {
      const { version, application_id, type, event } = req.body;

      // Handle PING event (type 0)
      if (type === 0) {
        logger.info('📡 Discord PING event received');
        return res.status(204).end();
      }

      // Handle events (type 1)
      if (type === 1 && event) {
        const eventType = event.type;
        const eventData = event.data;
        const timestamp = event.timestamp;

        logger.info(`📡 Discord event received: ${eventType} at ${timestamp}`);

        // Handle different event types
        switch (eventType) {
          case 'APPLICATION_AUTHORIZED':
            await handleApplicationAuthorized(eventData, logger);
            break;

          case 'APPLICATION_DEAUTHORIZED':
            await handleApplicationDeauthorized(eventData, logger);
            break;

          case 'ENTITLEMENT_CREATE':
            await handleEntitlementCreate(eventData, logger);
            break;

          case 'LOBBY_MESSAGE_CREATE':
            await handleLobbyMessageCreate(eventData, logger);
            break;

          case 'LOBBY_MESSAGE_UPDATE':
            await handleLobbyMessageUpdate(eventData, logger);
            break;

          case 'LOBBY_MESSAGE_DELETE':
            await handleLobbyMessageDelete(eventData, logger);
            break;

          case 'GAME_DIRECT_MESSAGE_CREATE':
            await handleGameDirectMessageCreate(eventData, logger);
            break;

          case 'GAME_DIRECT_MESSAGE_UPDATE':
            await handleGameDirectMessageUpdate(eventData, logger);
            break;

          case 'GAME_DIRECT_MESSAGE_DELETE':
            await handleGameDirectMessageDelete(eventData, logger);
            break;

          default:
            logger.warn(`Unknown Discord event type: ${eventType}`);
        }

        // Always respond with 204 within 3 seconds
        return res.status(204).end();
      }

      // Unknown type
      logger.warn(`Unknown Discord event type: ${type}`);
      return res.status(400).json({ error: 'Unknown event type' });
    } catch (error) {
      logger.error('Error handling Discord event:', error);
      // Still respond with 204 to prevent retries
      return res.status(204).end();
    }
  });

  // Mount the router
  app.use('/api/discord-events', router);

  logger.info('✅ Discord Events API registered:');
  logger.info('   - POST /api/discord-events');

  if (!PUBLIC_KEY) {
    logger.warn('⚠️  WARNING: DISCORD_PUBLIC_KEY not set!');
    logger.warn('   Discord events signature verification is DISABLED');
    logger.warn('   Set DISCORD_PUBLIC_KEY in .env to enable security');
  } else {
    logger.info('🔒 Discord events signature verification enabled');
  }
}
