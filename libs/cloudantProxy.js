// Proxy: Cloudant. coope-web NO tiene credenciales de Cloudant; las peticiones se reenvian a
// coope-backend (/cloudant/...), que es el unico componente que se conecta a Cloudant.
const { forwardToBackend } = require('./proxy');
const { ensureAdmin } = require('./adminAuth');

const CLOUDANT_DATABASES = new Set([
	'servicios', 'imagenes', 'prestamos', 'certificados',
	'proveedores', 'categorias', 'coopeproveedor'
]);
const CLOUDANT_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE']);

function isAllowedCloudantPath(segments) {
	if (segments.length < 1 || segments.length > 2) return false;
	if (!CLOUDANT_DATABASES.has(segments[0])) return false;
	if (segments.length === 2) {
		const seg = segments[1];
		const isSpecial = seg === '_all_docs' || seg === '_find';
		const isDocId = seg.length > 0 && !seg.startsWith('_') && !seg.includes('/') && !seg.includes('\\') && seg !== '.' && seg !== '..';
		if (!isSpecial && !isDocId) return false;
	}
	return true;
}

// Lectura: GET y consultas _find (POST de solo lectura). Todo lo demas modifica datos.
function isCloudantRead(method, segments) {
	return method === 'GET' || (method === 'POST' && segments.length === 2 && segments[1] === '_find');
}

async function handleCloudantProxy(req, res) {
	if (!CLOUDANT_METHODS.has(req.method)) {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const segments = [].concat(req.params.splat || []);
	if (!isAllowedCloudantPath(segments)) {
		return res.status(404).json({ error: 'Not found' });
	}

	// Escribir en Cloudant (mantenimiento de servicios, imagenes, proveedores, etc.) solo para Admin
	if (!isCloudantRead(req.method, segments) && !(await ensureAdmin(req, res))) {
		return;
	}

	return forwardToBackend(req, res, '/cloudant/' + segments.map(encodeURIComponent).join('/'));
}

module.exports = {
	CLOUDANT_DATABASES,
	CLOUDANT_METHODS,
	isAllowedCloudantPath,
	isCloudantRead,
	handleCloudantProxy
};
