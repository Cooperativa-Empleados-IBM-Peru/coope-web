# Stage 1: Build
FROM registry.access.redhat.com/ubi10/nodejs-22:latest AS build

# Establecer el directorio de trabajo (propiedad del usuario 1001 en la imagen base)
WORKDIR /opt/app-root/src

# Angular 12 (webpack 5) requiere el proveedor legacy de OpenSSL en Node >= 17
ENV NODE_OPTIONS=--openssl-legacy-provider

# Copiar los archivos de configuración del proyecto (angular.json, package.json, etc.)
COPY --chown=1001:0 /client .

# Instalar las dependencias necesarias y compilar la aplicación de Angular
RUN npm install && npm run build:prod

# Stage 2: Run
FROM registry.access.redhat.com/ubi10/nodejs-22-minimal:latest

# Instalar dependencias del sistema (requiere root)
USER 0
RUN microdnf install -y --setopt=install_weak_deps=0 --nodocs \
        gcc gcc-c++ make openssl openssl-devel bzip2-devel python3 libxml2 && \
    microdnf clean all

# Establecer el directorio de trabajo
WORKDIR /opt/app-root/src

# Copiar los archivos de configuración del proyecto (angular.json, package.json, etc.)
COPY --chown=1001:0 . .

# Copiar los archivos generados en el stage anterior
COPY --from=build --chown=1001:0 /opt/app-root/src/dist ./dist

# Ejecutar como usuario sin privilegios
USER 1001

# Instalar las dependencias de producción
RUN npm ci --omit=dev

# Set the NODE_ENV to production
ENV NODE_ENV=production

# Exponer el puerto en el que el servidor Express estará escuchando
EXPOSE 6001

# Definir el comando de inicio del servidor Express
CMD [ "npm", "start" ]
