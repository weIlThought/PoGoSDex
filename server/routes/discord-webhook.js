import { Router } from 'express';
import crypto from 'crypto';

/**
 * Discord Bot Webhook Routes
 * Diese Endpoints können von externen Services genutzt werden, um den Discord Bot zu triggern
 */
export function registerDiscordWebhookRoutes(app, logger) {
  const router = Router();

  // Webhook authentication middleware
  const authenticateWebhook = (req, res, next) => {
    const webhookSecret = process.env.DISCORD_WEBHOOK_SECRET;

    if (!webhookSecret) {
      logger.warn('⚠️  DISCORD_WEBHOOK_SECRET not set - webhook authentication disabled!');
      return next();
    }

    const providedSecret =
      req.headers['x-webhook-secret'] || req.headers['authorization']?.replace('Bearer ', '');

    if (!providedSecret || providedSecret !== webhookSecret) {
      logger.warn(`Unauthorized Discord webhook attempt from ${req.ip}`);
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };

  // Health check für Discord Webhooks
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'discord-webhook',
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Version Update Webhook
   * POST /api/discord-webhook/version
   *
   * Body:
   * {
   *   "source": "pgsharp" | "pokeminers" | "pogo",
   *   "version": "1.234.0",
   *   "message": "Optional custom message",
   *   "url": "Optional URL for more info"
   * }
   */
  router.post('/version', authenticateWebhook, async (req, res) => {
    try {
      const { source, version, message, url } = req.body;

      if (!source || !version) {
        return res.status(400).json({
          error: 'Missing required fields: source, version',
        });
      }

      // Validiere source
      const validSources = ['pgsharp', 'pokeminers', 'pogo'];
      if (!validSources.includes(source.toLowerCase())) {
        return res.status(400).json({
          error: `Invalid source. Must be one of: ${validSources.join(', ')}`,
        });
      }

      logger.info(`📡 Discord webhook triggered: ${source} version ${version}`);

      // Hier könnte der Discord Bot benachrichtigt werden
      // z.B. über einen Message Queue Service, Redis Pub/Sub, oder HTTP Request zum Bot

      // Für jetzt: In Discord Channel posten (wenn Discord Bot Integration existiert)
      // Das könnte über die Discord Bot API gemacht werden

      res.json({
        ok: true,
        message: 'Webhook received',
        data: {
          source,
          version,
          receivedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error handling Discord version webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * News Update Webhook
   * POST /api/discord-webhook/news
   *
   * Body:
   * {
   *   "title": "News Title",
   *   "excerpt": "Short description",
   *   "url": "https://pogosdex.com/news/...",
   *   "tags": ["tag1", "tag2"]
   * }
   */
  router.post('/news', authenticateWebhook, async (req, res) => {
    try {
      const { title, excerpt, url, tags } = req.body;

      if (!title) {
        return res.status(400).json({
          error: 'Missing required field: title',
        });
      }

      logger.info(`📡 Discord webhook triggered: News "${title}"`);

      res.json({
        ok: true,
        message: 'News webhook received',
        data: {
          title,
          receivedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error handling Discord news webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * Device Proposal Webhook
   * POST /api/discord-webhook/proposal
   *
   * Body:
   * {
   *   "proposalId": 123,
   *   "action": "created" | "approved" | "rejected",
   *   "device": {
   *     "brand": "Samsung",
   *     "model": "Galaxy S21"
   *   }
   * }
   */
  router.post('/proposal', authenticateWebhook, async (req, res) => {
    try {
      const { proposalId, action, device } = req.body;

      if (!proposalId || !action) {
        return res.status(400).json({
          error: 'Missing required fields: proposalId, action',
        });
      }

      logger.info(`📡 Discord webhook triggered: Proposal #${proposalId} ${action}`);

      res.json({
        ok: true,
        message: 'Proposal webhook received',
        data: {
          proposalId,
          action,
          receivedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error handling Discord proposal webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * Generic Event Webhook
   * POST /api/discord-webhook/event
   *
   * Body:
   * {
   *   "event": "custom_event_name",
   *   "data": { ... }
   * }
   */
  router.post('/event', authenticateWebhook, async (req, res) => {
    try {
      const { event, data } = req.body;

      if (!event) {
        return res.status(400).json({
          error: 'Missing required field: event',
        });
      }

      logger.info(`📡 Discord webhook triggered: Event "${event}"`);

      res.json({
        ok: true,
        message: 'Event webhook received',
        data: {
          event,
          receivedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error handling Discord event webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Mount the router
  app.use('/api/discord-webhook', router);

  logger.info('✅ Discord Webhook routes registered:');
  logger.info('   - POST /api/discord-webhook/version');
  logger.info('   - POST /api/discord-webhook/news');
  logger.info('   - POST /api/discord-webhook/proposal');
  logger.info('   - POST /api/discord-webhook/event');
  logger.info('   - GET  /api/discord-webhook/health');

  const webhookSecret = process.env.DISCORD_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.warn('⚠️  WARNING: DISCORD_WEBHOOK_SECRET not set - webhooks are not protected!');
  } else {
    logger.info('🔒 Discord webhook authentication enabled');
  }
}
