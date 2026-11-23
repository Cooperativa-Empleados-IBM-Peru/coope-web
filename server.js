const path = require("path");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const appID = require("ibmcloud-appid");
const dotenv = require('dotenv');
const ibmdb = require('ibm_db');
const cors = require('cors');

const WebAppStrategy = appID.WebAppStrategy;

// configuracion del Dotenv
dotenv.config();

//db2 config
const connStr = `DATABASE=${process.env.DB2_DATABASE};HOSTNAME=${process.env.DB2_HOSTNAME};UID=${process.env.DB2_USERNAME};PWD=${process.env.DB2_PASSWORD};PORT=${process.env.DB2_PORT};PROTOCOL=TCPIP;Security=SSL;`;

// crear instancia Express
const app = express();

// Confiar en el proxy inverso (IBM Cloud Code Engine / Ingress)
app.enable('trust proxy');

// Constants
const PORT = process.env.PORT || 6001;
const HOST = '0.0.0.0';
var env = process.env.NODE_ENV || "dev";

// service uri
let SERVICE_URI = "";
if(process.env.APPID_REDIRECT_URI) {
	SERVICE_URI = process.env.APPID_REDIRECT_URI;
} else if (env === 'production') {
	SERVICE_URI = `https://${process.env.CE_APP}.${process.env.CE_SUBDOMAIN}.${process.env.CE_DOMAIN}`;
} else {
	SERVICE_URI = `http://localhost:${PORT}`;
}

// Configurar CORS
app.use(cors({
	origin: SERVICE_URI,
	optionsSuccessStatus: 200
}));

// parse application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));

// parse application/json
app.use(express.json());

// Configurar la sesion de la aplicacion
const isProduction = env === "production";
const forceHttps = process.env.FORCE_HTTPS === "true" || isProduction;

app.use(
  session({
    secret: process.env.SESSION_SECRET || "coope-session-secret-key",
    resave: true,
    saveUninitialized: true,
    proxy: true,
    cookie: {
      secure: forceHttps,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000
    }
  })
);
// Configurar Passport
app.use(passport.initialize());
app.use(passport.session());

// Logging estructurado de diagnostico de autenticacion (nunca registra tokens, codigos ni secretos)
function authLog(level, message, extra) {
	const line = JSON.stringify(Object.assign({ ts: new Date().toISOString(), level, message }, extra));
	if (level === 'error') {
		console.error(line);
	} else {
		console.log(line);
	}
}

function sessionSummary(req) {
	const sess = req.session;
	const authCtx = sess && sess[WebAppStrategy.AUTH_CONTEXT];
	const state = sess && sess[WebAppStrategy.STATE_PARAMETER];
	return {
		method: req.method,
		path: req.path,
		queryKeys: Object.keys(req.query || {}),
		secure: req.secure,
		protocol: req.protocol,
		xForwardedProto: req.get('x-forwarded-proto'),
		host: req.get('host'),
		xForwardedHost: req.get('x-forwarded-host'),
		hasSessionCookie: /(^|;\s*)connect\.sid=/.test(req.headers.cookie || ''),
		sessionIdHash: req.sessionID ? crypto.createHash('sha256').update(req.sessionID).digest('hex').slice(0, 8) : null,
		sessionIsNew: sess ? Object.keys(sess).filter(k => k !== 'cookie').length === 0 : null,
		hasAuthContext: !!authCtx,
		hasStateParam: !!state,
		hasPassportUser: !!(sess && sess.passport && sess.passport.user),
		returnTo: (sess && sess.returnTo) || null
	};
}

// Registrar cada peticion de autenticacion (ignora archivos estaticos) junto con la redireccion resultante
app.use((req, res, next) => {
	if (path.extname(req.path)) {
		return next();
	}
	const before = sessionSummary(req);
	res.on('finish', () => {
		let location = null;
		const header = res.getHeader('location');
		if (header) {
			try {
				const u = new URL(String(header), `${req.protocol}://${req.get('host')}`);
				location = u.origin + u.pathname; // sin query: contiene state/code
			} catch (e) {
				location = String(header).split('?')[0];
			}
		}
		authLog('info', 'request', Object.assign(before, {
			status: res.statusCode,
			location,
			setCookie: !!res.getHeader('set-cookie'),
			hasAuthContextAfter: !!(req.session && req.session[WebAppStrategy.AUTH_CONTEXT])
		}));
	});
	next();
});

// Configurar Passport con APP ID
const CALLBACK_URL = "/ibm/cloud/appid/callback";
let webAppStrategy = new WebAppStrategy({
	clientId: process.env.APPID_CLIENT_ID,
	tenantId: process.env.APPID_TENANT_ID,
	secret: process.env.APPID_SECRET,
	profilesUrl: process.env.APPID_PROFILES_URL,
	oauthServerUrl: process.env.APPID_OAUTH_SERVER_URL,
	redirectUri: SERVICE_URI + CALLBACK_URL
});
passport.use(webAppStrategy);
passport.serializeUser((user, cb) => cb(null, user));
passport.deserializeUser((obj, cb) => cb(null, obj));

// Ruta: Revisar el estado de la aplicacion (sin autenticacion para health checks de Code Engine)
app.get('/health', (req, res, next) => {
  res.json({status: 'UP'})
});

// Ruta: Error de autenticacion
app.get("/error", (req, res) => {
  res.send("Authentication Error");
});

// Handle Login
// keepSessionInfo: passport >= 0.6 regenera la sesion en login y, sin esta opcion,
// se pierde el contexto de App ID (AUTH_CONTEXT, state) guardado en req.session
app.get('/login', passport.authenticate(WebAppStrategy.STRATEGY_NAME, {
	successRedirect: '/',
	forceLogin: true,
	keepSessionInfo: true
}));

// Handle callback (con callback personalizado para registrar la causa real del fallo)
app.get(CALLBACK_URL, (req, res, next) => {
	authLog('info', 'appid callback received', Object.assign(sessionSummary(req), {
		hasCode: !!req.query.code,
		hasState: !!req.query.state,
		stateMatchesSession: !!(req.session && req.session[WebAppStrategy.STATE_PARAMETER] &&
			req.query.state && req.session[WebAppStrategy.STATE_PARAMETER].state === req.query.state),
		providerError: req.query.error || null,
		providerErrorDescription: req.query.error_description || null
	}));

	passport.authenticate(WebAppStrategy.STRATEGY_NAME, { keepSessionInfo: true },
		(err, user, info) => {
			if (err) {
				authLog('error', 'appid callback strategy error', { error: err.message, stack: err.stack });
				return res.redirect('/error');
			}
			if (!user) {
				authLog('error', 'appid callback authentication failed', {
					reason: info instanceof Error ? info.message : info,
					code: info && info.code,
					statusCode: info && info.statusCode
				});
				return res.redirect('/error');
			}
			req.logIn(user, { keepSessionInfo: true }, (loginErr) => {
				if (loginErr) {
					authLog('error', 'passport logIn failed', { error: loginErr.message, stack: loginErr.stack });
					return res.redirect('/error');
				}
				authLog('info', 'appid login successful', Object.assign(sessionSummary(req), {
					email: user.email ? String(user.email).replace(/^(.).*(@.*)$/, '$1***$2') : null
				}));
				res.redirect('/');
			});
		}
	)(req, res, next);
});

// Middleware: Auth user. keepSessionInfo evita que passport regenere la sesion (y borre el
// contexto de App ID) en cada peticion autenticada con exito
const requireAppIdLogin = passport.authenticate(WebAppStrategy.STRATEGY_NAME, { keepSessionInfo: true });

// Ruta: Cerrar sesion
// Middleware: Auth user
app.get("/logout",
	requireAppIdLogin, (req, res) => {
  		WebAppStrategy.logout(req);
  		res.redirect("/");
	});

// Ruta: Obtener el email
// Middleware: Auth user
app.get("/api/token", requireAppIdLogin,(req, res) => {

  var accessToken = req.session[WebAppStrategy.AUTH_CONTEXT].accessToken;
  var email = req.session[WebAppStrategy.AUTH_CONTEXT].identityTokenPayload.email;
  getInfo(email).then((uuid) =>{
  	res.json({
	  "email": email,
	  "token": accessToken,
	  "uuid": uuid
  	});
  }, function(err) {
        console.log(err);
  });

});

// Middleware: usuario autenticado (responde 401 en lugar de redirigir, para llamadas XHR)
function requireAuth(req, res, next) {
	const authContext = req.session && req.session[WebAppStrategy.AUTH_CONTEXT];
	if (authContext && authContext.accessToken) {
		return next();
	}
	res.status(401).json({ error: 'Unauthorized' });
}

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

// Middleware: Auth user
app.all("/api/coope/{*splat}", requireAuth, async (req, res) => {
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
});

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

// Middleware: Auth user
app.all("/api/cloudant/{*splat}", requireAuth, async (req, res) => {
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
});

// Ruta: Aplicacion Angular (archivos estaticos JS, CSS, assets sin trigger de login)
const angularDist = env === 'production' ? "/dist" : "/client/dist";
app.use(express.static(__dirname + angularDist, { index: false }));

// Ruta raiz y Fallback para Angular SPA (protegida con App ID)
app.get("/{*splat}",
	requireAppIdLogin,
	(req, res) => {
		res.sendFile(path.join(__dirname, angularDist, "index.html"));
	}
);

// Manejo de errores no controlados (se registra el detalle; el cliente solo recibe un mensaje generico)
app.use((err, req, res, next) => {
	authLog('error', 'unhandled error', { path: req.path, error: err && err.message, stack: err && err.stack });
	if (res.headersSent) {
		return next(err);
	}
	res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, HOST, () => {
	console.log(`Running on http://${HOST}:${PORT}`);
});

function getInfo ( email ){

	return new Promise(function (resolve, reject) {
		ibmdb.open(connStr, function (err,conn) {
			if (err) reject(err);
			// Save last login info
			let sqlins = `INSERT INTO ${process.env.DB2_SCHEMA}.USERSLOGIN (EMAILEMPLEADO, FECLOGIN) VALUES ('${email}', CURRENT TIMESTAMP);`;
			let sqlqry = `SELECT c.UUID FROM ${process.env.DB2_SCHEMA}.VWSOCIOSACTIVOS c WHERE c.EMAILEMPLEADO = '${email}' OR c.EMAILEMPLEADO2 = '${email}';`;

			conn.query(sqlins, function (err2, result) {
				if (err2) throw err2;
				console.log("1 record inserted into USERSLOGIN");
			  }),

			  conn.query(sqlqry, function (err, data) {
			  if (err) {
				reject(err);
			  } else {
				let uuid;
				uuid = data.length == 1 ? data[0].UUID.trim() : "";
	
				resolve(uuid);
			  }
	
			  conn.close();
			});
		  });
	 });
}
