# QA y seguridad — Hito 3

Evidencia medida y reproducible del aseguramiento de calidad de DriWin. **Empieza por la evaluación ISO/IEC 25010**, que resume todo lo demás.

| Documento | Qué responde | Referencia |
|---|---|---|
| [**ISO/IEC 25010**](iso25010/README.md) | ¿Qué tan bueno es el producto? 38 métricas: 31 ✅, 6 ⚠️, 1 ❌ | ISO/IEC 25010:2011, anexo C |
| [Benchmark de la API](benchmark/README.md) | ¿Qué tan rápida es? P50/P95/P99 en Azure y carga local | *Database Performance at Scale* |
| [EXPLAIN ANALYZE](explain/README.md) | ¿La base aguanta el crecimiento? Planes con 100.000 filas | *The Art of PostgreSQL* |
| [Modelo de amenazas STRIDE](stride/README.md) | ¿Qué puede salir mal y cómo se evita? 31 amenazas | Tanya Janca, *Alice and Bob Learn Secure Coding* |
| [Mapa de navegación](navegacion/README.md) | ¿Es fácil de usar? 21 tareas, todas en ≤ 3 clics | Pérez-Montoro, *Arquitectura de la información* |

## Cómo reproducir las mediciones

Desde `server-api`:

```
npm test                                   # 105 tests de la API (incluye integración con PostgreSQL)
npm run bench -- --mode paced --base https://<app>.azurewebsites.net/api/v1 --label azure-produccion
npx tsx bench/explain.ts --db <postgresql local> --label local-volumen-100k --scale 100000 --experiment
```

Desde `app-inicio-windows`: `npm test` (30 tests de UI + 77 de Electron).

El CI ejecuta los tests y la auditoría de dependencias en cada Pull Request (`.github/workflows/ci.yml`).
