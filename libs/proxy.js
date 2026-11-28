// Reenvio de peticiones al backend con manejo uniforme de errores
const backend = require('./backend');

/**
 * Reenvia la peticion al backend y devuelve su respuesta tal cual (estado, tipo y cuerpo).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string} backendPath Ruta en el backend, sin query string
 */
async function forwardToBackend(req, res, backendPath) {
	const search = new URL(req.originalUrl, 'http://localhost').search;
	const hasBody = req.method === 'POST' || req.method === 'PUT';
	try {
		const upstream = await backend.backendFetch(backendPath + search, {
			method: req.method,
			body: hasBody ? (req.body ?? {}) : undefined
		});
		const text = await upstream.text();
		res.status(upstream.status)
			.type(upstream.headers.get('content-type') || 'application/json')
			.send(text);
	} catch (err) {
		if (err && err.code === 'BACKEND_NOT_CONFIGURED') {
			console.error('Backend proxy is not configured correctly');
			return res.status(503).json({ error: 'Service unavailable' });
		}
		console.error('Backend proxy error:', err && err.message);
		res.status(502).json({ error: 'Bad gateway' });
	}
}

module.exports = { forwardToBackend };
