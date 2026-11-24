# Cooperativa IBM Perú

Aplicación de la Cooperativa de Empleados de IBM Perú  
- v1.5.0 permite consultar las cuentas del socio  

Esta aplicación se ha desarrollado utilizando [Angular](https://angular.io/) y las librerías de [Carbon Design System](https://angular.carbondesignsystem.com/) para el UI.  
Utiliza el servivio AppId de IBM Cloud para el login con IBMId

La data de las cuentas del socio se guarda en db2  

## Arquitectura

- La aplicación se depliegua en una cuenta de IBM Cloud, en el servicio de Code Engine.  
- La imagen se construya con GH actions al momento de hacer merge al PR, también se puede - iniciar el action manualmente.  
- La imagen construida se guarda en un servicio de Container Registry en IBM Cloud.  
- La aplicación de web ui se conecta al backend (coope-dataapi) por el url interno dentro - de la aplicación de Code Engine.  
- Esta aplicación de UI primero construye la app de Angular en el folder `dist/`
- Luego, se levanta un servidor express (`server.js`) con node para publicar la app y controlar el acceso.   

## Menús de la aplicación
Los menús de la aplicación son :  

### SOCIOS 
- Préstamos
- Ahorros
- Aportaciones
- Calculadora de Pagos
- Calculadora de Certificados
- Reglamento de Crédito
- Tasas de Interes

### OTROS SERVICIOS
- FRA
- Previsión Social
- Asesoría Legal
- Consumo

### PROVEEDORES Y AVISOS
- Internos
- Proveedores
- Noticias

### ADMINISTRACION
- Lista de socios

## Sobre el acceso
El acceso a la aplicación se hace con el IBMId. Esto para permitir a los ex-empleados que son socios, que puedan acceder a la misma.  
El acceso con w3Id solo permite acceso a los actuales empleados de IBM  
El registro de la aplicación en IBMid se hace por la siguiente página :
- https://ies-provisioner.prod.identity-services.intranet.ibm.com/tools/sso/home

## Seteo de variables de entorno
Algunas variables de entorno usadas para conectarse a las bases de datos, o al IBMid (OpenId Connect)  
se setean en travis, en el archivo *travis.yml* y en variables de entorno en la configuración de Travis.  
Esto se hace asi por seguridad, pues no se pueden subir las llaves ni apikeys a Github.  
  
En Travis se define la siguiente variable para poder hacer deploy de la app en IBM Cloud.
- CF_APIKEY
  
A los siguientes nombres de variables definidas en Travis, se les agrega al final **_DEV** o **_PROD** según la branch (*dev* o *master*)
- APPID_ID
- APPID_OAUTHURL
- APPID_PROFILESURL
- APPID_REDIRECTURL
- APPID_SECRET
- APPID_TENANTID
  
- CLOUDANT_PWD
- CLOUDANT_URL
- CLOUDANT_USER
  
- COOPEAPI_URL
- COOPEAPI_APIKEY
- COOPEAPI_SECRET
  
- DB2_DATABASE
- DB2_HOSTNAME
- DB2_PASSWORD
- DB2_PORT
- DB2_USERNAME
- DB2_SCHEMA
