# Base de datos

El esquema y la semilla **no se duplican** en `server-api/`.

Fuente única de verdad: [`../../db/init.sql`](../../db/init.sql), que crea las 8 tablas,
índices, restricciones y datos representativos en PostgreSQL 16
(Azure Database for PostgreSQL Flexible Server).

La carpeta `server-api/src/repositories/` es la única que contiene SQL; cualquier cambio
de esquema debe reflejarse primero en `db/init.sql` y luego en el repositorio afectado.
