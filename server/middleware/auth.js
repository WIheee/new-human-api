// middleware/auth.js
import { config } from '../config.js';

// 第三方软件：Authorization: Bearer <API_KEY>
export function requireApiKey(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';

  if (token !== config.API_KEY) {
    return res.status(401).json({
      error: {
        message: 'Invalid API key',
        type: 'invalid_request_error',
        code: 'invalid_api_key'
      }
    });
  }
  next();
}

// 管理端：X-Admin-Token 头 或 Bearer
export function requireAdmin(req, res, next) {
  const headerToken = req.headers['x-admin-token'];
  const bearer = (req.headers.authorization || '').replace(/^Bearer /, '').trim();
  const token = headerToken || bearer;

  if (token !== config.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
