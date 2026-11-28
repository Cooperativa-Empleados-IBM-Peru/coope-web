// Datos de la sesion autenticada con App ID
const appID = require('ibmcloud-appid');

const AUTH_CONTEXT = appID.WebAppStrategy.AUTH_CONTEXT;

/** Contexto de autenticacion de la sesion, o undefined si no hay login */
function getAuthContext(req) {
	const authContext = req.session && req.session[AUTH_CONTEXT];
	return authContext && authContext.accessToken ? authContext : undefined;
}

/** Email del usuario autenticado, o undefined */
function getSessionEmail(req) {
	const authContext = getAuthContext(req);
	const email = authContext && authContext.identityTokenPayload && authContext.identityTokenPayload.email;
	return typeof email === 'string' && email.trim() ? email.trim() : undefined;
}

module.exports = { AUTH_CONTEXT, getAuthContext, getSessionEmail };
