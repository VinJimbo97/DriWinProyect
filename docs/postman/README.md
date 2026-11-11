# Colección de pruebas — DriWin Hito 2

**Archivo:** [`DriWin_Hito2.postman_collection.json`](./DriWin_Hito2.postman_collection.json)
**Formato:** Postman Collection v2.1 (compatible con Thunder Client mediante importación de Postman).

## Importación

1. Abrir Postman → **Import** → *File* → seleccionar el JSON.
2. Editar las variables de colección:

| Variable | Valor |
|---|---|
| `baseUrl` | `http://localhost:3000/api/v1` |
| `apiKey` | La misma `API_KEY` de `server-api/.env` (única clave: escrituras del catálogo) |
| `componentId` | Se actualiza automáticamente al ejecutar el POST de hardware |
| `driverId` | Se actualiza automáticamente al ejecutar el POST de driver |
| `bloatwareId` | Se actualiza automáticamente al ejecutar el POST de bloatware |

## Ejecutar contra la API publicada en Azure (recomendado para la defensa)

Algunas redes (por ejemplo, la de la universidad) bloquean el puerto 5432 de
PostgreSQL, por lo que el backend local no alcanza la base de datos. La API
publicada en Azure App Service sólo usa HTTPS (443) y funciona desde cualquier red.

1. Postman → **Import** → seleccionar también
   [`DriWin_Azure.postman_environment.json`](./DriWin_Azure.postman_environment.json).
2. Arriba a la derecha, elegir el entorno **DriWin · Azure (producción)**.
   Sus variables reemplazan a las de la colección.
3. Completar `apiKey` **sólo en Postman**.
   El archivo del repositorio las trae vacías a propósito: nunca se versionan.
4. El plan gratuito (F1) se suspende sin uso: 2 minutos antes de presentar,
   ejecutar **01 · Health** hasta recibir `200` (la primera vez puede tardar ~60 s).

## Orden de ejecución para la defensa

1. **01 · Health** → demuestra que el servicio y PostgreSQL están arriba.
2. **02 · Hardware CRUD** → `POST 201` → `GET 200` (persistencia) → `PUT 200` → `DELETE 204`.
3. **03 · Driver Packages CRUD** → ciclo completo con URL relativa transformada a Azure Blob.
4. **04 · Bloatware Rules CRUD** → ciclo completo + `409` por firma duplicada.
5. **05 · Recommendations** → caso Javier (`1002/1638`, Gamer), alias Hito 1, `422` sin driver y unión Gamer+Creator.
6. **06 · Errores y seguridad** → `400`, `401`, `403`, `404`, `409` con el envoltorio único.

> Las peticiones de escritura usan datos sintéticos que no chocan con la semilla
> de `db/init.sql`; el orden incluye los `DELETE` para que la colección sea
> re-ejecutable.
