# Stage 1: Build
FROM registry.access.redhat.com/ubi10/nodejs-22:latest AS build

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

# Stage 2: Dependencias de producción del servidor (ibm_db necesita descargar el
# driver de Db2 y compilar/instalar el binario nativo)
FROM registry.access.redhat.com/ubi10/nodejs-22:latest AS deps

WORKDIR /opt/app-root/src

COPY --chown=1001:0 package.json package-lock.json ./

RUN --mount=type=cache,target=/opt/app-root/src/.npm,uid=1001 \
    npm ci --omit=dev --cache /opt/app-root/src/.npm

# Stage 3: Run
FROM registry.access.redhat.com/ubi10/nodejs-22-minimal:latest

# Instalar dependencias de runtime del driver Db2 (requiere root).
# libdb2 enlaza con libcrypt.so.1, que no viene en la imagen minimal.
USER 0
RUN microdnf install -y --setopt=install_weak_deps=0 --nodocs libxcrypt-compat && \
    microdnf clean all

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
