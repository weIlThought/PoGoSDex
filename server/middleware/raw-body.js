/**
 * Raw Body Parser Middleware
 * Benötigt für Discord Signature Verification
 */
export function rawBodyParser(req, res, next) {
  if (req.path === '/api/discord-events' && req.method === 'POST') {
    let data = '';
    req.setEncoding('utf8');

    req.on('data', (chunk) => {
      data += chunk;
    });

    req.on('end', () => {
      req.rawBody = data;
      try {
        req.body = JSON.parse(data);
      } catch (e) {
        req.body = {};
      }
      next();
    });
  } else {
    next();
  }
}
