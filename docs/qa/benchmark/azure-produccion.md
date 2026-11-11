# Benchmark API DriWin — azure-produccion

- Fecha: 2026-11-11T03:19:45.583Z
- Destino: `driwin-api-hsgshffkeydpf2fe.canadacentral-01.azurewebsites.net` · modo `paced` (0.9 req/s)
- Muestras: 40 por endpoint, 20 ráfagas de inicio de 9 peticiones
- Cliente: Windows_NT 10.0.26200, Node v24.20.0. Percentil: nearest-rank, sólo respuestas con el estado esperado.
- Arranque en frío (excluido de la muestra): **809 ms**

| Escenario | n | Errores | P50 (ms) | P95 (ms) | P99 (ms) | Máx (ms) |
|---|---:|---:|---:|---:|---:|---:|
| health | 40 | 0 | 155.4 | 163.9 | 178.6 | 178.6 |
| bloatware | 40 | 0 | 158.6 | 190.2 | 254.5 | 254.5 |
| apps | 40 | 0 | 156.9 | 165.5 | 181.9 | 181.9 |
| driver-encontrado | 40 | 0 | 156.5 | 161.8 | 191.4 | 191.4 |
| driver-no-catalog | 40 | 0 | 157.5 | 165 | 188.6 | 188.6 |
| rafaga-inicio | 20 | 0 | 450.9 | 591 | 887.4 | 887.4 |
| conexion-nueva | 20 | 0 | 495.3 | 556.4 | 680.8 | 680.8 |

| Meta | Resultado | Cumple |
|---|---|:---:|
| P95 por petición ≤ 500 ms | 190.2 ms (peor endpoint) | ✅ |
| P95 ráfaga de inicio ≤ 1000 ms | 591 ms | ✅ |
| Errores = 0 | 0 | ✅ |
