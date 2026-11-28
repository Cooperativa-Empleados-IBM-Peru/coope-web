// Autorizacion de Admin del lado del servidor. La UI solo oculta menus: esta es la barrera real.
const { getSessionEmail } = require('./session');
const users = require('./users');
const { authLog } = require('./logger');

/**
 * Verifica que el usuario de la sesion sea Admin (VWCOOPEADMINS). Falla cerrado:
 * ante cualquier error responde sin conceder acceso.
 * @returns {Promise<boolean>} true si puede continuar; si es false ya se envio la respuesta
 */
async function ensureAdmin(req, res) {
	const email = getSessionEmail(req);
	if (!email) {
		res.status(401).json({ error: 'Unauthorized' });
		return false;
	}
	try {
		if (await users.isAdmin(email)) {
			return true;
		}
	} catch (err) {
		authLog('error', 'admin check failed', { error: err && err.message });
		res.status(503).json({ error: 'Service unavailable' });
		return false;
	}
	authLog('warn', 'admin access denied', { path: req.path, method: req.method });
	res.status(403).json({ error: 'Forbidden' });
	return false;
}

// Middleware Express
function requireAdmin(req, res, next) {
	ensureAdmin(req, res).then((ok) => { if (ok) next(); }, next);
}

module.exports = { ensureAdmin, requireAdmin };
