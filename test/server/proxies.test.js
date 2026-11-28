// Pruebas del lado servidor: autorizacion de Admin y proxies hacia coope-backend.
// Ejecutar con: npm run test:server  (no requiere Db2, Cloudant ni red: se simula el backend con fetch)
process.env.COOPE_DATAAPI_URL = 'http://backend.test';

const test = require('node:test');
const assert = require('node:assert/strict');
const appID = require('ibmcloud-appid');

const { handleDataApiProxy } = require('../../libs/dataApiProxy');
const { handleCloudantProxy, isAllowedCloudantPath, isCloudantRead } = require('../../libs/cloudantProxy');
const { requireAdmin } = require('../../libs/adminAuth');
const { requireAuth } = require('../../libs/auth');

const AUTH_CONTEXT = appID.WebAppStrategy.AUTH_CONTEXT;
const ADMINS = new Set(['admin@ibm.com']);

let calls;
const realFetch = global.fetch;

function jsonResponse(status, body) {
	return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test.beforeEach(() => {
	calls = [];
	global.fetch = async (url, init = {}) => {
		const u = new URL(String(url));
		calls.push({ path: u.pathname, search: u.search, method: init.method, body: init.body });
		if (u.pathname === '/users/is-admin') {
			const email = JSON.parse(init.body).email;
			return jsonResponse(200, { isAdmin: ADMINS.has(email) });
		}
		return jsonResponse(200, { ok: true, forwarded: u.pathname });
	};
});

test.after(() => {
	global.fetch = realFetch;
});

function givenReq({ method = 'GET', splat = [], email, url, body }) {
	const session = email
		? { [AUTH_CONTEXT]: { accessToken: 't', identityTokenPayload: { email } } }
		: {};
	return {
		method,
		params: { splat },
		session,
		path: '/' + splat.join('/'),
		originalUrl: url || '/api/x/' + splat.join('/'),
		body
	};
}

function givenRes() {
	const res = {
		statusCode: 200,
		body: undefined,
		status(code) { this.statusCode = code; return this; },
		type() { return this; },
		json(obj) { this.body = obj; return this; },
		send(text) { this.body = text; return this; }
	};
	return res;
}

const backendCalls = () => calls.filter((c) => c.path !== '/users/is-admin');

// ---------------------------------------------------------------- requireAuth

test('requireAuth: sin sesion responde 401', () => {
	const res = givenRes();
	let nexted = false;
	requireAuth(givenReq({}), res, () => { nexted = true; });
	assert.equal(res.statusCode, 401);
	assert.equal(nexted, false);
});

// ---------------------------------------------------------------- requireAdmin

test('requireAdmin: sin sesion responde 401 y no consulta nada', async () => {
	const res = givenRes();
	await new Promise((resolve) => {
		requireAdmin(givenReq({}), res, () => resolve());
		setImmediate(resolve);
	});
	assert.equal(res.statusCode, 401);
	assert.equal(calls.length, 0);
});

test('requireAdmin: usuario que NO es Admin recibe 403', async () => {
	const res = givenRes();
	let nexted = false;
	await new Promise((resolve) => {
		requireAdmin(givenReq({ email: 'socio@ibm.com' }), res, () => { nexted = true; resolve(); });
		setTimeout(resolve, 20);
	});
	assert.equal(res.statusCode, 403);
	assert.equal(nexted, false);
});

test('requireAdmin: Admin continua', async () => {
	const res = givenRes();
	let nexted = false;
	await new Promise((resolve) => {
		requireAdmin(givenReq({ email: 'admin@ibm.com' }), res, () => { nexted = true; resolve(); });
		setTimeout(resolve, 20);
	});
	assert.equal(nexted, true);
});

test('requireAdmin: falla cerrado si el backend no responde (503)', async () => {
	global.fetch = async () => { throw new Error('connection refused'); };
	const res = givenRes();
	let nexted = false;
	await new Promise((resolve) => {
		requireAdmin(givenReq({ email: 'admin@ibm.com' }), res, () => { nexted = true; resolve(); });
		setTimeout(resolve, 20);
	});
	assert.equal(res.statusCode, 503);
	assert.equal(nexted, false);
});

test('requireAdmin: falla cerrado si el backend responde error', async () => {
	global.fetch = async () => jsonResponse(500, { error: 'x' });
	const res = givenRes();
	await new Promise((resolve) => {
		requireAdmin(givenReq({ email: 'admin@ibm.com' }), res, () => resolve());
		setTimeout(resolve, 20);
	});
	assert.equal(res.statusCode, 503);
});

// ---------------------------------------------------------------- data API proxy

test('dataApi: socio NO admin puede leer sus propios datos (vwmasterlookups)', async () => {
	const res = givenRes();
	await handleDataApiProxy(givenReq({ splat: ['vwmasterlookups', 'abc'], email: 'socio@ibm.com' }), res);
	assert.equal(res.statusCode, 200);
	assert.deepEqual(backendCalls().map((c) => c.path), ['/vwmasterlookups/abc']);
});

for (const collection of ['vwsociosibm', 'vwsocioskyndryl', 'vwsociosexempleados', 'vwsociosinactivos', 'coopesocios']) {
	test(`dataApi: socio NO admin no puede leer el padron (${collection})`, async () => {
		const res = givenRes();
		await handleDataApiProxy(givenReq({ splat: [collection], email: 'socio@ibm.com' }), res);
		assert.equal(res.statusCode, 403);
		assert.equal(backendCalls().length, 0);
	});

	test(`dataApi: Admin puede leer el padron (${collection})`, async () => {
		const res = givenRes();
		await handleDataApiProxy(givenReq({ splat: [collection], email: 'admin@ibm.com' }), res);
		assert.equal(res.statusCode, 200);
		assert.equal(backendCalls().length, 1);
	});
}

for (const [method, splat] of [['POST', ['coopesocios']], ['PUT', ['coopesocios', '1']], ['DELETE', ['coopesocios', '1']]]) {
	test(`dataApi: socio NO admin no puede ${method} coopesocios`, async () => {
		const res = givenRes();
		await handleDataApiProxy(givenReq({ method, splat, email: 'socio@ibm.com', body: { isadmin: true } }), res);
		assert.equal(res.statusCode, 403);
		assert.equal(backendCalls().length, 0);
	});

	test(`dataApi: Admin puede ${method} coopesocios`, async () => {
		const res = givenRes();
		await handleDataApiProxy(givenReq({ method, splat, email: 'admin@ibm.com', body: { a: 1 } }), res);
		assert.equal(res.statusCode, 200);
		assert.equal(backendCalls()[0].method, method);
	});
}

test('dataApi: colecciones desconocidas y metodos no permitidos', async () => {
	let res = givenRes();
	await handleDataApiProxy(givenReq({ splat: ['vwcoopeadmins'], email: 'admin@ibm.com' }), res);
	assert.equal(res.statusCode, 404);
	res = givenRes();
	await handleDataApiProxy(givenReq({ method: 'POST', splat: ['vwmasterlookups'], email: 'admin@ibm.com' }), res);
	assert.equal(res.statusCode, 405);
	assert.equal(backendCalls().length, 0);
});

test('dataApi: reenvia el query string (filtros) tal cual al backend', async () => {
	const res = givenRes();
	const filter = encodeURIComponent('{"where":{"numoperacion":"1"},"order":["cuota ASC"]}');
	await handleDataApiProxy(givenReq({
		splat: ['planpagospendientes'], email: 'socio@ibm.com', url: `/api/coope/planpagospendientes?filter=${filter}`
	}), res);
	assert.equal(backendCalls()[0].search, `?filter=${filter}`);
});

// ---------------------------------------------------------------- cloudant proxy

test('cloudant: rutas permitidas', () => {
	assert.equal(isAllowedCloudantPath(['servicios']), true);
	assert.equal(isAllowedCloudantPath(['servicios', '_all_docs']), true);
	assert.equal(isAllowedCloudantPath(['proveedores', '_find']), true);
	assert.equal(isAllowedCloudantPath(['servicios', 'doc1']), true);
	assert.equal(isAllowedCloudantPath(['_users']), false);
	assert.equal(isAllowedCloudantPath(['servicios', '_design']), false);
	assert.equal(isAllowedCloudantPath(['servicios', 'a', 'b']), false);
	assert.equal(isAllowedCloudantPath(['servicios', '..']), false);
	assert.equal(isAllowedCloudantPath(['servicios', 'a\\b']), false);
});

test('cloudant: lecturas son GET y _find', () => {
	assert.equal(isCloudantRead('GET', ['servicios', '_all_docs']), true);
	assert.equal(isCloudantRead('POST', ['proveedores', '_find']), true);
	assert.equal(isCloudantRead('POST', ['servicios']), false);
	assert.equal(isCloudantRead('PUT', ['servicios', 'a']), false);
	assert.equal(isCloudantRead('DELETE', ['servicios', 'a']), false);
});

test('cloudant: socio NO admin puede leer pero se reenvia a /cloudant del backend', async () => {
	const res = givenRes();
	await handleCloudantProxy(givenReq({
		splat: ['servicios', '_all_docs'], email: 'socio@ibm.com', url: '/api/cloudant/servicios/_all_docs?include_docs=true'
	}), res);
	assert.equal(res.statusCode, 200);
	assert.equal(backendCalls()[0].path, '/cloudant/servicios/_all_docs');
	assert.equal(backendCalls()[0].search, '?include_docs=true');
});

test('cloudant: socio NO admin puede consultar _find', async () => {
	const res = givenRes();
	await handleCloudantProxy(givenReq({
		method: 'POST', splat: ['proveedores', '_find'], email: 'socio@ibm.com', body: { selector: {} }
	}), res);
	assert.equal(res.statusCode, 200);
	assert.equal(backendCalls()[0].path, '/cloudant/proveedores/_find');
});

for (const [method, splat] of [
	['POST', ['servicios']], ['PUT', ['servicios', 'a']], ['DELETE', ['categorias', 'a']], ['PUT', ['prestamos', 'p']]
]) {
	test(`cloudant: socio NO admin no puede ${method} ${splat.join('/')}`, async () => {
		const res = givenRes();
		await handleCloudantProxy(givenReq({ method, splat, email: 'socio@ibm.com', body: { x: 1 } }), res);
		assert.equal(res.statusCode, 403);
		assert.equal(backendCalls().length, 0);
	});

	test(`cloudant: Admin puede ${method} ${splat.join('/')}`, async () => {
		const res = givenRes();
		await handleCloudantProxy(givenReq({ method, splat, email: 'admin@ibm.com', body: { x: 1 } }), res);
		assert.equal(res.statusCode, 200);
		assert.equal(backendCalls()[0].path, '/cloudant/' + splat.join('/'));
	});
}

test('cloudant: bases de datos no permitidas -> 404 sin llamar al backend', async () => {
	const res = givenRes();
	await handleCloudantProxy(givenReq({ splat: ['_users'], email: 'admin@ibm.com' }), res);
	assert.equal(res.statusCode, 404);
	assert.equal(calls.length, 0);
});

test('proxy: backend caido -> 502; sin COOPE_DATAAPI_URL -> 503', async () => {
	global.fetch = async () => { throw new Error('boom'); };
	let res = givenRes();
	await handleDataApiProxy(givenReq({ splat: ['vwmasterlookups', 'x'], email: 'socio@ibm.com' }), res);
	assert.equal(res.statusCode, 502);

	const saved = process.env.COOPE_DATAAPI_URL;
	delete process.env.COOPE_DATAAPI_URL;
	res = givenRes();
	await handleDataApiProxy(givenReq({ splat: ['vwmasterlookups', 'x'], email: 'socio@ibm.com' }), res);
	assert.equal(res.statusCode, 503);
	process.env.COOPE_DATAAPI_URL = saved;
});
