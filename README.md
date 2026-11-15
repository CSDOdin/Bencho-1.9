# Bencho 1:9

Sitio independiente de Bencho Burger, con su propia carta, panel `/admin`, API `/api`, sesión y almacenamiento. Repositorio: https://github.com/CSDOdin/Bencho-1.9.

## Desplegar en Netlify

1. Importa este repositorio como **un sitio nuevo**. Bencho Burger debe seguir conectado a `CSDOdin/Bencho-burger`.
2. Netlify lee `netlify.toml`: `npm run build`, carpeta `public`, funciones `netlify/functions`, Node 22 y dependencias del lockfile.
3. Configura `ADMIN_USER`, `ADMIN_PASSWORD_HASH` y `ADMIN_SECRET` en el sitio nuevo. Usa `node herramientas/generar-hash-admin.mjs` para generar el hash y un secreto aleatorio de al menos 32 caracteres. No subas credenciales al repositorio.
4. Elige el nombre del sitio nuevo. El build genera canonical, Open Graph, datos estructurados, robots y sitemap desde `SITE_URL` (opcional) o `URL` de Netlify. Vuelve a desplegar si cambia el dominio.
5. En `/admin` introduce precios, WhatsApp, horario y dirección reales. Revisa pagos y delivery antes de quitar el cierre manual.
6. En Netlify de **Bencho Burger**, agrega `BENCHO19_URL` con la URL HTTPS de este sitio y vuelve a desplegar. Eso conecta la notificación y el enlace del pie con esta página. Hasta configurarlo, esos enlaces indican y abren el Instagram oficial.

## Carta e identidad

Los 13 productos proceden del menú proporcionado. Los precios ausentes aparecen como Precio por confirmar. No se habilitan pedidos mientras falten los datos necesarios.

Interfaz negra y amarilla, portada con fotografía del negocio, comparación de Clásica, Doble y Triple, categorías y carrito en un panel accesible para móvil y escritorio. El favicon `public/images/brand.svg` es una marca tipográfica provisional; **no es el avatar oficial de Instagram**. Ver `ASSETS.md`.

La web prepara un mensaje de WhatsApp que el cliente debe enviar. El restaurante confirma disponibilidad, precio, pago y recepción. No almacena pedidos ni comprobantes.

## Separación de datos

Netlify Blobs usa almacenes `bencho19-*` y la sesión `__Host-bencho19_admin`. No comparte datos ni sesiones con Bencho Burger. Comienza con la carta inicial; los ajustes de la antigua vista previa no se migran automáticamente. Los datos de esa vista previa se conservan en el sitio original.

## Comprobar

`npm run build` comprueba sintaxis y genera metadatos. `npm test` comprueba rutas, sesión administrativa, CSRF, guardado, conflictos de edición y renderizado del menú con almacenamiento simulado. Requiere Node 22.15 o posterior para las pruebas. No utiliza datos de producción. La conversión de imágenes con Sharp no se simula; la dependencia se instala en Netlify.
