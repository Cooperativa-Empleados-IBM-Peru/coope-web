// Proxy: Coope Data API (URL interna de Code Engine, solo visible para el servidor).
// Solo la coleccion coopesocios admite escritura; el resto son vistas/tablas de solo lectura.
const COOPE_DATAAPI_READ_ONLY = new Set([
	'vwsociosinactivos', 'vwsociosdetalles', 'vwmasterlookups', 'vwmasterplanpagos',
	'movahorros', 'movbloqueos', 'movaportaciones', 'movmiscelaneos',
	'pracademico', 'prautomovil', 'prconsumo', 'prcortoplazo', 'presp1', 'presp2',
	'prhipotecario', 'prlargoplazo', 'prps', 'prsolafirma',
	'planpagoscancelados', 'planpagospendientes', 'planpagostotales',
	'planpagostotalpendientes', 'planpagostotalcancelados',
	'garantesdetalle', 'certificadosmontos', 'garantizados', 'fra', 'siniestros',
	'vwsociosibm', 'vwsocioskyndryl', 'vwsociosexempleados'
]);
const COOPE_DATAAPI_WRITABLE = new Set(['coopesocios']);
const COOPE_DATAAPI_TIMEOUT_MS = 15000;

function isSafeSegment(seg) {
	return typeof seg === 'string' && seg.length > 0 && seg !== '.' && seg !== '..' && !seg.includes('/') && !seg.includes('\\');
}

async function handleDataApiProxy(req, res) {
	const baseUrl = process.env.COOPE_DATAAPI_URL;
	if (!baseUrl || !/^https?:\/\//.test(baseUrl)) {
		console.error('Coope Data API proxy is not configured correctly');
		return res.status(503).json({ error: 'Service unavailable' });
	}

	const segments = [].concat(req.params.splat || []);
	if (segments.length < 1 || segments.length > 2 || !segments.every(isSafeSegment)) {
		return res.status(404).json({ error: 'Not found' });
	}

	const collection = segments[0];
	const isWritable = COOPE_DATAAPI_WRITABLE.has(collection);
	if (!isWritable && !COOPE_DATAAPI_READ_ONLY.has(collection)) {
		return res.status(404).json({ error: 'Not found' });
	}

	const allowedMethods = isWritable ? ['GET', 'POST', 'PUT', 'DELETE'] : ['GET'];
	if (!allowedMethods.includes(req.method)) {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	// POST se hace sobre la coleccion; PUT/DELETE requieren id
	if ((req.method === 'POST' && segments.length !== 1) ||
		((req.method === 'PUT' || req.method === 'DELETE') && segments.length !== 2)) {
		return res.status(404).json({ error: 'Not found' });
	}

	const search = new URL(req.originalUrl, 'http://localhost').search;
	const url = baseUrl.replace(/\/+$/, '') + '/' + segments.map(encodeURIComponent).join('/') + search;

	const headers = { 'Accept': 'application/json' };
	if (req.headers.authorization) {
		headers['Authorization'] = req.headers.authorization;
	}
	const hasBody = req.method === 'POST' || req.method === 'PUT';
	if (hasBody) {
		headers['Content-Type'] = 'application/json';
	}

	try {
		const upstream = await fetch(url, {
			method: req.method,
			headers,
			body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
			signal: AbortSignal.timeout(COOPE_DATAAPI_TIMEOUT_MS)
		});
		const text = await upstream.text();
		res.status(upstream.status)
			.type(upstream.headers.get('content-type') || 'application/json')
			.send(text);
	} catch (err) {
		console.error('Coope Data API proxy error:', err.message);
		res.status(502).json({ error: 'Bad gateway' });
	}
}

module.exports = {
	COOPE_DATAAPI_READ_ONLY,
	COOPE_DATAAPI_WRITABLE,
	COOPE_DATAAPI_TIMEOUT_MS,
	isSafeSegment,
	handleDataApiProxy
};
