# Stage 1: Build
FROM registry.access.redhat.com/ubi10/nodejs-22:10.3 AS build

# Establecer el directorio de trabajo (propiedad del usuario 1001 en la imagen base)
WORKDIR /opt/app-root/src

# Angular 12 (webpack 5) requiere el proveedor legacy de OpenSSL en Node >= 17
ENV NODE_OPTIONS=--openssl-legacy-provider

# Copiar solo los manifiestos para cachear la capa de dependencias
COPY --chown=1001:0 package.json package-lock.json ./

# Instalar las dependencias (la capa se reutiliza mientras no cambien los manifiestos)
RUN --mount=type=cache,target=/opt/app-root/src/.npm,uid=1001 \
    npm ci --cache /opt/app-root/src/.npm

# Copiar el resto del código y compilar la aplicación de Angular
COPY --chown=1001:0 . .
RUN npm run build:prod

# Stage 2: Dependencias de producción del servidor Express
FROM registry.access.redhat.com/ubi10/nodejs-22:10.3 AS deps

WORKDIR /opt/app-root/src

COPY --chown=1001:0 package.json package-lock.json ./

RUN --mount=type=cache,target=/opt/app-root/src/.npm,uid=1001 \
    npm ci --omit=dev --cache /opt/app-root/src/.npm

# Stage 3: Run (sin drivers nativos: la UI no se conecta a Db2 ni a Cloudant, solo a coope-backend)
FROM registry.access.redhat.com/ubi10/nodejs-22-minimal:10.3

# Establecer el directorio de trabajo
WORKDIR /opt/app-root/src

# Copiar solo lo necesario para ejecutar el servidor Express
COPY --chown=1001:0 package.json server.js ./
COPY --chown=1001:0 libs ./libs

# Copiar los archivos generados en el stage anterior
COPY --from=build --chown=1001:0 /opt/app-root/src/dist ./dist

# Copiar las dependencias de producción ya instaladas
COPY --from=deps --chown=1001:0 /opt/app-root/src/node_modules ./node_modules

# Ejecutar como usuario sin privilegios
USER 1001

# Exponer el puerto en el que el servidor Express estará escuchando
EXPOSE 6001

# Definir el comando de inicio del servidor Express
CMD [ "npm", "start" ]
