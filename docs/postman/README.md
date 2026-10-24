# Colección de pruebas — DriWin Hito 2

**Archivo:** [`DriWin_Hito2.postman_collection.json`](./DriWin_Hito2.postman_collection.json)
**Formato:** Postman Collection v2.1 (compatible con Thunder Client mediante importación de Postman).

## Importación

1. Abrir Postman → **Import** → *File* → seleccionar el JSON.
2. Editar las variables de colección:

| Variable | Valor |
|---|---|
| `baseUrl` | `http://localhost:3000/api/v1` |
| `apiKey` | La misma `API_KEY` de `server-api/.env` (rol read-write) |
| `readOnlyKey` | Opcional: `API_KEY_READ_ONLY` para demostrar el `403` |
| `componentId` | Se actualiza automáticamente al ejecutar el POST de hardware |
| `driverId` | Se actualiza automáticamente al ejecutar el POST de driver |
| `bloatwareId` | Se actualiza automáticamente al ejecutar el POST de bloatware |

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
