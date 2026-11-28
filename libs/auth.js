const path = require("path");
const session = require("express-session");
const passport = require("passport");
const appID = require("ibmcloud-appid");
const { authLog, sessionSummary } = require("./logger");
const { getAuthContext } = require("./session");
const users = require("./users");

const WebAppStrategy = appID.WebAppStrategy;
const CALLBACK_URL = "/ibm/cloud/appid/callback";

// Middleware: usuario autenticado via App ID para vistas/rutas protegidas
const requireAppIdLogin = passport.authenticate(WebAppStrategy.STRATEGY_NAME, { keepSessionInfo: true });

// Middleware: usuario autenticado para APIs (responde 401 en lugar de redirigir a login, para llamadas XHR)
function requireAuth(req, res, next) {
	if (getAuthContext(req)) {
		return next();
	}
	res.status(401).json({ error: 'Unauthorized' });
}

/**
 * Configura la sesion, passport, la estrategia App ID y los endpoints de autenticacion
 */
function setupAuth(app, serviceUri) {
	const env = process.env.NODE_ENV || "dev";
	const isProduction = env === "production";
	const forceHttps = process.env.FORCE_HTTPS === "true" || isProduction;

	// Configurar la sesion de la aplicacion
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

	// Registrar cada peticion de autenticacion / navegacion (ignora archivos estaticos)
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
	const webAppStrategy = new WebAppStrategy({
		clientId: process.env.APPID_CLIENT_ID,
		tenantId: process.env.APPID_TENANT_ID,
		secret: process.env.APPID_SECRET,
		profilesUrl: process.env.APPID_PROFILES_URL,
		oauthServerUrl: process.env.APPID_OAUTH_SERVER_URL,
		redirectUri: serviceUri + CALLBACK_URL
	});

	passport.use(webAppStrategy);
	passport.serializeUser((user, cb) => cb(null, user));
	passport.deserializeUser((obj, cb) => cb(null, obj));

	// Rutas de autenticacion
	app.get("/error", (req, res) => {
		res.send("Authentication Error");
	});

	// Handle Login
	app.get('/login', passport.authenticate(WebAppStrategy.STRATEGY_NAME, {
		successRedirect: '/',
		forceLogin: true,
		keepSessionInfo: true
	}));

	// Handle Callback
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

	// Ruta: Cerrar sesion
	app.get("/logout", requireAppIdLogin, (req, res) => {
		WebAppStrategy.logout(req);
		res.redirect("/");
	});

	// Ruta: Obtener el email, token, uuid y rol (Admin) de la sesion.
	// El uuid y el rol se obtienen de Db2 a traves de coope-backend (nunca directamente).
	app.get("/api/token", requireAppIdLogin, (req, res) => {
		const authContext = req.session[WebAppStrategy.AUTH_CONTEXT];
		const accessToken = authContext.accessToken;
		const email = authContext.identityTokenPayload.email;
		users.login(email).then((info) => {
			res.json({
				email: email,
				token: accessToken,
				uuid: info.uuid,
				isAdmin: info.isAdmin
			});
		}).catch((err) => {
			authLog('error', 'api/token user lookup failed', { error: err && err.message });
			res.status(500).json({ error: "Failed to retrieve user info" });
		});
	});
}

module.exports = {
	CALLBACK_URL,
	requireAppIdLogin,
	requireAuth,
	setupAuth
};
