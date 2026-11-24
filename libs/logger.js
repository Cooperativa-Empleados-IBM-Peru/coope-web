const crypto = require("crypto");
const appID = require("ibmcloud-appid");

const WebAppStrategy = appID.WebAppStrategy;

/**
 * Logging estructurado de diagnostico de autenticacion (nunca registra tokens, codigos ni secretos)
 */
function authLog(level, message, extra) {
	const line = JSON.stringify(Object.assign({ ts: new Date().toISOString(), level, message }, extra));
	if (level === 'error') {
		console.error(line);
	} else {
		console.log(line);
	}
}

/**
 * Resumen de sesion seguro para diagnostico
 */
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

module.exports = {
	authLog,
	sessionSummary
};
