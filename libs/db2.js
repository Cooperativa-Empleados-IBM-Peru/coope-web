const ibmdb = require('ibm_db');

function getConnStr() {
	return `DATABASE=${process.env.DB2_DATABASE};HOSTNAME=${process.env.DB2_HOSTNAME};UID=${process.env.DB2_USERNAME};PWD=${process.env.DB2_PASSWORD};PORT=${process.env.DB2_PORT};PROTOCOL=TCPIP;Security=SSL;`;
}

function getInfo(email) {
	const connStr = getConnStr();
	return new Promise(function (resolve, reject) {
		ibmdb.open(connStr, function (err, conn) {
			if (err) return reject(err);

			const schema = process.env.DB2_SCHEMA || 'COOPE';
			// Note: parameters should be escaped or parameterized where driver supports it
			const sqlins = `INSERT INTO ${schema}.USERSLOGIN (EMAILEMPLEADO, FECLOGIN) VALUES ('${email}', CURRENT TIMESTAMP);`;
			const sqlqry = `SELECT c.UUID FROM ${schema}.VWSOCIOSACTIVOS c WHERE c.EMAILEMPLEADO = '${email}' OR c.EMAILEMPLEADO2 = '${email}';`;

			conn.query(sqlins, function (err2) {
				if (err2) {
					console.error("Error inserting into USERSLOGIN:", err2);
				} else {
					console.log("1 record inserted into USERSLOGIN");
				}
			});

			conn.query(sqlqry, function (errQuery, data) {
				if (errQuery) {
					reject(errQuery);
				} else {
					const uuid = (data && data.length === 1 && data[0].UUID) ? data[0].UUID.trim() : "";
					resolve(uuid);
				}
				conn.close();
			});
		});
	});
}

module.exports = {
	getConnStr,
	getInfo
};
