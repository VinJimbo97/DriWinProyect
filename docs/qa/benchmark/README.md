# Benchmark de la API — método y conclusiones

ISO/IEC 25010 · **Eficiencia de desempeño → comportamiento temporal y capacidad**.
Script reproducible: `server-api/bench/benchmark.mjs`. Desde `server-api`:

```
npm run bench -- --mode paced --base https://<app>.azurewebsites.net/api/v1 --label azure-produccion
npm run bench -- --mode load  --base http://localhost:4300/api/v1 --label local-carga --concurrency 10
```

## Método

- **Qué se mide:** latencia percibida por el cliente (desde que sale la petición hasta leer el cuerpo completo), en **percentiles P50 / P95 / P99** con el método *nearest-rank*. No se usa el promedio porque esconde la cola lenta (*Database Performance at Scale*).
- **Qué escenarios:** los que la app usa de verdad (`app-inicio-windows/src/api/driwin.ts`): reglas de bloatware, apps recomendadas, driver encontrado (200), driver no catalogado (404) y `/health`. Además, la **ráfaga de inicio**, que son las 9 consultas en paralelo que hace la app con los 9 dispositivos reales del PC de muestra (escáner y filtro de la app). Es lo que tarda en aparecer "Drivers a Actualizar".
- **Metas fijadas antes de medir:**

  | Escenario | Meta | Fundamento |
  |---|---|---|
  | Cada endpoint (Azure, desde Chile) | P95 ≤ 500 ms | Respuesta "inmediata" para una consulta individual |
  | Ráfaga de inicio (9 peticiones) | P95 ≤ 1.000 ms | Límite de 1 s de Nielsen para no romper el flujo de la persona |
  | Carga local (10 clientes concurrentes) | P99 ≤ 200 ms y 0 errores | El código de la API no debe ser el cuello de botella |

- **Azure sin estresar:** la API limita a 60 peticiones/min por IP y el plan F1 tiene 60 min de CPU al día. Por eso se mide a **0,9 peticiones/s**, intercalando los escenarios (round-robin) para que un cambio de la red afecte a todos por igual.
- **Local:** API compilada (`node dist/server.js`) con PostgreSQL en memoria (PGlite) y el límite de tasa desactivado solo para la prueba.

## Resultados

- [`azure-produccion.md`](azure-produccion.md): producción real (App Service F1, Canada Central) medida desde Chile. **Cumple las 3 metas.**
- [`local-carga.md`](local-carga.md): carga concurrente en local. **Cumple las 2 metas** (P99 27,6 ms; 732 peticiones/s; 0 errores).

## Conclusiones

1. **La latencia en producción es casi toda red.** Todos los endpoints tienen P50 ≈ 157 ms, que es el viaje de ida y vuelta Chile ↔ Canadá. En local, la API responde en 10 a 18 ms (P50). Mejorar el código casi no cambiaría lo que percibe la persona; lo que más ayudaría es **una región más cercana** (por ejemplo, Brazil South).
2. **Abrir una conexión HTTPS nueva cuesta unos 320 ms extra** (TCP + TLS: unos 2 viajes más a Canadá). Se comprobó aislándolo: el mismo `/health` tarda 160 ms con la conexión reutilizada y 481 ms con una conexión nueva. Por eso la ráfaga de inicio (P95 591 ms), que abre varias conexiones a la vez, es más lenta que una petición suelta.
3. **Hallazgo de método:** en la primera corrida, `/health` dio P95 = 518 ms (❌). No era el endpoint: era siempre la primera petición después de una pausa larga, cuando el cliente ya había cerrado la conexión. Se separó como métrica propia (`conexion-nueva`) y se volvió a medir. **Lección: revisar el método antes de aceptar un resultado.**
4. **El 404 (hardware no catalogado) hace 2 consultas** en vez de 1, para distinguir "no existe" (404) de "existe pero sin driver" (422). En local cuesta unos 7 ms más. En producción queda oculto bajo la red (P95 165 ms frente a 162 ms del caso 200). Se acepta por la precisión del mensaje.
5. **Arranque en frío del F1: ~54 s** (medido con cronómetro el 2026-11-11, abriendo `/health` tras ~20 min sin uso). El plan gratuito suspende la app sin uso. En las corridas del benchmark el servidor estaba despierto (0,8 a 1,8 s), por eso se midió aparte. Consecuencias:
   - El cliente de la app espera hasta **90 s** (`REQUEST_TIMEOUT_MS` en `app-inicio-windows/src/api/client.ts`) en vez de los 10 s de la regla "2 × timeout del servidor". Se partió con 60 s, pero con 54 s medidos el margen era de solo 6 s.
   - Es la **mayor debilidad de desempeño** de producción: la primera persona que abre la app tras un rato sin uso espera casi un minuto. **Decisión de costo del equipo:** se mantiene el plan gratuito durante el proyecto académico. Un lanzamiento comercial requiere un plan con "Always On"; con eso el timeout debe volver a 10 s.
   - Mitigación mientras tanto: a los 5 s de carga la app explica que el servidor está despertando (`LoadingServer` en `App.tsx`).

## Limitaciones

- Con n = 40, el **P99 coincide con el máximo**: es un valor orientativo. El P95 es la métrica confiable.
- Una sola ubicación de cliente (Chile, red doméstica) y una sola franja horaria.
- La prueba local usa PGlite (PostgreSQL compilado a WebAssembly, una conexión). Mide la capa de la API, no el rendimiento de Azure Database for PostgreSQL.
