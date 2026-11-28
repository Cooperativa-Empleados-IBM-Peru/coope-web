// Login y rol de Admin del usuario. La data vive en Db2 y se consulta SOLO a traves de coope-backend.
const backend = require('./backend');

async function postEmail(path, email) {
	const response = await backend.backendFetch(path, { method: 'POST', body: { email } });
	if (!response.ok) {
		throw new Error(`backend ${path} responded ${response.status}`);
	}
	return response.json();
}

/**
 * Registra el login y devuelve el uuid del socio y si es Admin.
 * @returns {Promise<{uuid: string, isAdmin: boolean}>}
 */
async function login(email) {
	const data = await postEmail('/users/login', email);
	return {
		uuid: typeof data.uuid === 'string' ? data.uuid : '',
		isAdmin: data.isAdmin === true
	};
}

/**
 * Es Admin solo si el usuario figura en la vista VWCOOPEADMINS de Db2.
 * @returns {Promise<boolean>}
 */
async function isAdmin(email) {
	const data = await postEmail('/users/is-admin', email);
	return data.isAdmin === true;
}

module.exports = { login, isAdmin };
