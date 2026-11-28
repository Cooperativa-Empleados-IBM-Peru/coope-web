// Cliente HTTP hacia coope-backend (URL interna de Code Engine, solo visible para el servidor).
// coope-web NO se conecta directamente a Db2 ni a Cloudant: todo pasa por coope-backend.
const BACKEND_TIMEOUT_MS = 15000;

function backendBaseUrl() {
	const baseUrl = process.env.COOPE_DATAAPI_URL;
	if (!baseUrl || !/^https?:\/\//.test(baseUrl)) {
		return null;
	}
	return baseUrl.replace(/\/+$/, '');
}

/**
 * Llama al backend. Lanza un error con `code = 'BACKEND_NOT_CONFIGURED'` si falta COOPE_DATAAPI_URL.
 * @param {string} pathAndQuery Ruta relativa al backend, con query string opcional (ej. "/cloudant/servicios?x=1")
 * @param {{method?: string, headers?: object, body?: any}} [options]
 * @returns {Promise<Response>}
 */
async function backendFetch(pathAndQuery, options = {}) {
	const base = backendBaseUrl();
	if (!base) {
		const err = new Error('COOPE_DATAAPI_URL is not configured');
		err.code = 'BACKEND_NOT_CONFIGURED';
		throw err;
	}
	const method = options.method || 'GET';
	const hasBody = options.body !== undefined && (method === 'POST' || method === 'PUT');
	const headers = Object.assign({ 'Accept': 'application/json' }, options.headers);
	if (hasBody) {
		headers['Content-Type'] = 'application/json';
	}
	return fetch(base + pathAndQuery, {
		method,
		headers,
		body: hasBody ? JSON.stringify(options.body) : undefined,
		signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS)
	});
}

module.exports = {
	BACKEND_TIMEOUT_MS,
	backendBaseUrl,
	backendFetch
};
