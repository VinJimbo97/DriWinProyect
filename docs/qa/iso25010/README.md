# Evaluación de calidad ISO/IEC 25010 — DriWin

Modelo de calidad de producto **ISO/IEC 25010:2011** (8 características) más calidad en uso.
Siguiendo el anexo C de la norma, **la calidad se mide**: cada fila tiene métrica → meta → resultado → evidencia.
DriWin está **alineado** con la norma; no es una certificación.

- **Fecha de medición:** 2026-11-11/12 · rama `feature/qa-hito3` (migraciones hasta la 011 aplicadas en Azure).
- **Estados:** ✅ cumple · ⚠️ cumple con observaciones o riesgo aceptado · ❌ no cumple · 📋 pendiente de medir.
- **Evidencia detallada:** [benchmark](../benchmark/README.md) · [EXPLAIN ANALYZE](../explain/README.md) · [STRIDE](../stride/README.md) · [navegación](../navegacion/README.md).

## Resumen

| Característica | Métricas | ✅ | ⚠️ | ❌ | 📋 |
|---|:---:|:---:|:---:|:---:|:---:|
| 1. Adecuación funcional | 3 | 1 | 2 | 0 | 0 |
| 2. Eficiencia de desempeño | 6 | 5 | 0 | 1 | 0 |
| 3. Compatibilidad | 3 | 3 | 0 | 0 | 0 |
| 4. Usabilidad | 6 | 5 | 1 | 0 | 0 |
| 5. Fiabilidad | 4 | 3 | 1 | 0 | 0 |
| 6. Seguridad | 7 | 6 | 1 | 0 | 0 |
| 7. Mantenibilidad | 6 | 5 | 1 | 0 | 0 |
| 8. Portabilidad | 3 | 3 | 0 | 0 | 0 |
| **Producto (total)** | **38** | **31** | **6** | **1** | **0** |
| Calidad en uso | 4 | 0 | 0 | 0 | 4 |

**Lectura:** 31 de 38 métricas de producto cumplen la meta (82 %). Las 6 con observaciones son riesgos conocidos y documentados. La única que no cumple es el **arranque en frío del servidor** (54 s), causado por el plan gratuito de Azure: es una decisión de costo del equipo y está mitigada en la app. La **calidad en uso** requiere pruebas con usuarios externos y queda planificada (sección 9).

## 1. Adecuación funcional

| Subcaracterística | Métrica | Meta | Resultado | Estado | Evidencia |
|---|---|---|---|:---:|---|
| Completitud funcional | Funciones del alcance acordado implementadas / acordadas | 100 % | **100 %** (15 de 15). Fuera del alcance por decisión del equipo (2026-11-09): "revisar al iniciar Windows", "quitar versiones antiguas" e "informe antes/después" | ✅ | Ver lista abajo |
| Corrección funcional | Tests automatizados que pasan / total | 100 % | **212 / 212** (API 105 · UI 30 · Electron 77). Pruebas manuales en hardware real hechas; falta "Instalar todo" con UAC real | ⚠️ | CI en cada PR; pruebas del equipo |
| Pertinencia funcional | Dispositivos del PC de muestra con driver en el catálogo / dispositivos detectados | Informativa | **3 / 9** (GPU NVIDIA, GPU Intel, Wi-Fi). El resto se muestra como "no catalogado" sin romper la lista | ⚠️ | Benchmark: escáner real del PC de muestra |

Alcance acordado (15): escaneo de hardware · recomendación de drivers por perfil · instalación verificada con UAC · apps con winget o página oficial · bloatware BAJO/MEDIO · cuentas (registro, sesión, hasta 3 equipos) · compra simulada · Instalar todo · bloatware ALTO con punto de restauración · respaldo de drivers · quitar dispositivos desconectados · soporte técnico · aviso de privacidad y consentimiento · descargar y borrar mis datos · idioma y tema.

**Observación (pertinencia):** el catálogo tiene 23 drivers reales. Ampliarlo, con fuentes oficiales y licencias revisadas, es lo que más aumenta el valor percibido.

## 2. Eficiencia de desempeño

| Subcaracterística | Métrica | Meta | Resultado | Estado | Evidencia |
|---|---|---|---|:---:|---|
| Comportamiento temporal | P95 por endpoint, Azure desde Chile | ≤ 500 ms | **190 ms** (peor endpoint) | ✅ | `benchmark/azure-produccion.md` |
| Comportamiento temporal | P95 de la ráfaga de inicio (9 consultas en paralelo) | ≤ 1.000 ms | **591 ms** | ✅ | ídem |
| Comportamiento temporal | Primera respuesta tras ~20 min sin uso (arranque en frío) | ≤ 10 s | **~54 s** | ❌ | Medido con cronómetro (2026-11-11) |
| Utilización de recursos | Ejecución de cada consulta de la app con 100.000 componentes | ≤ 1 ms | **< 0,25 ms** | ✅ | `explain/local-volumen-100k.md` |
| Utilización de recursos | Índices redundantes | 0 | **0** (se quitó `idx_hardware_lookup`, migración 011) | ✅ | `explain/README.md` |
| Capacidad | P99 y errores con 10 clientes concurrentes | ≤ 200 ms y 0 errores | **27,6 ms**, 0 errores en 2.400 peticiones (732 req/s) | ✅ | `benchmark/local-carga.md` |

**Por qué no cumple el arranque en frío:** el plan gratuito de Azure suspende la API sin uso. Fue una decisión de costo del equipo para el proyecto académico; un lanzamiento comercial requiere un plan con "Always On". **Mitigación aplicada:** timeout del cliente de 90 s (antes no había) y un aviso a los 5 s explicando que el servidor está despertando.

## 3. Compatibilidad

| Subcaracterística | Métrica | Meta | Resultado | Estado | Evidencia |
|---|---|---|---|:---:|---|
| Coexistencia | Instalaciones que usan el instalador **oficial y firmado** del fabricante, abierto de forma visible | 100 % | **100 %** (política de la app: sin modo silencioso, firma Authenticode válida) | ✅ | `installerPolicy.ts`, `driverInstaller.ts` |
| Coexistencia | El bloatware se quita solo para el usuario actual y se puede reinstalar | Sí | **Sí** (`Remove-AppxPackage` sin `-AllUsers`; Store, Edge, Defender y Windows Update excluidos) | ✅ | `bloatwarePolicy.ts` |
| Interoperabilidad | API versionada (`/api/v1`) con formato de error uniforme | Contrato verificado | **29 rutas**; 15 tests de contrato HTTP; colección Postman | ✅ | `api.contract.test.ts`, `docs/postman/` |

## 4. Usabilidad

| Subcaracterística | Métrica | Meta | Resultado | Estado | Evidencia |
|---|---|---|---|:---:|---|
| Reconocibilidad | La primera pantalla adapta el contenido a la persona | Sí | **Sí**: cuestionario de perfil al abrir por primera vez, con escaneo en paralelo | ✅ | `App.tsx` (onboarding) |
| Capacidad de aprendizaje | Funciones con ayuda contextual o explicación del bloqueo | Las de riesgo | **Sí**: botón **?** en riesgo del bloatware, contraseña y equipos; `title` con el motivo en los botones deshabilitados | ✅ | `HelpTip.tsx` |
| Operabilidad | Tareas alcanzables en ≤ 3 clics | 100 % | **21 / 21** (promedio 1,3 clics) | ✅ | `navegacion/README.md` |
| Protección frente a errores | Acciones destructivas con confirmación | 100 % | **4 / 4**: quitar apps, quitar equipo, borrar datos (con contraseña) y bloatware ALTO (punto de restauración obligatorio) | ✅ | `BloatwarePanel.tsx`, `AccountDialog.tsx` |
| Estética | Tema claro, oscuro y "igual que Windows" | Sí | **Sí** | ✅ | Configuración → General |
| Accesibilidad | Idiomas, lectores de pantalla y teclado | Revisión formal WCAG | **Parcial**: español e inglés con test de paridad; 49 atributos ARIA; Esc cierra los diálogos. **No** se hizo una auditoría WCAG formal | ⚠️ | `i18n.test.ts` |

## 5. Fiabilidad

| Subcaracterística | Métrica | Meta | Resultado | Estado | Evidencia |
|---|---|---|---|:---:|---|
| Madurez | Peticiones con error durante las pruebas de carga | 0 | **0** de 400 (Azure) y 0 de 2.400 (local) | ✅ | `benchmark/` |
| Disponibilidad | Servicio disponible sin degradación | Plan con SLA | **Plan gratuito sin SLA** y con arranque en frío; sin caídas durante las mediciones | ⚠️ | Decisión de costo (ver sección 2) |
| Tolerancia a fallos | Un fallo parcial no tumba la pantalla | Sí | **Sí**: un dispositivo no catalogado (404) no rompe la lista; timeouts de 5 s (BD) y 90 s (cliente); con la base caída `/health` responde 503 | ✅ | `useDriverRecommendations.ts`, `health.test.ts` |
| Recuperabilidad | Se puede volver atrás tras una acción del sistema | Sí | **Sí**: punto de restauración antes del bloatware ALTO, respaldo de drivers con `pnputil`, apps reinstalables desde la Store | ✅ | `restorePoint.ts`, `driverBackup.ts` |

## 6. Seguridad

| Subcaracterística | Métrica | Meta | Resultado | Estado | Evidencia |
|---|---|---|---|:---:|---|
| Confidencialidad | Datos personales guardados cifrados o con hash | 100 % | **100 %**: correo y mensajes con AES-256-GCM, contraseñas con scrypt, tokens como SHA-256; TLS en tránsito | ✅ | `crypto.ts`; test "nunca en texto plano" |
| Integridad | Instaladores verificados antes de ejecutarse (origen + SHA-256 + firma) | 100 % | **100 %** | ✅ | `installerPolicy.ts`; STRIDE T-01 |
| Integridad | Consultas SQL parametrizadas | 100 % | **100 %** (`$1..$n`, sin `SELECT *`) | ✅ | `explain/README.md` |
| No repudio | Consentimiento de privacidad con versión y fecha | 100 % de las cuentas nuevas | **100 %** (restricción `ck_account_privacy`) | ✅ | Migración 010; tests de privacidad |
| Responsabilidad | Cambios del catálogo atribuibles a una persona | Sí | **No**: se registra qué cambió (`requestId`), pero la clave de administración es compartida | ⚠️ | STRIDE R-01 (riesgo aceptado) |
| Autenticidad | Controles contra suplantación | Sin hallazgos abiertos | Bloqueo tras 5 intentos, límite por IP, respuestas genéricas, clave expuesta revocada | ✅ | STRIDE S-01..S-05 |
| Seguridad (global) | Vulnerabilidades altas o críticas en lo que llega al usuario | 0 | **0** (el CI falla si aparece una; Dependabot semanal). STRIDE: 25 de 31 amenazas mitigadas, 4 aceptadas, 2 mejoras | ✅ | `ci.yml`, `stride/README.md` |

## 7. Mantenibilidad

| Subcaracterística | Métrica | Meta | Resultado | Estado | Evidencia |
|---|---|---|---|:---:|---|
| Modularidad | Separación por capas sin SQL fuera de los repositorios | Sí | **Sí**: rutas → controladores → servicios → repositorios; en Electron, políticas separadas de la ejecución | ✅ | `server-api/src/`, `electron/*Policy.ts` |
| Reusabilidad | Un solo cliente HTTP y textos centralizados | Sí | **Sí**: `client.ts` es el único que llama a `fetch`; todos los textos están en i18n | ✅ | `src/api/client.ts`, `src/i18n/` |
| Analizabilidad | Errores rastreables y código verificado estáticamente | Sí | **Sí**: `requestId` en cada respuesta y log; TypeScript `strict`; lint sin avisos | ✅ | `requestLogger.ts`, `oxlint` |
| Modificabilidad | Migraciones que se pueden volver a ejecutar sin romper nada | 100 % | **10 / 10** | ✅ | `db/migrations/` |
| Capacidad de ser probado | Tests automáticos en cada PR, con BD real y permisos de producción | Sí | **212 tests** en el CI; integración con PostgreSQL real (PGlite) ejecutando como `driwin_api` | ✅ | `ci.yml`, `accounts.integration.test.ts` |
| Capacidad de ser probado | Cobertura de líneas medida | ≥ 70 % | **No medida** (no hay herramienta de cobertura configurada) | ⚠️ | Mejora propuesta |

## 8. Portabilidad

| Subcaracterística | Métrica | Meta | Resultado | Estado | Evidencia |
|---|---|---|---|:---:|---|
| Adaptabilidad | Sistemas e idiomas soportados | Win10 y Win11, es/en | **Sí**: `Win10_x64` y `Win11_x64`; español e inglés; URL de la API configurable | ✅ | `recommendation.schema.ts`, `.env.production` |
| Instalabilidad | Formas de instalación | Instalador y portable | **Sí**: instalador NSIS (elige la carpeta) y portable, ~121 MB cada uno (incluye el motor de Electron) | ✅ | `npm run dist:win` |
| Reemplazabilidad | El esquema corre en otro PostgreSQL sin cambios | Sí | **Sí**: el mismo `init.sql` y las mismas migraciones corren en Azure y en PostgreSQL local (PGlite) | ✅ | Tests de integración, `explain/` |

## 9. Calidad en uso (pendiente: requiere usuarios externos)

Hasta ahora todo lo medido fue con el equipo. La calidad en uso se mide **con personas reales**, así que se deja el protocolo listo:

| Característica | Métrica | Meta propuesta | Cómo medirla |
|---|---|---|---|
| Efectividad | Tareas completadas sin ayuda / intentadas | ≥ 90 % | 5 personas, 4 tareas: instalar un driver, instalar una app, quitar el bloatware sugerido, comprar Premium |
| Eficiencia | Tiempo por tarea | ≤ 2 min cada una | Cronómetro durante la misma sesión |
| Satisfacción | Puntaje SUS (*System Usability Scale*, 10 preguntas) | ≥ 68 (sobre el promedio) | Cuestionario al terminar |
| Libertad de riesgo | Personas que pudieron volver atrás tras un error | 100 % | Observación (cancelar el UAC, punto de restauración) |

## 10. Acciones derivadas

| Prioridad | Acción | Característica | Estado |
|---|---|---|---|
| Alta | Probar "Instalar todo" con UAC real en el PC de muestra | Adecuación funcional | Pendiente (equipo) |
| Alta | Prueba con 5 usuarios externos (sección 9) | Calidad en uso | Planificada |
| Media | Ampliar el catálogo con fuentes oficiales | Pertinencia funcional | Propuesta |
| Media | Plan con "Always On" antes de un lanzamiento comercial | Eficiencia / Fiabilidad | Decisión de costo documentada |
| Baja | Medir la cobertura de los tests | Mantenibilidad | Propuesta |
| Baja | Auditoría WCAG 2.1 AA | Usabilidad | Propuesta |
| Baja | Claves de administración por persona y firmante fijo por driver | Seguridad | Propuesta (STRIDE R-01, T-02) |
