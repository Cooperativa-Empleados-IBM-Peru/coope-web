// Proxy: Coope Data API (coope-backend). Solo la coleccion coopesocios admite escritura;
// el resto son vistas/tablas de solo lectura.
const { forwardToBackend } = require('./proxy');
const { ensureAdmin } = require('./adminAuth');

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

// Colecciones con datos de TODOS los socios (padron): solo Admin, aunque sea lectura
const COOPE_DATAAPI_ADMIN_ONLY = new Set([
	'coopesocios', 'vwsociosinactivos', 'vwsociosibm', 'vwsocioskyndryl', 'vwsociosexempleados'
]);

function isSafeSegment(seg) {
	return typeof seg === 'string' && seg.length > 0 && seg !== '.' && seg !== '..' && !seg.includes('/') && !seg.includes('\\');
}

async function handleDataApiProxy(req, res) {
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

	if ((COOPE_DATAAPI_ADMIN_ONLY.has(collection) || req.method !== 'GET') && !(await ensureAdmin(req, res))) {
		return;
	}

	return forwardToBackend(req, res, '/' + segments.map(encodeURIComponent).join('/'));
}

module.exports = {
	COOPE_DATAAPI_READ_ONLY,
	COOPE_DATAAPI_WRITABLE,
	COOPE_DATAAPI_ADMIN_ONLY,
	isSafeSegment,
	handleDataApiProxy
};
