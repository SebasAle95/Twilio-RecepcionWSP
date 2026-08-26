# Política de Privacidad — Relevamientos WSP

Última actualización: 26 de agosto de 2026

## Qué es esta aplicación

Relevamientos WSP es una herramienta privada de uso interno que recibe mensajes
de WhatsApp con datos de ventas diarias de un conjunto de locales comerciales,
los ordena en una planilla de cálculo y la guarda en Google Drive.

No es un servicio público ni está disponible para usuarios generales. La usa un
único operador.

## Qué datos maneja

**Datos de los mensajes recibidos:** nombre del local, cantidad reportada,
fecha y número de teléfono del remitente. Estos datos llegan por WhatsApp a
través de Twilio y se guardan en una planilla `.xlsx`.

**Datos de Google:** la aplicación solicita el permiso
`https://www.googleapis.com/auth/drive.file`, que da acceso **únicamente a los
archivos que la propia aplicación crea**. No puede leer, modificar ni acceder a
ningún otro archivo de tu Google Drive.

El único archivo que la aplicación crea y modifica es `relevamientos.xlsx`.

## Cómo se usan

Los datos se usan exclusivamente para armar la planilla de relevamientos con sus
vistas diaria, semanal y mensual. No se analizan, no se combinan con otras
fuentes y no se usan para publicidad ni para elaborar perfiles.

## Con quién se comparten

Con nadie. Los datos no se venden, no se ceden y no se transfieren a terceros.

Los únicos servicios que intervienen son la infraestructura necesaria para que
la aplicación funcione:

- **Twilio** — recibe los mensajes de WhatsApp y los reenvía a la aplicación
- **Google Drive** — almacena la planilla
- **Railway** — ejecuta la aplicación

## Dónde se guardan

En Google Drive, dentro de la cuenta de Google del operador que autorizó la
aplicación. El acceso a la planilla lo controla esa persona mediante los
permisos de compartir de Google Drive.

## Cuánto tiempo se conservan

La planilla se conserva mientras el operador la mantenga en su Drive. Puede
borrarla en cualquier momento.

## Cómo revocar el acceso

Podés revocar el permiso de la aplicación en cualquier momento desde
[myaccount.google.com/permissions](https://myaccount.google.com/permissions).
Al hacerlo, la aplicación deja de poder escribir en Drive. La planilla ya
creada sigue siendo tuya y permanece en tu Drive.

## Contacto

Por consultas sobre esta política, escribir a la dirección de contacto
configurada en la pantalla de consentimiento de la aplicación.
