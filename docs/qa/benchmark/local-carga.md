# Benchmark API DriWin — local-carga

- Fecha: 2026-11-11T03:02:03.920Z
- Destino: `localhost:4300` · modo `load` (10 clientes concurrentes)
- Muestras: 300 por endpoint, 100 ráfagas de inicio de 9 peticiones
- Cliente: Windows_NT 10.0.26200, Node v24.20.0. Percentil: nearest-rank, sólo respuestas con el estado esperado.
- Rendimiento: **732 peticiones/s**

| Escenario | n | Errores | P50 (ms) | P95 (ms) | P99 (ms) | Máx (ms) |
|---|---:|---:|---:|---:|---:|---:|
| health | 300 | 0 | 9.6 | 12.7 | 14.4 | 21.7 |
| bloatware | 300 | 0 | 17.5 | 23.2 | 25.9 | 30.8 |
| apps | 300 | 0 | 10.5 | 14 | 16.4 | 19.2 |
| driver-encontrado | 300 | 0 | 11 | 14.8 | 17.5 | 24.4 |
| driver-no-catalog | 300 | 0 | 18 | 24.4 | 27.6 | 38 |
| rafaga-inicio | 100 | 0 | 16.3 | 29.7 | 32.1 | 32.7 |

| Meta | Resultado | Cumple |
|---|---|:---:|
| P99 por petición ≤ 200 ms | 27.6 ms | ✅ |
| Errores = 0 | 0 | ✅ |
