// Proxy: Cloudant. Las credenciales viven solo en el servidor (variables de entorno).
const CLOUDANT_DATABASES = new Set([
	'servicios', 'imagenes', 'prestamos', 'certificados',
	'proveedores', 'categorias', 'coopeproveedor'
]);
const CLOUDANT_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE']);
const CLOUDANT_TIMEOUT_MS = 15000;

function isAllowedCloudantPath(segments) {
	if (segments.length < 1 || segments.length > 2) return false;
	if (!CLOUDANT_DATABASES.has(segments[0])) return false;
	if (segments.length === 2) {
		const seg = segments[1];
		const isSpecial = seg === '_all_docs' || seg === '_find';
		const isDocId = seg.length > 0 && !seg.startsWith('_') && !seg.includes('/') && seg !== '.' && seg !== '..';
		if (!isSpecial && !isDocId) return false;
	}
	return true;
}

async function handleCloudantProxy(req, res) {
	const baseUrl = process.env.CLOUDANT_URL;
	const username = process.env.CLOUDANT_USERNAME;
	const password = process.env.CLOUDANT_PASSWORD;

	if (!baseUrl || !username || !password || !baseUrl.startsWith('https://')) {
		console.error('Cloudant proxy is not configured correctly');
		return res.status(503).json({ error: 'Service unavailable' });
	}

	if (!CLOUDANT_METHODS.has(req.method)) {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const segments = [].concat(req.params.splat || []);
	if (!isAllowedCloudantPath(segments)) {
		return res.status(404).json({ error: 'Not found' });
	}

	const search = new URL(req.originalUrl, 'http://localhost').search;
	const url = baseUrl.replace(/\/+$/, '') + '/' + segments.map(encodeURIComponent).join('/') + search;

	const hasBody = req.method === 'POST' || req.method === 'PUT';
	try {
		const upstream = await fetch(url, {
			method: req.method,
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json',
				'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
			},
			body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
			signal: AbortSignal.timeout(CLOUDANT_TIMEOUT_MS)
		});
		const text = await upstream.text();
		res.status(upstream.status)
			.type(upstream.headers.get('content-type') || 'application/json')
			.send(text);
	} catch (err) {
		console.error('Cloudant proxy error:', err.message);
		res.status(502).json({ error: 'Bad gateway' });
	}
}

module.exports = {
	CLOUDANT_DATABASES,
	CLOUDANT_METHODS,
	CLOUDANT_TIMEOUT_MS,
	isAllowedCloudantPath,
	handleCloudantProxy
};
