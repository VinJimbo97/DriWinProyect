# EXPLAIN ANALYZE — método y conclusiones

ISO/IEC 25010 · **Eficiencia de desempeño → utilización de recursos**. Referencia: *The Art of PostgreSQL* (índices justificados, sin `SELECT *`, SQL parametrizado, cuidado con `OFFSET`).

Script reproducible: `server-api/bench/explain.ts`. Desde `server-api`:

```
npx tsx bench/explain.ts --db postgresql://postgres@127.0.0.1:5544/postgres --label local-datos-reales
npx tsx bench/explain.ts --db postgresql://postgres@127.0.0.1:5544/postgres --label local-volumen-100k --scale 100000 --experiment
```

## Método

- **Se analiza el SQL real**, no una copia: el script llama a los repositorios de la API (`server-api/src/repositories`) e intercepta `pool.query` para anteponer `EXPLAIN (ANALYZE, BUFFERS)`.
- **Solo lecturas:** cualquier consulta que no sea `SELECT` se rechaza. El volumen simulado (`--scale`) y el experimento (`--experiment`) **solo funcionan contra `localhost`**.
- **Dos escenarios:**
  1. Datos reales del catálogo (`db/init.sql`): unas decenas de filas por tabla.
  2. **Volumen simulado:** 100.000 componentes con su driver, 10.000 cuentas, 30.000 sesiones y 5.000 suscripciones, seguido de `ANALYZE` para tener estadísticas al día. Muestra qué pasará cuando el negocio crezca.
- **¿Por qué el volumen simulado?** Con tablas pequeñas, PostgreSQL elige *Seq Scan* a propósito: si la tabla cabe en una página de 8 KB, leerla completa es más rápido que usar un índice. Un `EXPLAIN` sobre datos pequeños no demuestra si los índices sirven.

## Resultados

| Archivo | Escenario |
|---|---|
| [`local-datos-reales.md`](local-datos-reales.md) | Catálogo real: todas las consultas < 1 ms |
| [`local-volumen-100k.md`](local-volumen-100k.md) | 100.000 componentes + experimento del índice |
| [`local-volumen-100k-sin-indice.md`](local-volumen-100k-sin-indice.md) | Lo mismo después de aplicar la migración 011 |

Con 100.000 componentes, **todas las consultas que usa la app se ejecutan en menos de 0,25 ms** y usan índice donde importa:

| Consulta | Índice | Comentario |
|---|---|---|
| Driver óptimo (1 por dispositivo al abrir la app) | `uq_hardware_signature` → `uq_driver_recommendation` | Dos búsquedas por índice encadenadas |
| ¿Existe el hardware? (404) | `uq_hardware_signature` | |
| Sesión vigente (cada petición con cuenta) | `account_sessions_token_hash_key` | La consulta más frecuente con cuenta |
| Cuenta por correo (login) | `accounts_email_lookup_key` | Busca por la huella HMAC, nunca descifra |
| Equipos de la cuenta | `ux_account_device` | Por su prefijo `account_id` |
| Suscripción vigente | `idx_subscriptions_account` | `(account_id, ends_at DESC)` entrega la más reciente sin ordenar |
| Bloatware, políticas, apps | *Seq Scan* | Tablas de 4 a 120 filas: lo correcto es leerlas completas |

## Hallazgos

1. **Índice redundante `idx_hardware_lookup (ven_id, dev_id)` → eliminado (migración 011).**
   El índice de la restricción `uq_hardware_signature (ven_id, dev_id, subsys_id)` empieza por las mismas columnas. Experimento: se borró dentro de una transacción que se deshace (`BEGIN … ROLLBACK`) y las dos consultas pasaron a `uq_hardware_signature` **con el mismo tiempo**. Mantenerlo costaba ~3 MB por cada 100.000 componentes y una escritura extra en cada cambio del catálogo, sin acelerar nada.

2. **3 llaves foráneas sin índice → riesgo aceptado.**
   `bloatware_profile_policy.profile_id`, `subscriptions.tier_id` y `synthetic_users.tier_id`. Un índice en una FK solo acelera el **borrado o cambio de la fila padre**, y las tres apuntan a tablas diminutas que casi no cambian: 4 perfiles y 3 planes (`ON DELETE RESTRICT`). En cambio, el índice en `subscriptions.tier_id` encarecería **cada compra**. Si algún día los planes se pueden borrar, hay que agregarlo.

3. **Paginación con `OFFSET` en `GET /hardware-components` y `GET /driver-packages` → observación.**
   Con `OFFSET`, PostgreSQL lee y descarta todas las filas anteriores, así que la página 1.000 es más lenta que la 1. Son endpoints de administración (la app no los usa) con `limit` máximo de 100. Mejora futura: paginación por cursor (*keyset*, `WHERE component_id > $último`).

4. **Ya cumplido:** columnas explícitas (sin `SELECT *`), 100 % SQL parametrizado (`$1..$n`) y el usuario `driwin_api` con permisos mínimos (migración 007).

## Limitaciones

- Se ejecutó en PostgreSQL local en memoria (PGlite, PostgreSQL 17 compilado a WebAssembly) con el mismo esquema de producción. Los **planes** son comparables con Azure; los **tiempos absolutos** no.
- Para repetirlo contra Azure, el script acepta `--db` con la cadena de producción (solo lectura, sin `--scale` ni `--experiment`), desde Cloud Shell con la regla temporal de firewall.
