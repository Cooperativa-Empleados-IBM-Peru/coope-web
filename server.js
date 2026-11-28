const path = require("path");
const express = require("express");
const cors = require("cors");

// Configuracion del Dotenv (solo fuera de produccion: en produccion las variables vienen del entorno
// y dotenv es una devDependency que no se instala en la imagen)
if (process.env.NODE_ENV !== "production") {
	require("dotenv").config();
}

const { setupAuth, requireAppIdLogin, requireAuth } = require("./libs/auth");
const { handleDataApiProxy } = require("./libs/dataApiProxy");
const { handleCloudantProxy } = require("./libs/cloudantProxy");
const { authLog } = require("./libs/logger");

// Crear instancia Express
const app = express();

// Confiar en el proxy inverso (IBM Cloud Code Engine / Ingress)
app.enable("trust proxy");

// Constants
const PORT = process.env.PORT || 6001;
const HOST = "0.0.0.0";
const env = process.env.NODE_ENV || "dev";

// Service URI para redirecciones OAuth / CORS
let SERVICE_URI = "";
if (process.env.APPID_REDIRECT_URI) {
	SERVICE_URI = process.env.APPID_REDIRECT_URI;
} else if (env === "production") {
	SERVICE_URI = `https://${process.env.CE_APP}.${process.env.CE_SUBDOMAIN}.${process.env.CE_DOMAIN}`;
} else {
	SERVICE_URI = `http://localhost:${PORT}`;
}

// Configurar CORS
app.use(
	cors({
		origin: SERVICE_URI,
		optionsSuccessStatus: 200
	})
);

// parse application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));

// parse application/json
app.use(express.json());

// Configurar autenticacion (Sesion, Passport, App ID, Middleware y Rutas)
setupAuth(app, SERVICE_URI);

// Ruta: Revisar el estado de la aplicacion (sin autenticacion para health checks de Code Engine)
app.get("/health", (req, res) => {
	res.json({ status: "UP" });
});

// Proxies API (protegidos con autenticacion)
app.all("/api/coope/{*splat}", requireAuth, handleDataApiProxy);
app.all("/api/cloudant/{*splat}", requireAuth, handleCloudantProxy);

// Ruta: Aplicacion Angular (archivos estaticos JS, CSS, assets sin trigger de login)
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath, { index: false }));

// Ruta raiz y Fallback para Angular SPA (protegida con App ID)
app.get("/{*splat}", requireAppIdLogin, (req, res) => {
	res.sendFile(path.join(distPath, "index.html"));
});

// Manejo de errores no controlados (se registra el detalle; el cliente solo recibe un mensaje generico)
app.use((err, req, res, next) => {
	authLog("error", "unhandled error", {
		path: req.path,
		error: err && err.message,
		stack: err && err.stack
	});
	if (res.headersSent) {
		return next(err);
	}
	res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, HOST, () => {
	console.log(`Running on http://${HOST}:${PORT}`);
});
