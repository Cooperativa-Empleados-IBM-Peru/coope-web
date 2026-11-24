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
El registro de la aplicación en el SSO de IBMid se hace por la siguiente página :
- https://w3.ibm.com/security/sso-provisioner

