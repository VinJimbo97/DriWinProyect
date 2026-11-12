# AUDITORÍA TÉCNICA BACK-END — DriWin (Hito 2)

**Documento fuente de verdad para el Documento Técnico del Back-End y la defensa del Hito 2**
**Asignatura:** INGT1003 — Universidad Mayor
**Equipo:** Vicente Acevedo (@VinJimbo97) · Javier Cáceres (@Ash-Lee213) · Joaquín Castillo (@joaquincastilloc)
**Repositorio:** `https://github.com/VinJimbo97/DriWinProyect.git`
**Rama auditada:** `feature/auditoria-vibecode` · **HEAD:** `01375c0` — *"Esquema con apps por perfil, reglas bloatware y usuarios sinteticos"*
**Rama `main`:** `999879e` — *"Propuesta de back end"* (4 commits detrás de la rama de trabajo)
**Fecha de auditoría:** 21 de octubre de 2026
**Licencia del producto:** MIT — `Copyright (c) 2026 Joaquín Castillo y Equipo DriWin`
> **Nota de revisión (12-11-2026).** Este documento es la **auditoría de la etapa de diseño (21-10-2026)** y se conserva como registro de cómo se planificó el back end. En esta revisión se reemplazó la capa local que estaba diseñada en **Rust + Tauri** por la que realmente se construyó, **TypeScript + Electron**; la razón está en la [§2.4](#24-capa-de-negocio-local--typescript--electron-diseñada-en-rust--tauri). Los demás estados (🟡 diseñado, hallazgos H-01 a H-14) describen el 21-10-2026: la API, las pruebas, el CI y la conexión del front ya están implementados. El estado actual está en el documento técnico (`docs/Hito2/DriWin_Documento_Tecnico_Hito2_actualizado.docx`), el [README](../../README.md), el [modelo de datos](../../db/modelo_datos.md) y la [carpeta de QA](../qa/README.md).

**Método de auditoría:** lectura directa de cada archivo del workspace (excluyendo `node_modules/`), historial completo de Git (`git log --all`, `git show`, `git log -S`), extracción de texto del PDF `docs/Propuesta_Tecnica.pdf`, barrido de secretos sobre el árbol **y** sobre toda la historia versionada, y verificación de versiones publicadas en el registro npm (`npm view`).

---

## Índice

1. [Leyenda de estado](#leyenda-de-estado)
2. [0. Resumen ejecutivo y hallazgos críticos](#0-resumen-ejecutivo-y-hallazgos-críticos)
3. [1. Árbol de directorios y separación de responsabilidades (B3 — 12 pts)](#1-árbol-de-directorios-y-separación-de-responsabilidades-criterio-b3--12-pts)
4. [2. Stack tecnológico y dependencias reales (A2 — 12 pts · B5 — 6 pts)](#2-stack-tecnológico-y-dependencias-reales-criterio-a2--12-pts-y-b5--6-pts)
5. [3. Contrato y diseño de la API REST / Endpoints (A1 — 15 pts · B2 — 14 pts)](#3-contrato-y-diseño-de-la-api-rest--endpoints-criterio-a1--15-pts-y-b2--14-pts)
6. [4. Trazabilidad y evolución respecto al Hito 1 (B1 — 8 pts)](#4-trazabilidad-y-evolución-respecto-al-hito-1-criterio-b1--8-pts)
7. [5. Persistencia en PostgreSQL y modelo de datos (B4 — 10 pts)](#5-persistencia-en-postgresql-y-modelo-de-datos-criterio-b4--10-pts)
8. [6. Credenciales, variables de entorno y seguridad (B4 — 10 pts)](#6-manejo-de-credenciales-variables-de-entorno-y-seguridad-criterio-b4--10-pts)
9. [7. Argumentos técnicos: monolito vs. distribuido (A3 — 8 pts)](#7-argumentos-técnicos-monolito-vs-distribuido-criterio-a3--8-pts)
10. [8. Instrucciones de ejecución reproducible](#8-instrucciones-de-ejecución-reproducible-puerta-de-entrada-hito-2)
11. [Anexo A. Inconsistencias detectadas UI ↔ modelo de datos](#anexo-a--inconsistencias-detectadas-entre-la-ui-y-el-modelo-de-datos)
12. [Anexo B. Mapa criterios → secciones y checklist de cierre](#anexo-b--mapa-de-criterios--secciones-y-checklist-de-cierre)

---

## Leyenda de estado

Todo lo que aparece en este documento está etiquetado con su estado real de implementación. **No se presenta como implementado nada que no exista en el código.**

| Símbolo | Significado | Uso en este documento |
|---|---|---|
| ✅ **IMPLEMENTADO** | Existe en el código del workspace y fue verificado línea por línea | Frontend React/TS, `db/init.sql`, documentación, `.gitignore`, licencias |
| 🟡 **DISEÑADO** | Contrato/especificación completa, **cero código** en el repositorio hoy | API REST Express/TS, capa local de escritorio (Electron/TypeScript), `.env.example` |
| ⚠️ **HALLAZGO** | Brecha, deuda técnica o inconsistencia detectada por la auditoría | Secciones 0 y A |

---

## 0. Resumen ejecutivo y hallazgos críticos

DriWin es una aplicación de automatización y gestión para entornos Windows que sustituye el enfoque de "repositorio de controladores" por una **arquitectura basada en intenciones**: el usuario declara *para qué* usa el PC (Gamer, Creator, Developer, Office) y el sistema cruza esa intención con el hardware detectado (`VEN_ID`/`DEV_ID`) para entregar controladores, aplicaciones y reglas de limpieza de bloatware.

**Estado real al 21-10-2026:** el repositorio contiene (a) un **prototipo de interfaz completo** en React + TypeScript + Vite, (b) un **esquema de base de datos completo y sembrado** en PostgreSQL (`db/init.sql`, 8 tablas), y (c) **toda la documentación de arquitectura** (diagramas Mermaid, caso de uso, estrategia de recolección, cumplimiento legal). **No contiene ningún código de back-end**: no existe servidor HTTP, no existe la capa local de escritorio (hoy `app-inicio-windows/electron/`), y el frontend **no realiza ni una sola petición de red** (`fetch`, `axios`, `invoke` → 0 ocurrencias).

### Tabla de hallazgos

| ID | Hallazgo | Severidad | Evidencia verificable | Estado |
|---|---|---|---|---|
| **H-01** | No existe implementación de la API REST (ni `routes`, ni `controllers`, ni `repositories`) | **Alta** | `git log --all --name-only` en 41 commits: jamás existió un archivo de servidor | 🟡 Diseñada en §3 de este documento |
| **H-02** | No existe la Capa de Negocio Local de escritorio (diseñada en Rust/Tauri) | **Alta** | Ausencia de una capa de escritorio en el árbol y en el historial | 🟡 Diseñada en §1.4; construida después en TypeScript/Electron (§2.4) |
| **H-03** | El frontend no consume ningún servicio: todos los datos son *mock* en `App.tsx` | **Alta** | `app-inicio-windows/src/App.tsx` líneas 39-54 (`useState` con arrays literales) | ⚠️ Requiere capa de servicios antes de la defensa funcional |
| **H-04** | No existe `.env` ni `.env.example` en ninguna parte del árbol | **Media** | `.gitignore` los declara y excluye, pero no hay archivo de ejemplo | 🟡 Estructura exacta en §6.3 |
| **H-05** | `db/init.sql` **no crea ni selecciona** la base de datos `driwin_catalog` (el literal no aparece en ninguna parte del repo ni de su historia) | **Media** | `git grep 'driwin_catalog' $(git rev-list --all)` → 0 resultados | ⚠️ Paso manual obligatorio en §8.4 |
| **H-06** | `package-lock.json` raíz huérfano: `lockfileVersion 3` con `packages: {}` y sin `package.json` raíz | **Baja** | Contenido literal del lock raíz; coincide con hallazgo H-07 del documento legal | ⚠️ Alinear (workspaces o eliminar) |
| **H-07** | Nombres de perfil divergentes entre UI y BD (`Desarrollador`/`Creador`/`Oficinista` vs `Developer`/`Creator`/`Office`) | **Media** | `App.tsx` líneas 151-173 vs `db/init.sql` líneas 184-188 | ⚠️ Anexo A |
| **H-08** | Datos de la pestaña Premium en USD (`$9.99`) vs modelo comercial en CLP (`subscription_tiers`) | **Media** | `App.tsx` línea 335 vs `db/init.sql` líneas 326-338 | ⚠️ Anexo A |
| **H-09** | Sin pruebas automatizadas, sin CI (no existe `.github/`), sin `Dockerfile` | **Media** | Árbol completo auditado | ⚠️ Plan en Anexo B |
| **H-10** | Nombres de bloatware de la UI no coinciden con `bloatware_rules` | **Baja** | `App.tsx` líneas 49-54 vs `init.sql` líneas 295-321 | ⚠️ Anexo A |
| **H-11** | `README.md` instruye `npm run dev` "dentro de la carpeta **app-inicio-Windows**" (case incorrecto: la real es `app-inicio-windows`) | **Baja** | `README.md` línea 46 | ⚠️ Corregir en Hito 2 |
| **H-12** | Código no commiteado en la rama: `.gitignore`, `app-inicio-windows/.gitignore`, `EstrategiaRecoleccionDatos.md` | **Informativa** | `git status --short` | ⚠️ Commitear antes de la entrega |
| **H-13** | No se detectaron credenciales hardcodeadas **ni en el árbol ni en toda la historia de Git** (0 coincidencias de `password`, `AccountKey=`, `Server=`, `*.postgres.database.azure.com`) | **Informativa** | `git log --all -S'password'` y `git grep` sobre `$(git rev-list --all)` | ✅ Limpio |
| **H-14** | Las URLs de Blob en `init.sql` apuntan a los contenedores reales `apps/` y `drivers/` pero los binarios no están verificados en el repositorio (son URLs sintéticas de semilla) | **Media** | 20 rutas `/apps/` y 12 rutas `/drivers/` | ⚠️ Documentado en H-05 del archivo legal |

### Veredicto para la defensa

> El **modelo de datos** y la **arquitectura documentada** están en nivel de entrega; la **implementación del back-end** es trabajo del Hito 2 en curso. Este documento entrega el contrato completo (§3), la estructura de carpetas exacta (§1.4), el modelo de persistencia (§5) y el procedimiento de ejecución (§8) para cerrar esa brecha de forma trazable con la propuesta del Hito 1 (§4).

---

## 1. Árbol de directorios y separación de responsabilidades (Criterio B3 — 12 pts)

### 1.1 Árbol completo del proyecto (excluye `node_modules/`, `.git/`, `target/`, `dist/`)

```text
DriWinProyect/
│
├── .gitignore                                    # Raíz — control de secretos, builds, editores (70 líneas)
├── LICENSE                                       # MIT — Copyright (c) 2026 Joaquín Castillo y Equipo DriWin
├── README.md                                     # Instrucciones de instalación (Hito 1) + equipo + prototipo en Vercel
├── THIRD_PARTY_LICENSES.md                       # Licencias de terceros, offloading y disclaimer (316 líneas)
├── package-lock.json                             # ⚠️ Huérfano: lockfileVersion 3, "packages": {}, sin package.json raíz
│
├── app-inicio-windows/                           # ── CAPA 1: PRESENTACIÓN / CLIENTE ──
│   ├── .gitignore                                # Defensa en profundidad para .env si se opera sin la raíz
│   ├── .oxlintrc.json                            # Config de lint: plugins react/typescript/oxc
│   ├── index.html                                # Punto de entrada HTML (div#root → /src/main.tsx)
│   ├── package.json                              # Manifiesto: react 19.2.8 / vite 8.2.2 / typescript 6.0.3
│   ├── package-lock.json                         # lockfileVersion 3 — 70 paquetes resueltos (3 prod + 67 dev)
│   ├── README.md                                 # Plantilla oficial React + TypeScript + Vite
│   ├── tsconfig.json                             # Project references → app + node
│   ├── tsconfig.app.json                         # Compilación de src/ (ES2023, DOM, jsx: react-jsx)
│   ├── tsconfig.node.json                        # Compilación de vite.config.ts
│   ├── vite.config.ts                            # Config de bundler: plugins: [react()]
│   ├── public/
│   │   ├── favicon.svg
│   │   └── icons.svg
│   └── src/
│       ├── main.tsx                              # createRoot(...).render(<StrictMode><App/></StrictMode>)
│       ├── App.tsx                               # Componente único (364 líneas): estado + 5 pestañas + modales UAC/Quiz
│       ├── styles/
│       │   └── theme.css                         # Design tokens CSS (254 líneas): --primary-color #00ADB5 etc.
│       └── assets/
│           ├── hero.png
│           ├── react.svg
│           └── vite.svg
│
├── db/
│   └── init.sql                                  # ── CAPA 5: PERSISTENCIA ── 449 líneas, 8 tablas, 4 índices, semilla
│
└── docs/                                         # ── DOCUMENTACIÓN / INFORMACIÓN DE ARQUITECTURA ──
    ├── Aspectos_Legales_Normativos_Licenciamiento_Hito2.md   # Auditoría de 70 dependencias y texto APA
    ├── Diagrama_Tecnico.png                      # Arquitectura cliente-servidor (Hito 1)
    ├── Diagrama_Usuario.png                      # Mapa de producto / arquitectura de información
    ├── Laminas_Presentacion_DriWin.pdf
    ├── Propuesta_Tecnica.pdf                     # Documento Hito 1 (sección 7: lenguajes; sección 8: capas)
    ├── backendInfo.md                            # ← ESTE DOCUMENTO
    └── DiagramaMD/
        ├── DiagramaBackEnd/
        │   ├── Borrador.md                       # Justificación PostgreSQL Flexible Server vs Azure SQL
        │   ├── DiagramaPrueba1.md                # Diagrama Mermaid de las 5 capas + patrón offloading
        │   ├── DescripcionDiagramaPrueba1.md     # Caso de uso Javier (Gamer) en 5 pasos, paso a paso
        │   └── EstrategiaRecoleccionDatos.md     # Fase 1 semilla manual / Fase 2 expansión (concepto a futuro)
        └── DiagramaFrontEnd/
            ├── DiagramaFlujo.md                  # Mermaid: flujo UAC → quiz → menú → API → errores
            └── DiagramaUsuario.md                # Mermaid: mapa de navegación de la interfaz
```

**Estructura que NO existe** (verificada en árbol *y* en `git log --all --name-only` sobre los 41 commits del repositorio):

```text
✗ electron/ (capa local) ✗ electron-builder ✗ server-api/       ✗ server/
✗ api/                  ✗ src/routes/        ✗ .env              ✗ .env.example
✗ Dockerfile            ✗ docker-compose.yml ✗ .github/workflows ✗ tests/ | *.test.ts
```

### 1.2 Clasificación por capas (criterio B3)

| # | Capa | Archivos/carpeta reales | Estado | Responsabilidad única |
|---|---|---|---|---|
| **1** | **Presentación / Cliente** (React, TypeScript, CSS) | `app-inicio-windows/src/main.tsx`, `src/App.tsx`, `src/styles/theme.css`, `index.html`, `public/*`, `src/assets/*`, `tsconfig*.json`, `vite.config.ts`, `.oxlintrc.json`, `package.json` | ✅ Implementado | Capturar decisiones del usuario (UAC, cuestionario de perfil, pestañas `driwin`/`apps`/`optimizar`/`configuracion`/`premium`) y renderizar la respuesta; **sin lógica de negocio ni acceso a datos** |
| **2** | **Negocio Local** (Electron + TypeScript, PowerShell/WMI/pnputil) | *(diseñada; hoy implementada)* `app-inicio-windows/electron/{hardwareScanner,driverInstaller,bloatwareCleaner}.ts`; *(especificada en)* `docs/DiagramaMD/DiagramaBackEnd/DescripcionDiagramaPrueba1.md` §1 y §5, `THIRD_PARTY_LICENSES.md` §3; *(simulada hoy en)* `App.tsx` `useEffect` de 2000 ms y `handleGrantUAC()` | 🟡 Diseñado (simulado en UI) | Elevar privilegios (UAC), detectar `VEN_ID`/`DEV_ID`/`subsys_id` vía `Get-CimInstance Win32_VideoController`/`Win32_PnPEntity` o registro `HKLM\SYSTEM\CurrentControlSet\Enum\PCI`, ejecutar `pnputil /add-driver` y desinstalar bloatware con `Get-AppxPackage \| Remove-AppxPackage` |
| **3** | **Ruteo / Controladores del Servidor** | *(diseñada)* `server-api/src/routes/*.routes.ts` + `server-api/src/controllers/*.controller.ts` | 🟡 Diseñado | Exponer los verbos HTTP de §3, validar payload con Zod, mapear DTO → código HTTP, **cero SQL** en esta capa |
| **4** | **Servicio / Lógica de negocio del Servidor** | *(diseñada)* `server-api/src/services/{recommendation,driver,hardware,app,bloatware,blobUrl}.service.ts`; *(reglas ya especificadas en)* `db/init.sql` líneas 354-449 (9 consultas de prueba) y `DescripcionDiagramaPrueba1.md` §2 | 🟡 Diseñado | Cruzar perfiles Gamer/Creator/Developer/Office con hardware detectado, resolver `UNION` de apps, decidir WHQL vs Game Ready/Studio, y **entregar la URL de Azure Blob Storage** sin transferir binarios |
| **5** | **Acceso a Datos / Persistencia** | ✅ `db/init.sql` (esquema + semilla + consultas); 🟡 *(diseñada)* `server-api/src/repositories/*.repository.ts` + `server-api/src/config/db.ts` (`pg.Pool` sobre Azure PostgreSQL Flexible Server) | Esquema ✅ / Repositorios 🟡 | Unicidad del acceso a `driwin_catalog` mediante SQL parametrizado; índices `idx_hardware_lookup`, `idx_driver_profile`, `idx_profile_apps_app`, `idx_synthetic_users_profiles` |

### 1.3 Recorrido completo de una petición de punta a punta (trazabilidad)

#### 1.3.1 Recorrido ACTUAL (verificado en código, sin red)

Este es el recorrido que hoy se puede ejecutar y demostrar:

| Paso | Archivo / función | Qué ocurre |
|---|---|---|
| 1 | `app-inicio-windows/index.html` → `<script type="module" src="/src/main.tsx">` | Vite sirve el entry point |
| 2 | `src/main.tsx` → `createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>)` | Montaje de React 19 |
| 3 | `src/App.tsx` → `useEffect(() => {...})` (líneas 57-64) | Lee `localStorage.getItem('driwin_profile')`; si existe → `setIsNewUser(false)` y `setActiveProfileTitle(...)` |
| 4 | `App.tsx` → `handleGrantUAC()` (líneas 76-81) | `setHasAdminRights(true)` (simula la elevación UAC) y abre `showQuiz` |
| 5 | `App.tsx` → `useEffect` con `setTimeout(..., 2000)` (líneas 67-74) | **Simulación** del escaneo paralelo de `VEN/DEV` → `setParallelScanDone(true)` (es el punto donde hoy entra la llamada IPC `hardware:scan` de Electron) |
| 6 | `App.tsx` → `handleProfileToggle()` y `completeQuiz()` (líneas 83-96) | Acumula `selectedProfiles: string[]`, construye `mainProfile = selectedProfiles.join(' & ')` y persiste en `localStorage` |
| 7 | `App.tsx` → render condicional `activeTab === 'driwin' \| 'apps' \| 'optimizar' \| 'configuracion' \| 'premium'` | Pintado del dashboard; `drivers.map(...)` sobre el array literal de la línea 39 |
| 8 | `App.tsx` → `installDriver(deviceName)` (líneas 98-100) | `setDrivers(prev => prev.map(...))` → cambia `installed: true`. **No hay descarga ni instalación reales** |
| 9 | `App.tsx` → `toggleBloatware(id)` y botón "Ejecutar Limpieza Instantánea" | `alert('Eliminando servicios y aplicaciones seleccionadas...')` — sin ejecución de PowerShell |

**Conclusión del recorrido actual:** la petición "de punta a punta" termina en el estado de React. No hay paso 10 hacia red, ni hacia SQL.

#### 1.3.2 Recorrido DISEÑADO (objetivo Hito 2 — nombres reales propuestos)

Corresponde al caso de uso de `DescripcionDiagramaPrueba1.md` (Javier, Gamer, `VEN_1002`/`DEV_1638`):

| Paso | Capa | Archivo → función/símbolo | SQL / dato que se invoca |
|---|---|---|---|
| 1 | Presentación | `App.tsx` → `handleGrantUAC()` → `completeQuiz()` | — (persiste perfil en `localStorage`) |
| 2 | Negocio Local | `electron/hardwareScanner.ts` → `scanHardware()` en el proceso main (canal IPC `hardware:scan`) → `execFile("powershell.exe", [..., "Get-CimInstance Win32_PnPSignedDriver ..."])` | Produce `ven_id: "1002"`, `dev_id: "1638"`, `os_environment: "Win11_x64"` |
| 3 | Presentación | `src/services/api.ts` → `postDriverRecommendation(payload)` → `fetch(\`${import.meta.env.VITE_API_BASE_URL}/api/v1/recommendations/driver\`, { method:'POST', headers:{'Content-Type':'application/json'} })` (público: la app no lleva claves) | Body: `{"ven_id":"1002","dev_id":"1638","os_environment":"Win11_x64","profiles":["Gamer"]}` |
| 4 | Ruteo | `server-api/src/app.ts` → `helmet()`, `cors({origin: VITE_ALLOWED_ORIGINS})`, `morgan('dev')` → `server-api/src/routes/index.ts` → `recommendations.routes.ts` → `POST /driver` | — |
| 5 | Ruteo | `server-api/src/controllers/recommendations.controller.ts` → `postDriverRecommendation(req,res,next)` → `middlewares/validate.ts(schemaDriverQuery)` (Zod) | 400 si `ven_id` no matchea `/^[0-9A-Fa-f]{4}$/` |
| 6 | Servicio | `server-api/src/services/recommendation.service.ts` → `resolveDriver(dto)` | — |
| 7 | Repositorio | `server-api/src/repositories/driver.repository.ts` → `findByHardwareAndProfiles(...)` → `pool.query(SQL, params)` (`config/db.ts` → `new pg.Pool({connectionString: DATABASE_URL, ssl:{rejectUnauthorized:false}})`) | Ver SQL abajo |
| 8 | BD | **Azure Database for PostgreSQL Flexible Server · `driwin_catalog`** | ```sql SELECT h.ven_id, h.dev_id, h.commercial_name, d.edition_name, d.version_number, d.download_url, d.silent_install_flags FROM driver_packages d INNER JOIN user_profiles p ON p.profile_id = d.profile_id INNER JOIN hardware_components h ON h.component_id = d.component_id WHERE p.profile_name = 'Gamer' AND h.ven_id = '1002' AND h.dev_id = '1638'; ``` (idéntica a la consulta N.º 8 de `db/init.sql` líneas 432-440) |
| 9 | Servicio | `recommendation.service.ts` → aplica reglas de negocio: prioriza `is_whql_certified = TRUE` para Office, `file_size_mb` ascendente, y adjunta `download_url` del contenedor `drivers/` | — |
| 10 | Ruteo | `recommendations.controller.ts` → `res.status(200).json({data: dto, meta: {...}})` → `middlewares/errorHandler.ts` en caso contrario | `200 OK` con JSON de ~1 KB |
| 11 | Presentación | `App.tsx` → columna "Drivers a Actualizar" → clic **Install** | — |
| 12 | Negocio Local | `electron/driverInstaller.ts` → `installDriver({ downloadUrl, sha256 })` (canal IPC `driver:install`) → descarga **directa** desde `https://driwinstorage.blob.core.windows.net/drivers/...` → verifica SHA-256 y firma Authenticode → abre el instalador del fabricante con UAC | Sin argumentos silenciosos: la persona ve y acepta los términos del fabricante (`silent_install_flags` quedó sin uso) |
| 13 | Blob | **Azure Blob Storage (`driwinstorage`, contenedor `drivers`)** entrega el binario de 540 MB **sin pasar por la API** | Offloading verificado en `DiagramaPrueba1.md` aristas 7-8 y `THIRD_PARTY_LICENSES.md` §2.3 |

> **Trazabilidad de la capa 4:** las 9 consultas de prueba de `db/init.sql` (líneas 354-449) son, en la práctica, la **especificación ejecutable** de los `services` que faltan: N.º 8 y N.º 9 alimentan `recommendation.service.resolveDriver()`, N.º 1-3 alimentan `resolveApps()`, N.º 6 alimenta `subscription.service.checkDeviceQuota()`, N.º 4-5 son las pruebas de integridad del repositorio.

### 1.4 Estructura de carpetas en capas — API Express/TS y Capa Local Electron

Diseño propuesto para las dos capas que hoy no existen. Se alinea con las capas 2, 3, 4 y 5 de §1.2 y con la separación **routes → controllers → services → repositories** pedida por el criterio B2.

```text
DriWinProyect/
│
├── server-api/                          # ── CAPAS 3 + 4 + 5: API REST en Azure (Node.js + Express + TS) ──
│   ├── package.json                     # scripts: dev (tsx watch), build (tsc), start (node dist), test (vitest)
│   ├── tsconfig.json                    # module: NodeNext, outDir: dist, strict: true
│   ├── .env.example                     # plantilla de variables (§6.3) — SÍ debe commitearse
│   ├── .env                             # valores reales — NUNCA se commitea (regla 1 de .gitignore)
│   └── src/
│       ├── server.ts                    # createServer(app).listen(PORT) + manejo de señales (graceful shutdown)
│       ├── app.ts                       # composición: helmet → cors → morgan → json → routes → 404 → errorHandler
│       ├── config/
│       │   ├── env.ts                   # lectura + validación de process.env con Zod (falla al arrancar si falta algo)
│       │   └── db.ts                    # export const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 10 })
│       ├── middlewares/
│       │   ├── errorHandler.ts          # traduce pg error codes (23505/23503/23514) → HTTP (409/422/400)
│       │   ├── validate.ts              # validate(schema) → 400 VALIDATION_ERROR con detalles campo a campo
│       │   ├── authenticate.ts          # X-API-Key / Authorization: Bearer → 401 UNAUTHORIZED
│       │   └── requestLogger.ts         # morgan + X-Request-Id para trazabilidad
│       ├── routes/                      # CAPA 3 — sólo declaran verbos y ensamblan middleware + controller
│       │   ├── index.ts                 # app.use('/api/v1', router) → versionado centralizado
│       │   ├── hardware.routes.ts
│       │   ├── drivers.routes.ts
│       │   ├── apps.routes.ts
│       │   ├── bloatware.routes.ts
│       │   ├── profiles.routes.ts
│       │   ├── subscriptions.routes.ts
│       │   ├── recommendations.routes.ts
│       │   └── health.routes.ts         # GET /api/v1/health → SELECT 1
│       ├── controllers/                 # CAPA 3 — req/res, status codes, sin SQL y sin reglas de negocio
│       │   ├── hardware.controller.ts
│       │   ├── drivers.controller.ts
│       │   ├── apps.controller.ts
│       │   ├── bloatware.controller.ts
│       │   ├── profiles.controller.ts
│       │   ├── subscriptions.controller.ts
│       │   └── recommendations.controller.ts
│       ├── services/                    # CAPA 4 — cruce de perfiles × hardware × políticas, entrega de URLs
│       │   ├── hardware.service.ts      # normaliza VEN/DEV (con/sin prefijo), valida firma única
│       │   ├── driver.service.ts        # selección por perfil + SO + certificación WHQL
│       │   ├── app.service.ts           # UNIÓN de apps por N perfiles seleccionados (DISTINCT)
│       │   ├── bloatware.service.ts     # aplica risk_level y omite reglas MEDIO/ALTO si perfil = Gamer
│       │   ├── subscription.service.ts  # límite de dispositivos (max_devices) vs active_devices_count
│       │   └── blobUrl.service.ts       # construye/entrega URL del contenedor (apps|drivers) + futuro SAS
│       ├── repositories/                # CAPA 5 — única fuente de SQL, 100 % parametrizado ($1..$n)
│       │   ├── hardware.repository.ts
│       │   ├── driver.repository.ts
│       │   ├── app.repository.ts
│       │   ├── bloatware.repository.ts
│       │   ├── profile.repository.ts
│       │   ├── syntheticUser.repository.ts
│       │   └── subscription.repository.ts
│       ├── domain/                      # contratos compartidos (interfaces / DTO) — sin dependencias externas
│       │   ├── hardware.types.ts        # interface HardwareComponent, HardwareSnapshot
│       │   ├── driver.types.ts          # interface DriverPackage, DriverRecommendationDto
│       │   ├── app.types.ts             # interface RecommendedApp, ProfileAppLink
│       │   ├── errors.ts                # class ApiError(status, code, message, details)
│       │   └── pagination.ts            # interface Page<T> { data: T[]; meta: {...} }
│       └── db/
│           └── README.md                # apunta a ../../db/init.sql como fuente única de esquema
│   └── tests/
│       ├── hardware.repository.test.ts  # integración contra BD de prueba
│       └── recommendations.e2e.test.ts  # supertest contra la app Express
│
└── app-inicio-windows/electron/        # ── CAPA 2: NEGOCIO LOCAL (Electron + TypeScript, proceso main en el PC cliente) ──
    ├── main.ts                          # ventana, protocolo app://driwin, canales IPC con verificación del emisor
    ├── preload.cts                      # contextBridge: expone window.driwin al front (sandbox + contextIsolation)
    ├── hardwareScanner.ts               # scanHardware() → PowerShell Get-CimInstance → VEN/DEV + versión del driver
    ├── driverInstaller.ts               # descarga, SHA-256, firma Authenticode y apertura del instalador del fabricante
    ├── installerPolicy.ts               # lista permitida de orígenes (solo driwinstorage/drivers/*.exe)
    ├── bloatwareCleaner.ts              # Get-AppxPackage / Remove-AppxPackage (solo el usuario actual)
    ├── bloatwarePolicy.ts               # paquetes permitidos y de riesgo alto
    ├── appInstaller.ts · appPolicy.ts   # winget --interactive con lista permitida
    └── elevated.ts                      # tareas con UAC: script fijo + datos en base64 (-EncodedCommand)
```

**Regla de dependencia entre capas (arquitectura limpia):** `routes → controllers → services → repositories → pg/PowerShell`. Ninguna flecha hacia atrás: el repositorio nunca conoce Express, el controller nunca escribe SQL, el servicio nunca arma `res.json()`. El front sólo conoce `src/services/api.ts`.

---

## 2. Stack tecnológico y dependencias reales (Criterio A2 — 12 pts y B5 — 6 pts)

### 2.1 Capa de Presentación — ✅ implementado (leído de `app-inicio-windows/package.json` y `package-lock.json`)

**Scripts disponibles:** `dev` → `vite` · `build` → `tsc -b && vite build` · `lint` → `oxlint` · `preview` → `vite preview`

#### Dependencias de producción (3 paquetes — se distribuyen con la app)

| Paquete | Versión declarada | Versión resuelta (lock) | Rol técnico | Problema técnico que resuelve en DriWin |
|---|---|---|---|---|
| `react` | `^19.2.8` | `19.2.8` | Biblioteca de UI declarativa | Permite el dashboard de 5 pestañas con estado reactivo (`drivers`, `bloatwareList`, `selectedProfiles`) sin mutar el DOM manualmente |
| `react-dom` | `^19.2.8` | `19.2.8` | Puente React ↔ DOM | Monta `<App/>` sobre `<div id="root">` en `main.tsx`; incluye `createRoot` de React 19 |
| `scheduler` | (transitiva) | `0.27.0` | Planificador de prioridades de React | Garantiza que la actualización de la lista de drivers no bloquee el renderizado (concurrent rendering) |

#### Dependencias de desarrollo (7 directas — cadena de compilación)

| Paquete | Versión declarada | Resuelta | Rol técnico | Problema técnico en DriWin |
|---|---|---|---|---|
| `vite` | `^8.2.2` | `8.2.2` | Bundler + servidor de desarrollo con HMR | Compila TSX a ESM en milisegundos; base del prototipo navegable publicado en Vercel |
| `@vitejs/plugin-react` | `^6.1.0` | `6.1.1` | Plugin oficial React (motor Oxc) | JSX transform + Fast Refresh para iterar la UI durante la defensa |
| `typescript` | `~6.0.2` | `6.0.3` | Compilador de tipos (Apache-2.0) | Obliga a que las interfaces `DriverItem` y `BloatwareItem` sean coherentes: `tsc -b` es parte del `build` |
| `oxlint` | `^1.79.0` | `1.81.0` | Linter estático (Oxc, escrito en Rust) | Reglas activas en `.oxlintrc.json`: `react/rules-of-hooks: error`, `react/only-export-components: warn` |
| `@types/node` | `^24.13.3` | `24.13.3` | Tipos de Node | Tipa `vite.config.ts` |
| `@types/react` | `^19.2.18` | `19.2.18` | Tipos de React | Tipa `useState<string[]>`, `useEffect` |
| `@types/react-dom` | `^19.2.4` | `19.2.7` | Tipos de ReactDOM | Tipa `createRoot` |

#### Transitivos relevantes (inventariados en `THIRD_PARTY_LICENSES.md` §5)

| Paquete | Versión | Licencia | Rol |
|---|---|---|---|
| `rolldown` + 15 binarios `@rolldown/binding-*` | 1.2.7 | MIT | Bundler nativo (Rust) usado por Vite 8 |
| `lightningcss` + 11 binarios | 1.33.0 | **MPL-2.0** | Minificación CSS — único copyleft débil, sólo de compilación |
| `@oxlint/binding-*` (19 binarios) | 1.81.0 | MIT | Binarios nativos del linter |
| `postcss` | 8.5.28 | MIT | Procesamiento de CSS |
| `nanoid`, `picocolors`, `picomatch`, `tinyglobby`, `fdir`, `csstype`, `source-map-js`, `undici-types`, `detect-libc` | — | MIT/ISC/BSD/Apache | Utilidades de la cadena |

**Total: 70 paquetes resueltos** (54 MIT · 2 Apache-2.0 · 1 ISC · 1 BSD-3-Clause · 12 MPL-2.0 · **0 GPL/AGPL/LGPL/SSPL**). Fuente: `app-inicio-windows/package-lock.json` (`lockfileVersion: 3`).

### 2.2 Persistencia — ✅ implementado como script / 🟡 gestionado en Azure

| Tecnología | Versión | Fuente en el repo | Rol técnico | Problema técnico |
|---|---|---|---|---|
| **PostgreSQL** | **16** (Azure Database for PostgreSQL **Flexible Server**) | `db/init.sql` línea 3 | Motor relacional de destino | Integridad referencial del catálogo VEN/DEV → paquete; tipos `TEXT[]`, `NUMERIC(12,2)`, `BOOLEAN`, `CHECK` |
| Índices | 4 | `init.sql` líneas 56, 84, 117, 174 | `idx_hardware_lookup (ven_id, dev_id)`, `idx_driver_profile`, `idx_profile_apps_app`, **GIN** en `selected_profiles_array` | Aceleran los pasos 2 y 5 del caso de uso |
| Patrón de seed | idempotente | `init.sql` líneas 13-23 | `DROP ... IF EXISTS ... CASCADE` en orden hijas → padres | Reproducible N veces en un equipo limpio |

### 2.3 Almacenamiento binario — ✅ especificado

| Servicio | Recurso | Evidencia | Rol |
|---|---|---|---|
| **Azure Blob Storage** | cuenta `driwinstorage` (`https://driwinstorage.blob.core.windows.net`) | 32 URLs en `init.sql` (20 en `/apps/`, 12 en `/drivers/`) | Offloading: la API entrega **sólo metadata** (~1 KB) y el binario pesado (hasta 2.900 MB en `DaVinci Resolve`) va cliente → Blob |
| Tipos de blob | `Hot` LRS (diseño) | `Borrador.md`, `DiagramaPrueba1.md` | Acceso frecuente a bajo costo dentro de los créditos Azure for Students |

### 2.4 Capa de Negocio Local — TypeScript + Electron (diseñada en Rust + Tauri)

| Tecnología | Versión en el proyecto | Rol técnico | Problema técnico en DriWin |
|---|---|---|---|
| `electron` | `44.11.0` (fijada) | Runtime de escritorio: Chromium para la interfaz + Node.js en el proceso main | Ejecuta la app React como programa de Windows y da acceso controlado al sistema desde el proceso main |
| `electron-builder` | `26.17.0` | Empaquetado | Genera el instalador NSIS y la versión portable (`npm run dist:win`) |
| **TypeScript** (lenguaje) | `~6.0.2` | Lenguaje de la capa local, igual que en el front y la API | Los mismos tipos y herramientas en todo el proyecto; `child_process.execFile` lanza `powershell.exe` sin pasar por una consola |
| PowerShell / WMI-CIM | incluido en Windows | APIs de sistema | `Get-CimInstance Win32_VideoController`, `Win32_PnPEntity`, `Get-AppxPackage`; registro `HKLM\SYSTEM\CurrentControlSet\Enum\PCI\VEN_xxxx&DEV_xxxx` |

> **Por qué TypeScript + Electron y no Rust + Tauri (decisión tomada al construir la capa local).** En esta auditoría (21-10) la capa local estaba diseñada en Rust con Tauri, siguiendo el argumento "Uso a bajo nivel: Muy Alta" del Hito 1. Al construirla comparamos tres alternativas:
>
> | Criterio | Rust + Tauri (diseño del 21-10) | **TypeScript + Electron (construido)** | C# + WinUI 3 (descartada en el Hito 1) |
> |---|---|---|---|
> | Conocimiento del equipo | Nadie lo dominaba; el propio Hito 1 lo calificó de "tarea complicada" | **Todo el equipo ya usa TypeScript** en el front y en la API | Nadie lo dominaba |
> | Un solo lenguaje en el proyecto | No: Rust en la app y TypeScript en el resto | **Sí**: mismos tipos, linter y forma de probar en app, API y pruebas | No |
> | Acceso a Windows (WMI/CIM, pnputil, Appx, winget, UAC) | `std::process::Command` → PowerShell | `child_process.execFile` → PowerShell: **el mismo mecanismo** | APIs nativas de .NET |
> | Aislamiento del código con privilegios | *capabilities* de Tauri | `contextIsolation`, `sandbox`, verificación del emisor en cada canal IPC y Content-Security-Policy | Modelo de la app nativa |
> | Tamaño del instalador | **Pocos MB** (usa el WebView2 que trae Windows) | ~121 MB (incluye su propio Chromium) | Intermedio (depende del runtime de .NET) |
> | Consumo de memoria | Bajo | Mayor (un proceso de Chromium) | Medio |
> | Pruebas | Herramientas propias de Rust (`cargo test`) | Las mismas de Node (`node --test`): 77 pruebas de Electron | Herramientas propias de .NET |
>
> **El argumento decisivo:** la lectura de hardware que justificaba Rust en el Hito 1 la hace **PowerShell (WMI/CIM)** en cualquiera de los diseños. Rust solo habría sido el intermediario que lanza ese proceso y lee su salida, así que su ventaja (seguridad de memoria y control de bajo nivel) no se aprovechaba, mientras que su costo (aprender un lenguaje nuevo en pocas semanas) sí caía sobre la entrega. Con TypeScript, los tres integrantes pueden mantener y explicar toda la app, que es lo que pide la defensa.
>
> **Costo asumido:** instalador de ~121 MB y más memoria que Tauri. **Mitigación:** la app se instala una sola vez, los drivers pesados no van dentro del instalador (se descargan de Blob cuando se necesitan) y hay versión portable. **Cuándo lo revisaríamos:** si el tamaño o la memoria se vuelven una queja real de usuarios; Tauri 2 permite reutilizar el mismo front React, así que solo habría que reescribir la capa local.
>
> Igual que en el diseño original, este código **nunca se expone a Internet**: vive en el PC de la persona y solo ejecuta tareas fijas.

### 2.5 API REST en la nube — 🟡 diseñada (Node.js + Express + TypeScript)

Versiones publicadas verificadas con `npm view` el 21-10-2026:

| Paquete | Versión verificada | Rol técnico | Problema técnico que resuelve en DriWin |
|---|---|---|---|
| `express` | **5.3.0** | Framework web (ruteo, middleware, HTTP) | Sustituye el manejo manual de `http.createServer`; soporte nativo de rutas con parámetros `:id` y promesas en handlers (v5) |
| `pg` | **8.23.1** | Cliente JDBC-ish para PostgreSQL | `Pool` con conexiones reutilizables a Azure Flexible Server; SQL parametrizado `$1..$n` → inyección SQL imposible |
| `@types/express` | 5.0.6 | Tipos de Express | `Request`, `Response`, `NextFunction` tipados estrictos |
| `@types/pg` | 8.23.1 | Tipos del driver | `QueryResult<T>` tipado: cada fila del `SELECT` es un DTO conocido |
| `cors` + `@types/cors` | 2.8.6 / 2.8.19 | Manejo de CORS | Restringe el origen del prototipo (Vercel/local) contra el API desplegado en Azure (B20: evita que otro sitio consuma el API) |
| `helmet` | 8.3.0 | Cabeceras de seguridad HTTP | `X-Content-Type-Options`, `Strict-Transport-Security`, CSP: reduce la superficie de ataque del servicio público |
| `morgan` | 1.12.1 | Log de requests | Trazabilidad de cada petición durante la demo |
| `dotenv` | 18.0.8 | Carga de `.env` a `process.env` | Separa secreto (`DATABASE_URL`) del código (criterio B4) |
| `zod` | 4.6.7 | Validación/esquema de payloads | Valida `ven_id`, `dev_id`, `risk_level`, `profiles[]` antes de tocar la BD → `400` temprano |
| `express-rate-limit` | 8.7.1 | Limitación de tasa | Protege el endpoint de recomendación de abuso (es el único que dispara consultas) |
| `tsx` | 4.23.1 | Runner TS en tiempo de ejecución | `npm run dev` sin paso de compilación |
| `typescript` | 6.0.3 (fijado en el proyecto; registry: 7.0.2) | Compilación de tipos | Un único lenguaje (TS) en front y back |
| `vitest` + `supertest` | 5.0.5 / 7.3.1 | Tests unitarios y e2e del API | Cierra el hallazgo H-09 (sin pruebas) |

**Decisión de arquitectura registrada (enfoque dual):**

> La **Capa de Negocio** definida en el Hito 1 se divide en dos dominios con tecnologías distintas y justificación explícita:
>
> 1. **TypeScript (Electron) → Capa de Negocio LOCAL** (en el diseño del 21-10 era Rust con Tauri; ver §2.4), estrictamente confinada al PC del cliente: ejecución a bajo nivel de PowerShell/WMI/pnputil, lectura de `VEN_ID`/`DEV_ID`, instalación desatendida y limpieza de bloatware. Requiere privilegios elevados y **nunca** debe exponerse a Internet.
> 2. **Node.js + Express + TypeScript → runtime oficial de la API REST en la nube** para el Hito 2, usando el driver `pg` sobre Azure PostgreSQL.
>
> **Argumento técnico de este refinamiento:** la API cloud es **I/O-bound** por naturaleza (espera consultas SQL y devuelve texto: nombres + URLs), no CPU-bound. En cargas I/O-bound el modelo de eventos de Node.js entrega rendimiento comparable al de un runtime hilos, y a cambio obtiene: (a) **unificación de TypeScript e interfaces de datos con el Front-End React** (el mismo `DriverPackage` puede vivir en un paquete compartido), (b) **reducción de la curva de aprendizaje para los 3 integrantes** (ya dominan TS desde el Hito 1), y (c) **garantía de cumplimiento de plazos** del Hito 2.
> **Costo asumido:** mayor consumo de RAM en el servidor frente a un equivalente Rust. **Mitigación:** toda la descarga de binarios pesados (`.exe`/`.msi`/`.cab`) se delega a **Azure Blob Storage** mediante el patrón de *offloading*, de modo que el proceso Node sólo serializa JSON de ~1 KB por petición y su huella de memoria permanece acotada y plana.

---

## 3. Contrato y diseño de la API REST / Endpoints (Criterio A1 — 15 pts y B2 — 14 pts)

> **Estado de esta sección:** ✅ **IMPLEMENTADO** para `health`, `hardware-components`, `driver-packages`, `bloatware-rules`, `recommendations/driver` y `recommendations/apps` (código en `server-api/`). 🟡 **DISEÑADO** para `recommended-apps`, `user-profiles`, `profile-apps`, `synthetic-users` y `subscription-tiers`, que quedan como trabajo del Hito 3. El contrato se deriva de las tablas reales de `db/init.sql` y del flujo documentado en `docs/DiagramaMD/DiagramaBackEnd/DescripcionDiagramaPrueba1.md`.

### 3.1 Convenciones del contrato

| Aspecto | Decisión | Detalle |
|---|---|---|
| **Base URL** | `https://<api-host>/api/v1` | **Versionado en la ruta** (`/api/v1/...`): romper compatibilidad ⇒ `/api/v2`. El prefijo `/api` separa el contrato público del resto del servidor. Rutas de control: `/api/v1/health` |
| **Formato** | JSON UTF-8 | `Content-Type: application/json; charset=utf-8` en request y response |
| **Identificadores** | Enteros `SERIAL` devueltos como `id` | `component_id`, `driver_id`, `app_id`… Se expone el nombre corto en el DTO y se mapea al nombre de columna en el repositorio |
| **Listados** | Paginación obligatoria | Query: `?page=1&limit=20&sort=created_at&order=desc` → `meta.total`, `meta.totalPages` |
| **Idempotencia** | Header `Idempotency-Key` opcional en `POST` | Evita duplicados si el cliente reintenta |
| **CORS** | Orígenes allowlist | `https://driwin.vercel.app` (prototipo) + `http://localhost:5173` (dev) |
| **Autenticación** | `X-API-Key` o `Authorization: Bearer <jwt>` | Requerida sólo en los verbos de escritura del catálogo (`POST/PUT/PATCH/DELETE`), con la única clave de administración `API_KEY`. Lecturas y recomendaciones son **públicas** (la app no lleva claves). `401` si falta en una escritura o si llega una clave inválida en cualquier ruta |
| **Cache** | `Cache-Control: public, max-age=60` en catálogos | Catálogos (hardware, apps) cambian poco: reduce carga del Flexible Server |
| **Idioma/fechas** | ISO-8601 UTC | `"2026-09-15T00:00:00.000Z"` para `release_date`/`created_at` |

**Cabeceras estándar de petición**

```http
Content-Type: application/json
Accept: application/json
X-API-Key: <DRIWIN_API_KEY>              # sólo en escrituras de administración (o Authorization: Bearer)
X-Request-Id: req_01J8Z...               # trazabilidad (opcional; el server lo genera si falta)
Idempotency-Key: 3f0c...                 # sólo en POST
```

**Estructura de respuesta exitosa (envoltorio único)**

```json
{
  "data": { },
  "meta": { }
}
```

**Estructura de error (única para todo el API)**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Payload inválido",
    "details": [
      { "field": "ven_id", "issue": "Debe ser hexadecimal de 4 dígitos (ej: 1002)" },
      { "field": "profile_id", "issue": "Debe ser un entero mayor que 0" }
    ],
    "timestamp": "2026-10-21T14:03:12.184Z",
    "path": "/api/v1/hardware-components",
    "requestId": "req_01J8ZK5VQ2",
    "hint": "https://driwin-api.azurewebsites.net/api/v1/errores#validation_error"
  }
}
```

**Códigos de estado utilizados (contrato completo)**

| HTTP | `error.code` | Cuándo se dispara en DriWin |
|---|---|---|
| `200 OK` | — | Lectura o actualización exitosa |
| `201 Created` | — | `POST` exitoso; incluye `Location: /api/v1/<recurso>/<id>` |
| `204 No Content` | — | `DELETE` exitoso (sin cuerpo) |
| `400 Bad Request` | `VALIDATION_ERROR` | JSON malformado o schema Zod fallido (ej. `ven_id = "AMD"`) |
| `401 Unauthorized` | `UNAUTHORIZED` | Falta o es inválida la cabecera `X-API-Key`/`Bearer` |
| `404 Not Found` | `NOT_FOUND` | `component_id = 999` inexistente o ruta desconocida |
| `409 Conflict` | `CONFLICT` | Violación de `UNIQUE` (firma `ven_id+dev_id+subsys_id`, `uq_driver_recommendation`, `uq_bloatware_signature`, `app_name`, `email`) |
| `422 Unprocessable Entity` | `FK_VIOLATION` / `BUSINESS_RULE_VIOLATION` | FK inexistente (23503) o regla de negocio (ej. `active_devices_count > max_devices`) |
| `429 Too Many Requests` | `RATE_LIMITED` | `express-rate-limit` superado (60 req/min/IP) |
| `500 Internal Server Error` | `INTERNAL_ERROR` | Caída de BD, timeout; nunca expone stack trace |
| `503 Service Unavailable` | `DB_UNAVAILABLE` | `pg.Pool` no responde a `SELECT 1` en `/health` |

> Mapeo técnico de errores PostgreSQL → HTTP (implementado en `middlewares/errorHandler.ts`): `23505` unique_violation → `409`, `23503` foreign_key_violation → `422`, `23514` check_violation → `400`, `42P01` undefined_table → `500`, `53300` too_many_connections → `503`.

### 3.2 Tabla maestra de recursos

| # | Recurso (ruta) | Tabla real | GET | POST | PUT/PATCH | DELETE | Estado |
|---|---|---|:--:|:--:|:--:|:--:|---|
| 1 | `/api/v1/hardware-components` | `hardware_components` | ✅ | ✅ | ✅ | ✅ | ✅ Implementado |
| 2 | `/api/v1/driver-packages` | `driver_packages` | ✅ | ✅ | ✅ | ✅ | ✅ Implementado |
| 3 | `/api/v1/recommended-apps` | `recommended_apps` | ✅ | ✅ | ✅ | ✅ | 🟡 Diseñado (Hito 3) |
| 4 | `/api/v1/bloatware-rules` | `bloatware_rules` | ✅ | ✅ | ✅ | ✅ | ✅ Implementado |
| 5 | `/api/v1/user-profiles` | `user_profiles` | ✅ | ✅ | ✅ | ✅ | 🟡 Diseñado (Hito 3) |
| 6 | `/api/v1/profile-apps` | `profile_apps` | ✅ | ✅ (asignar) | — | ✅ (desasignar) | 🟡 Diseñado (Hito 3) |
| 7 | `/api/v1/synthetic-users` | `synthetic_users` | ✅ | ✅ | ✅ (PATCH) | ✅ | 🟡 Diseñado (Hito 3) |
| 8 | `/api/v1/subscription-tiers` | `subscription_tiers` | ✅ | ✅ | ✅ | ✅ | 🟡 Diseñado (Hito 3) |
| 9 | `/api/v1/recommendations/driver` | `driver_packages` + `hardware_components` + `user_profiles` | — | ✅ (consulta) | — | — | ✅ **núcleo del offloading** |
| 10 | `/api/v1/recommendations/apps` | `profile_apps` + `recommended_apps` + `user_profiles` | ✅ | — | — | — | ✅ **unión de perfiles** |
| 11 | `/api/v1/health` | — (`SELECT 1`) | ✅ | — | — | — | ✅ sonda de vida |

✅ **Criterio cubierto:** recursos **1, 2 y 4** implementan las 4 operaciones CRUD (`POST`, `GET`, `PUT`, `DELETE`) exigidas por el Hito 2 (mínimo 2 recursos).

---

### 3.3 RECURSO 1 — `hardware-components` (tabla `hardware_components`) 🟡 CRUD completo

**Criterio de versionado:** `/api/v1/hardware-components` · **Auth requerida en escrituras**

| Verb | Ruta | Path params | Query params | Éxito |
|---|---|---|---|---|
| `GET` | `/api/v1/hardware-components` | — | `ven_id`, `dev_id`, `category`, `page`, `limit`, `sort`, `order` | `200` |
| `GET` | `/api/v1/hardware-components/:id` | `id` (int, `component_id`) | — | `200` / `404` |
| `POST` | `/api/v1/hardware-components` | — | — | `201` |
| `PUT` | `/api/v1/hardware-components/:id` | `id` | — | `200` / `404` / `409` |
| `DELETE` | `/api/v1/hardware-components/:id` | `id` | — | `204` / `404` / `409` |

#### `POST /api/v1/hardware-components` → `201 Created`

Request:

```json
{
  "ven_id": "1002",
  "dev_id": "1638",
  "subsys_id": "GENERIC",
  "commercial_name": "AMD Radeon(TM) Graphics (Vega Integrated)",
  "category": "GPU"
}
```

Response `201 Created` + cabecera `Location: /api/v1/hardware-components/5`:

```json
{
  "data": {
    "component_id": 5,
    "ven_id": "1002",
    "dev_id": "1638",
    "subsys_id": "GENERIC",
    "commercial_name": "AMD Radeon(TM) Graphics (Vega Integrated)",
    "category": "GPU",
    "created_at": "2026-10-21T14:03:12.184Z"
  }
}
```

SQL del repositorio (`hardware.repository.ts`):

```sql
INSERT INTO hardware_components (ven_id, dev_id, subsys_id, commercial_name, category)
VALUES ($1, $2, COALESCE($3, 'GENERIC'), $4, $5)
RETURNING component_id, ven_id, dev_id, subsys_id, commercial_name, category, created_at;
```

#### `GET /api/v1/hardware-components?ven_id=1002&dev_id=1638` → `200 OK`

```json
{
  "data": [
    {
      "component_id": 1,
      "ven_id": "1002",
      "dev_id": "1638",
      "subsys_id": "GENERIC",
      "commercial_name": "AMD Radeon(TM) Graphics (Vega Integrated)",
      "category": "GPU"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

```sql
SELECT component_id, ven_id, dev_id, subsys_id, commercial_name, category, created_at
FROM hardware_components
WHERE ($1::text IS NULL OR ven_id = $1)
  AND ($2::text IS NULL OR dev_id = $2)
  AND ($3::text IS NULL OR category = $3)
ORDER BY component_id
LIMIT $4 OFFSET $5;
-- aprovecha idx_hardware_lookup (ven_id, dev_id)
```

#### `PUT /api/v1/hardware-components/1` → `200 OK`

Request (sólo campos mutables):

```json
{
  "commercial_name": "AMD Radeon 780M Graphics (Phoenix)",
  "category": "GPU"
}
```

Response `200` con el registro completo actualizado.

#### `DELETE /api/v1/hardware-components/1` → `204 No Content` (cuerpo vacío)

> ⚠️ **Regla de negocio:** si el componente tiene `driver_packages` asociados, la FK `fk_driver_component` está declarada con `ON DELETE CASCADE` (líneas 74-75 de `init.sql`), por lo que los drivers hijos se eliminan en cascada. El servicio **exige confirmación explícita** mediante query param `?cascade=true`; sin él responde `409 CONFLICT` con `message: "El componente tiene N driver_packages asociados"`.

#### Errores del recurso

| Código | Condición | Ejemplo de `error` |
|---|---|---|
| `400` | `ven_id` con formato inválido (`CHECK`/schema Zod) | `{"code":"VALIDATION_ERROR","details":[{"field":"ven_id","issue":"Debe ser hexadecimal de 4 dígitos"}]}` |
| `401` | Escritura sin `X-API-Key`, o clave inválida | `{"code":"UNAUTHORIZED","message":"Credencial ausente o inválida"}` |
| `404` | `GET /hardware-components/999` | `{"code":"NOT_FOUND","message":"hardware_components con component_id=999 no existe"}` |
| `409` | Duplicado de la firma `uq_hardware_signature (ven_id, dev_id, subsys_id)` (SQLSTATE `23505`) | `{"code":"CONFLICT","message":"Ya existe un componente con firma 1002/1638/GENERIC"}` |
| `409` | `DELETE` sin `?cascade=true` con hijos | `{"code":"CONFLICT","message":"12 driver_packages asociados"}` |
| `500` | Caída del pool | `{"code":"INTERNAL_ERROR","message":"Error interno"}` |

---

### 3.4 RECURSO 2 — `driver-packages` (tabla `driver_packages`) 🟡 CRUD completo

**Ruta base:** `/api/v1/driver-packages`

| Verb | Ruta | Path | Query | Éxito |
|---|---|---|---|---|
| `GET` | `/api/v1/driver-packages` | — | `component_id`, `profile_id`, `os_environment`, `whql`, `page`, `limit` | `200` |
| `GET` | `/api/v1/driver-packages/:id` | `driver_id` | — | `200` / `404` |
| `POST` | `/api/v1/driver-packages` | — | — | `201` / `409` / `422` |
| `PUT` | `/api/v1/driver-packages/:id` | `driver_id` | — | `200` / `404` / `409` / `422` |
| `DELETE` | `/api/v1/driver-packages/:id` | `driver_id` | — | `204` / `404` |

#### `POST /api/v1/driver-packages` → `201 Created`

Request (fila real de la semilla, `init.sql` línea 208):

```json
{
  "component_id": 1,
  "profile_id": 1,
  "os_environment": "Win11_x64",
  "edition_name": "AMD Software: Adrenalin Edition",
  "version_number": "24.9.1",
  "release_date": "2026-09-15",
  "download_url": "https://driwinstorage.blob.core.windows.net/drivers/amd-adrenalin-24.9.1-win11-64bit.exe",
  "file_size_mb": 540,
  "silent_install_flags": "-install",
  "is_whql_certified": true
}
```

Response `201 Created`:

```json
{
  "data": {
    "driver_id": 13,
    "component_id": 1,
    "profile_id": 1,
    "profile_name": "Gamer",
    "component": { "ven_id": "1002", "dev_id": "1638", "commercial_name": "AMD Radeon(TM) Graphics (Vega Integrated)" },
    "os_environment": "Win11_x64",
    "edition_name": "AMD Software: Adrenalin Edition",
    "version_number": "24.9.1",
    "release_date": "2026-09-15",
    "download_url": "https://driwinstorage.blob.core.windows.net/drivers/amd-adrenalin-24.9.1-win11-64bit.exe",
    "file_size_mb": 540,
    "silent_install_flags": "-install",
    "is_whql_certified": true,
    "created_at": "2026-10-21T14:05:44.021Z"
  }
}
```

```sql
INSERT INTO driver_packages
  (component_id, profile_id, os_environment, edition_name, version_number,
   release_date, download_url, file_size_mb, silent_install_flags, is_whql_certified)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,'/S'),COALESCE($10,TRUE))
RETURNING *;
```

#### `GET /api/v1/driver-packages?component_id=1&profile_id=1&os_environment=Win11_x64` → `200`

Devuelve el cruce con catálogos (JOIN obligatorio: los IDs solos no significan nada en la UI):

```sql
SELECT d.driver_id, d.os_environment, d.edition_name, d.version_number, d.release_date,
       d.download_url, d.file_size_mb, d.silent_install_flags, d.is_whql_certified,
       p.profile_name, h.ven_id, h.dev_id, h.commercial_name, h.category
FROM driver_packages d
INNER JOIN user_profiles p     ON p.profile_id   = d.profile_id
INNER JOIN hardware_components h ON h.component_id = d.component_id
WHERE ($1::int  IS NULL OR d.component_id = $1)
  AND ($2::int  IS NULL OR d.profile_id = $2)
  AND ($3::text IS NULL OR d.os_environment = $3)
  AND ($4::bool IS NULL OR d.is_whql_certified = $4)
ORDER BY h.component_id, p.profile_id
LIMIT $5 OFFSET $6;
-- aprovecha idx_driver_profile (profile_id)
```

#### `PUT /api/v1/driver-packages/1` → `200 OK` (actualización de versión/URL)

```json
{
  "version_number": "24.10.1",
  "release_date": "2026-10-18",
  "download_url": "https://driwinstorage.blob.core.windows.net/drivers/amd-adrenalin-24.10.1-win11-64bit.exe",
  "file_size_mb": 545
}
```

#### `DELETE /api/v1/driver-packages/1` → `204 No Content`

#### Errores del recurso

| Código | Condición | Mecanismo |
|---|---|---|
| `400` | `release_date` no ISO, `file_size_mb <= 0` | Schema Zod |
| `404` | `driver_id` inexistente | `SELECT ... WHERE driver_id=$1` → 0 filas |
| `409` | Duplicar `(component_id, profile_id, os_environment)` → `uq_driver_recommendation` | SQLSTATE `23505` |
| `422` | `component_id` o `profile_id` inexistente → `fk_driver_component` / `fk_driver_profile` | SQLSTATE `23503`; **nota:** `fk_driver_profile` es `ON DELETE RESTRICT` |

---

### 3.5 RECURSO 3 — `recommended-apps` (tabla `recommended_apps`) 🟡 CRUD completo

| Verb | Ruta | Query/Path | Éxito |
|---|---|---|---|
| `GET` | `/api/v1/recommended-apps` | `category`, `profile_id`, `page`, `limit` | `200` |
| `GET` | `/api/v1/recommended-apps/:id` | `app_id` | `200` / `404` |
| `POST` | `/api/v1/recommended-apps` | — | `201` / `409` |
| `PUT` | `/api/v1/recommended-apps/:id` | `app_id` | `200` / `404` / `409` |
| `DELETE` | `/api/v1/recommended-apps/:id` | `app_id` | `204` / `404` / `409` |

`POST` → `201` (dato real de `init.sql` línea 246):

```json
{
  "app_name": "Visual Studio Code",
  "category": "Desarrollo (Editor)",
  "version_number": "1.97.2",
  "download_url": "https://driwinstorage.blob.core.windows.net/apps/vscode-setup-1.97.2-x64.exe",
  "file_size_mb": 105,
  "silent_install_flags": "/VERYSILENT /NORESTART /MERGETASKS=!runcode"
}
```

Respuesta `201`:

```json
{
  "data": {
    "app_id": 21,
    "app_name": "Visual Studio Code",
    "category": "Desarrollo (Editor)",
    "version_number": "1.97.2",
    "download_url": "https://driwinstorage.blob.core.windows.net/apps/vscode-setup-1.97.2-x64.exe",
    "file_size_mb": 105,
    "silent_install_flags": "/VERYSILENT /NORESTART /MERGETASKS=!runcode",
    "profiles": ["Developer"],
    "created_at": "2026-10-21T14:07:02.550Z"
  }
}
```

Errores: `409` por `app_name` UNIQUE (`uq` implícito de la columna `UNIQUE`, línea 89), `400` por `CHECK (ck_app_size) file_size_mb > 0` (SQLSTATE `23514`), `404`, `401`.

**`GET /api/v1/recommended-apps?profile_id=1`** resuelve por la tabla pivote:

```sql
SELECT a.app_id, a.app_name, a.category, a.version_number, a.download_url,
       a.file_size_mb, a.silent_install_flags
FROM recommended_apps a
INNER JOIN profile_apps pa ON pa.app_id = a.app_id
WHERE pa.profile_id = $1
ORDER BY a.category, a.app_name;
```

---

### 3.6 RECURSO 4 — `bloatware-rules` (tabla `bloatware_rules`) 🟡 CRUD completo

| Verb | Ruta | Éxito |
|---|---|---|
| `GET` | `/api/v1/bloatware-rules` (`?risk_level=BAJO\|MEDIO\|ALTO`) | `200` |
| `GET` | `/api/v1/bloatware-rules/:id` | `200` / `404` |
| `POST` | `/api/v1/bloatware-rules` | `201` / `409` / `400` |
| `PUT` | `/api/v1/bloatware-rules/:id` | `200` / `404` / `400` |
| `DELETE` | `/api/v1/bloatware-rules/:id` | `204` / `404` |

`POST` → `201` (dato real de `init.sql` líneas 306-313):

```json
{
  "app_display_name": "Xbox Gaming Overlay / Game Bar",
  "package_signature": "*XboxGamingOverlay*",
  "detection_powershell_cmd": "Get-ItemProperty HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | Where-Object {$_.DisplayName -like \"*XboxGamingOverlay*\"} | Select-Object DisplayName, DisplayVersion; Get-AppxPackage -Name *XboxGamingOverlay* | Select-Object Name, Version, PackageFullName",
  "removal_powershell_cmd": "Get-AppxPackage -Name *XboxGamingOverlay* | Remove-AppxPackage",
  "risk_level": "MEDIO",
  "description": "Superposición de captura y overlay de Xbox. Se marca como MEDIO porque su eliminación desactiva la combinación Win+G; DriWin omite esta limpieza automática cuando el usuario mantiene el perfil Gamer."
}
```

Response `201` + `data.bloatware_id: 4`.

**Regla de negocio asociada (servicio):** `bloatware.service.ts` **omite** las reglas con `risk_level IN ('MEDIO','ALTO')` cuando el perfil del usuario es `Gamer` — condición explícita en la descripción de la fila 306-313 de `init.sql` (`ck_bloatware_risk` sólo permite `BAJO|MEDIO|ALTO`).

Errores: `400` si `risk_level` fuera del `CHECK` (`ck_bloatware_risk`), `409` por `package_signature` UNIQUE (`uq_bloatware_signature`), `404`, `401`, `500`.

---

### 3.7 RECURSO 5 — `user-profiles` (tabla `user_profiles`) 🟡 CRUD completo

| Verb | Ruta | Éxito |
|---|---|---|
| `GET` | `/api/v1/user-profiles` | `200` |
| `GET` | `/api/v1/user-profiles/:id` · `GET .../by-name/Gamer` | `200` / `404` |
| `POST` | `/api/v1/user-profiles` | `201` / `409` |
| `PUT` | `/api/v1/user-profiles/:id` | `200` / `404` / `409` |
| `DELETE` | `/api/v1/user-profiles/:id` | `204` / `409` (`ON DELETE RESTRICT` desde `driver_packages`) |

`POST` → `201`:

```json
{ "profile_name": "Streamer", "optimization_focus": "Codificación en vivo, baja latencia de red y multitarea" }
```

`GET /api/v1/user-profiles` → `200`:

```json
{
  "data": [
    { "profile_id": 1, "profile_name": "Gamer",     "optimization_focus": "Máximo rendimiento gráfico, fotogramas por segundo y baja latencia", "driver_count": 3, "app_count": 5 },
    { "profile_id": 2, "profile_name": "Creator",   "optimization_focus": "Estabilidad en renderizado, precisión de color y flujos de edición (Studio)", "driver_count": 2, "app_count": 5 },
    { "profile_id": 3, "profile_name": "Office",    "optimization_focus": "Estabilidad absoluta del sistema, bajo consumo energético y certificación WHQL", "driver_count": 3, "app_count": 5 },
    { "profile_id": 4, "profile_name": "Developer", "optimization_focus": "Entornos de compilación, virtualización, contenedores y herramientas de desarrollo", "driver_count": 4, "app_count": 5 }
  ],
  "meta": { "page": 1, "limit": 20, "total": 4, "totalPages": 1 }
}
```

Errores: `409` por `profile_name` UNIQUE (línea 37), `409` en `DELETE` si `driver_packages` referencia el perfil (FK `ON DELETE RESTRICT`, línea 77), `400` si `profile_name` supera 50 caracteres (`VARCHAR(50)`).

---

### 3.8 RECURSOS 6-8 — vínculos y catálogos complementarios 🟡

#### `profile_apps` (PK compuesta `profile_id + app_id`)

| Verb | Ruta | Cuerpo | Éxito |
|---|---|---|---|
| `GET` | `/api/v1/profile-apps?profile_id=1` | — | `200` |
| `POST` | `/api/v1/profile-apps` | `{"profile_id":1,"app_id":21}` | `201` / `409` (ya existe la pareja) |
| `DELETE` | `/api/v1/profile-apps?profile_id=1&app_id=21` | — | `204` / `404` |

```sql
INSERT INTO profile_apps (profile_id, app_id) VALUES ($1, $2)
RETURNING profile_id, app_id, assigned_at;
```

#### `synthetic-users` (tabla `synthetic_users`, usa `TEXT[]` y GIN)

| Verb | Ruta | Éxito |
|---|---|---|
| `GET` | `/api/v1/synthetic-users?tier_id=1&profile=Gamer` | `200` |
| `POST` | `/api/v1/synthetic-users` | `201` / `409` (`email` UNIQUE) / `400` (`ck_profiles_not_empty`) / `422` (`fk_user_tier`) |
| `PATCH` | `/api/v1/synthetic-users/:id` | `200` (parcial: `active_devices_count`, `selected_profiles_array`) |
| `DELETE` | `/api/v1/synthetic-users/:id` | `204` / `404` |

`POST` → `201` (dato real, `init.sql` línea 349):

```json
{
  "full_name": "Diego Salazar",
  "email": "diego.salazar@correo-driwin.cl",
  "user_role_type": "Híbrido Gamer + Creator",
  "tier_id": 1,
  "selected_profiles_array": ["Gamer", "Creator"],
  "active_devices_count": 3
}
```

```sql
SELECT u.user_id, u.full_name, u.email, u.user_role_type, u.selected_profiles_array,
       u.active_devices_count, t.tier_name, t.max_devices, t.device_scope, t.price_clp
FROM synthetic_users u
INNER JOIN subscription_tiers t ON t.tier_id = u.tier_id
WHERE ($1::int IS NULL OR u.tier_id = $1)
  AND ($2::text IS NULL OR $2 = ANY(u.selected_profiles_array))
ORDER BY u.user_id;
-- aprovecha idx_synthetic_users_profiles (GIN)
```

#### `subscription-tiers` (tabla `subscription_tiers`)

| Verb | Ruta | Éxito |
|---|---|---|
| `GET` | `/api/v1/subscription-tiers` · `/:id` | `200` / `404` |
| `POST` | `/api/v1/subscription-tiers` | `201` / `409` (`tier_name` UNIQUE) / `400` (`ck_tier_price`, `ck_tier_devices`) |
| `PUT` | `/api/v1/subscription-tiers/:id` | `200` / `404` |
| `DELETE` | `/api/v1/subscription-tiers/:id` | `204` / `409` (`fk_user_tier` → `RESTRICT`) |

`POST` → `201` (dato real, `init.sql` línea 329):

```json
{
  "tier_name": "Pase Mensual",
  "target_persona": "Usuario Normal B2C",
  "pricing_model": "Mensual",
  "price_clp": 5000.00,
  "max_devices": 3,
  "device_scope": "3 PCs",
  "description": "Suscripción mensual de DriWin para usuarios normales: hasta 3 PCs por suscripción, renovación mensual en pesos chilenos."
}
```

---

### 3.9 ENDPOINT 9 — `POST /api/v1/recommendations/driver` (núcleo del caso de uso) 🟡

Es el endpoint documentado en `DescripcionDiagramaPrueba1.md` §2: *"Petición HTTP POST ID + Perfil Gamer"*.

Request (carga útil de ~1 KB, alineada al ejemplo del documento y a las tablas reales):

```json
{
  "ven_id": "1002",
  "dev_id": "1638",
  "subsys_id": "GENERIC",
  "os_environment": "Win11_x64",
  "profiles": ["Gamer"]
}
```

> **Compatibilidad con el Hito 1:** el documento usaba `{"ven":"1002","dev":"1638","os":"Win11_x64","profile":"Gamer"}`. El contrato v1 acepta **ambos** nombres (`ven`≡`ven_id`, `profile` string ≡ `profiles[]`) mediante normalización en `hardware.service.ts`, para no romper la trazabilidad documentada.

Response `200 OK`:

```json
{
  "data": {
    "component": {
      "component_id": 1,
      "ven_id": "1002",
      "dev_id": "1638",
      "commercial_name": "AMD Radeon(TM) Graphics (Vega Integrated)",
      "category": "GPU"
    },
    "recommendation": {
      "driver_id": 1,
      "profile_name": "Gamer",
      "os_environment": "Win11_x64",
      "edition_name": "AMD Software: Adrenalin Edition",
      "version_number": "24.9.1",
      "release_date": "2026-09-15",
      "download_url": "https://driwinstorage.blob.core.windows.net/drivers/amd-adrenalin-24.9.1-win11-64bit.exe",
      "file_size_mb": 540,
      "silent_install_flags": "-install",
      "is_whql_certified": true
    },
    "alternatives": [
      { "profile_name": "Creator", "edition_name": "AMD Software: PRO Edition", "version_number": "24.Q3", "file_size_mb": 510 },
      { "profile_name": "Office",  "edition_name": "AMD Base Display Driver (WHQL Minimal)", "version_number": "31.0.21912", "file_size_mb": 120 }
    ],
    "offloading": { "strategy": "DIRECT_AZURE_BLOB", "container": "drivers", "estimated_bytes": 566231040, "binary_traverses_api": false }
  },
  "meta": { "generated_at": "2026-10-21T14:09:31.004Z", "query_time_ms": 7 }
}
```

SQL ejecutado (`driver.repository.findByHardwareAndProfiles`):

```sql
SELECT d.driver_id, d.edition_name, d.version_number, d.release_date, d.download_url,
       d.file_size_mb, d.silent_install_flags, d.is_whql_certified, d.os_environment,
       p.profile_name, h.component_id, h.ven_id, h.dev_id, h.commercial_name, h.category
FROM driver_packages d
INNER JOIN hardware_components h ON h.component_id = d.component_id
INNER JOIN user_profiles p       ON p.profile_id   = d.profile_id
WHERE h.ven_id = $1
  AND h.dev_id = $2
  AND d.os_environment = $3
  AND p.profile_name = ANY($4::text[])
ORDER BY d.is_whql_certified DESC, d.file_size_mb ASC;
-- equivalentes documentadas: consultas N.º 8 y N.º 9 de db/init.sql (líneas 432-448)
```

**Códigos de estado de este endpoint**

| HTTP | `code` | Situación |
|---|---|---|
| `200` | — | Se encontró al menos un driver |
| `400` | `VALIDATION_ERROR` | Faltan `ven_id`/`dev_id` o `profiles` vacío |
| `401` | `UNAUTHORIZED` | Sin API key |
| `404` | `NOT_FOUND` | Firma `ven/dev` no existe en `hardware_components` → la UI muestra "Equipo no catalogado aún" |
| `409` | `CONFLICT` | `profiles: ["GamerX"]` no existe en `user_profiles` |
| `422` | `NO_DRIVER_FOR_PROFILE` | Hardware catalogado pero sin fila para ese perfil+SO (caso documentado en `DiagramaFlujo.md`: *"Falta URL / Nombre / Ambos"*) |
| `429` | `RATE_LIMITED` | > 60 req/min |
| `500` / `503` | `INTERNAL_ERROR` / `DB_UNAVAILABLE` | Error de servidor / BD caída |

### 3.10 ENDPOINT 10 — `GET /api/v1/recommendations/apps` 🟡

`GET /api/v1/recommendations/apps?profiles=Gamer,Creator` → `200` (unión sin duplicados — consulta N.º 3 de `init.sql`, líneas 391-396):

```sql
SELECT DISTINCT a.app_id, a.app_name, a.category, a.version_number,
       a.download_url, a.file_size_mb, a.silent_install_flags
FROM user_profiles p
INNER JOIN profile_apps pa    ON pa.profile_id = p.profile_id
INNER JOIN recommended_apps a ON a.app_id      = pa.app_id
WHERE p.profile_name = ANY($1::text[])
ORDER BY a.category, a.app_name;
```

Response `200` (10 apps para `Gamer,Creator` — 5 + 5 sin duplicados):

```json
{
  "data": [
    { "app_name": "Steam",              "category": "Gaming",        "version_number": "3.0.10.91",  "download_url": "https://driwinstorage.blob.core.windows.net/apps/steam-setup-3.0.10.91.exe",   "file_size_mb": 65,  "silent_install_flags": "/S",  "source_profiles": ["Gamer"] },
    { "app_name": "Blender",            "category": "Creatividad (3D)", "version_number": "4.2.3 LTS", "download_url": "https://driwinstorage.blob.core.windows.net/apps/blender-4.2.3-windows-x64.msi", "file_size_mb": 350, "silent_install_flags": "/qn /norestart", "source_profiles": ["Creator"] }
  ],
  "meta": { "profiles": ["Gamer", "Creator"], "total": 10, "total_size_mb": 4295 }
}
```

Errores: `400` si `profiles` vacío, `404` si algún perfil no existe, `200` con `data: []` si no hay apps (nunca `404`, porque la colección existe).

### 3.11 `GET /api/v1/health` 🟡

```json
{ "status": "ok", "version": "1.0.0", "database": "up", "latency_ms": 3, "timestamp": "2026-10-21T14:10:00.000Z" }
```

`200` si `SELECT 1` responde; `503` `DB_UNAVAILABLE` en caso contrario.

---

## 4. Trazabilidad y evolución respecto al Hito 1 (Criterio B1 — 8 pts)

### 4.1 Qué proponía el Hito 1 (fuente: `docs/Propuesta_Tecnica.pdf`, secciones 7 y 8)

**Sección 7 — "Lenguaje y Frameworks".** Se evaluaron tres opciones:

| Criterio | **Opción 1 (ELEGIDA)** TS (React) + CSS + **Rust** | Opción 2 C++ con Qt | Opción 3 C# con WinUI + MVVM |
|---|---|---|---|
| Mantenibilidad visual | **Alta** — React + CSS permiten iteraciones rápidas, temas dinámicos y arquitectura modular | Baja — escalar componentes en QML toma más tiempo | Media — WinUI 3 es nativo pero XAML es rígido y verboso |
| Uso a bajo nivel | **Muy Alta** — Rust lee parámetros físicos y térmicos de forma nativa con seguridad de memoria | Máxima — control absoluto del hardware | Media-Alta — depende de librerías intermedias (.NET) |
| Curva de aprendizaje | **Desafiante / Híbrida** — el back-end (Rust) exige rigor, el front (React) acelera | Muy Alta | Moderada |

**Motivo de elección declarado en el PDF:** Vicente Acevedo ya entendía parte de TypeScript, lo que facilitaba arrancar el Front-End; Rust se asume como lenguaje "interesante de aprender" pese a su dificultad. Se descartaron C++/Qt y C#/WinUI porque **ningún integrante** conocía esos lenguajes.

**Sección 8 — "Arquitectura Cliente-Servidor y Capas":**

| Capa | Definición del Hito 1 |
|---|---|
| **Presentación (Frontend/Interfaz Cliente)** | Interfaz en React: cuestionario inicial de perfil + Dashboard (instalación de software, control de drivers, limpieza de bloatware). *Responsabilidad:* capturar decisiones del usuario y enviarlas a la capa inferior |
| **Negocio (Lógica Local + API en Servidor)** | **Local:** comandos PowerShell/WMI para extraer `VEN/DEV` y desinstalar bloatware. **Servidor:** API alojada en **Microsoft Azure** que recibe los identificadores y decide qué priorizar (p. ej. baja latencia si el perfil es "Gamer") y devuelve la URL de descarga |
| **Datos (Almacenamiento en Nube)** | Sistema en **Azure** con la base de datos del proyecto (catálogo de componentes más comunes); almacena la relación **repositorios PCI/USB ID ↔ nombre comercial ↔ URL de descarga directa**. *Responsabilidad:* responder exclusivamente a instrucciones SQL emitidas por la Capa de Negocio |

> **Dato clave de trazabilidad:** el Hito 1 **no especificó el lenguaje del back-end de servidor con nombre de framework**; sólo dijo "API alojada en Microsoft Azure" y eligió Rust como lenguaje del proyecto. `docs/DiagramaMD/DiagramaBackEnd/DiagramaPrueba1.md` lo rotuló como `API REST en Azure Node.js/Python`. Esa ambigüedad es la que se cierra en el Hito 2 con la decisión dual documentada en §2.5. Al construir la capa local, Rust también se reemplazó por TypeScript (Electron), por las razones de la §2.4: hoy todo el proyecto usa un solo lenguaje.

### 4.2 Evolución de los artefactos (Hito 1 → Hito 2)

| Elemento | Hito 1 (propuesta) | Estado actual (Hito 2) | Por qué cambió | Impacto |
|---|---|---|---|---|
| **Front-End** | React + TypeScript + CSS | ✅ Implementado: `app-inicio-windows/` (React 19.2.8, Vite 8.2.2, TS 6.0.3, Oxlint) | Decisión original confirmada y actualizada a versiones 2026 | Sin impacto negativo; es la base del prototipo en Vercel |
| **Back-End de servidor** | "Rust" (opción 1) / "Node.js o Python" (diagrama) | 🟡 **Node.js + Express + TypeScript + `pg`** para la API cloud; la capa local, diseñada en Rust (Tauri), se construyó también en **TypeScript (Electron)** | La API es **I/O-bound** (SQL + entrega de URLs); TS unifica interfaces con el front, reduce la curva para los 3 integrantes y asegura plazos. Costo: más RAM, mitigado por el *offloading* a Blob (§2.5) | Define el `server-api/` de §1.4 y todo el contrato de §3 |
| **Capa local** | "PowerShell/WMI" mencionado sin framework | ✅ **Electron 44 + TypeScript** (`app-inicio-windows/electron/`) con canales IPC `hardware:scan`, `driver:install`, `bloatware:remove` | Se diseñó en Rust/Tauri, pero el trabajo de bajo nivel lo hace PowerShell en ambos casos: con TypeScript el proyecto queda en un solo lenguaje que todo el equipo domina (§2.4) | Instalador de ~121 MB (incluye Chromium); a cambio, todo el equipo puede mantener la capa local |
| **Motor de BD** | "Base de datos en Azure" (sin motor) | ✅ **Azure Database for PostgreSQL Flexible Server 16** | `Borrador.md`: se comparó Azure SQL Database vs PostgreSQL y se eligió PostgreSQL por (1) estándar relacional e integridad referencial del catálogo VEN/DEV, (2) costo con instancias *burstable* B1ms dentro de los créditos Azure for Students, (3) `JSONB` para datos desestructurados futuros. **Costo asumido:** sin auto-pausa a cero y `pg_hba.conf` más explícito | `db/init.sql` + §5 de este documento |
| **Modelo de datos** | Sin tablas (sólo diagrama de capas) | ✅ **8 tablas** (`init.sql`, 449 líneas) | Evolución verificable en Git: `e857fd0` (3 tablas: `user_profiles`, `hardware_components`, `driver_packages` + 1 índice, 81 líneas) → `01375c0` (8 tablas, 4 índices, 15 restricciones, 449 líneas) | Habilita CRUD de 5 recursos y las 9 consultas de prueba |
| **Almacenamiento binario** | "URL de descarga directa de los fabricantes" | ✅ **`driwinstorage`** con contenedores **`apps`** (20 objetos) y **`drivers`** (12 objetos); patrón *offloading* | Centralizar la descarga en un almacén propio permite control de versiones y coherencia con `silent_install_flags`; el API sólo devuelve texto | 32 URLs en `init.sql`; §7 (costo/escala) |
| **Estrategia de catálogo** | Repositorios PCI/USB ID mencionados | ✅ `EstrategiaRecoleccionDatos.md`: **Fase 1 semilla manual** (ya materializada en `init.sql`); **Fase 2 concepto a futuro** (Windows Update/PSWindowsUpdate para Office; scraping/inversión de endpoints para Gamer/Dev/Creator) | Estabilidad de la demo: se aísla el sistema de interrupciones de red externas | Hallazgo H-06 legal: la Fase 2 exige evaluación jurídica previa |
| **Aspectos legales** | No existían | ✅ `LICENSE` (MIT), `THIRD_PARTY_LICENSES.md` (316 líneas), `docs/Aspectos_Legales_Normativos_Licenciamiento_Hito2.md` (324 líneas) | Hallazgos H-01/H-02 de la auditoría legal del Hito 2 | 70 dependencias auditadas, 0 copyleft fuerte |
| **Seguridad de secretos** | No existía `.gitignore` | ✅ `.gitignore` raíz (commit `e71d85d` *"Correccion de error de seguridad"*) + `.gitignore` anidado en `app-inicio-windows/` | Evitar el volcado accidental de `.env`, `*.pem`, `*.key`, `*.pfx` | Verificado: **0 secretos en toda la historia** (H-13) |

### 4.3 Cronología verificada (historial de Git)

| Commit | Fecha | Mensaje | Impacto arquitectónico |
|---|---|---|---|
| `47f2b7e` … `999879e` | sep-oct 2026 | *Proyecto DriWin* → *Propuesta de back end* | Frontend, diagramas, README, láminas, PDF de propuesta (estado de `main`) |
| `e857fd0` | 16-10-2026 | *Se agrega script reproducible de base de datos y catalogo semilla* | **Nace la Capa 5:** `db/init.sql` (3 tablas) + `Borrador.md` (justificación PostgreSQL) |
| `8f8b22c` | 17-10-2026 | *Integracion de licencias utilizadas* | `LICENSE`, `THIRD_PARTY_LICENSES.md`, documento legal Hito 2 |
| `e71d85d` | 17-10-2026 | *Correccion de error de seguridad* | Crea `.gitignore` raíz con bloque de credenciales |
| `01375c0` | 18-10-2026 | *Esquema con apps por perfil, reglas bloatware y usuarios sinteticos* | **3 → 8 tablas**: `recommended_apps`, `profile_apps`, `bloatware_rules`, `subscription_tiers`, `synthetic_users` + 9 consultas de prueba |
| *(sin commitear)* | 21-10-2026 | `git status` | `.gitignore` (broadening a `.env.*`, `*.pfx`, `coverage/`), `.gitignore` de la app, título en `EstrategiaRecoleccionDatos.md` |

> ⚠️ **Nota para la entrega:** `main` **no contiene** `db/init.sql`, `LICENSE`, `THIRD_PARTY_LICENSES.md` ni el documento legal. Todo el Hito 2 vive en `feature/auditoria-vibecode`. Hacer *merge* antes de la defensa (Anexo B).

### 4.4 Trazabilidad funcional: cada capa del Hito 1 → dónde está hoy

```mermaid
flowchart LR
    classDef done fill:#2ed573,stroke:#222831,color:#111;
    classDef des fill:#ffd32a,stroke:#222831,color:#111;
    A["Hito 1: Capa Presentación (React)"]:::done --> A1["app-inicio-windows/src/App.tsx + theme.css"]
    B["Hito 1: Capa Negocio Local (PowerShell/WMI)"]:::des --> B1["app-inicio-windows/electron/ (Electron + TypeScript)"]
    C["Hito 1: API en Azure"]:::des --> C1["server-api/ Express+TS (diseñado, §3)"]
    D["Hito 1: BD en Azure"]:::done --> D1["db/init.sql → PostgreSQL 16 Flexible Server"]
    E["Hito 1: URLs de descarga"]:::done --> E1["driwinstorage: contenedores apps/ y drivers/"]
    C1 --> D1
    C1 --> E1
    B1 --> C1
```

---

## 5. Persistencia en PostgreSQL y modelo de datos (Criterio B4 — 10 pts)

### 5.1 Características del script `db/init.sql` (✅ implementado, 449 líneas)

| Propiedad | Detalle |
|---|---|
| Motor objetivo | **PostgreSQL 16** — Azure Database for PostgreSQL **Flexible Server** (línea 3) |
| Idempotencia | `DROP TABLE IF EXISTS ... CASCADE` en orden **hijas → padres** (líneas 16-23); ejecutable N veces |
| Objetos | **8 tablas**, **4 índices**, **5 claves foráneas**, **15 restricciones con nombre**, **8 sentencias `INSERT`** |
| Semilla | 4 perfiles · 6 componentes · **9 drivers (instaladores reales en Azure Blob)** · **20 apps** · **20 vínculos perfil-app** · 3 reglas de bloatware · 5 planes · 6 usuarios sintéticos |
| Offloading | 20 URLs `.../apps/*` y 12 URLs `.../drivers/*` sobre `https://driwinstorage.blob.core.windows.net` |
| Pruebas SQL | 9 consultas comentadas (líneas 354-449) = especificación ejecutable de los servicios |
| ⚠️ No incluye | `CREATE DATABASE`, `CREATE SCHEMA`, roles/permisos, `pg_hba.conf`, `CREATE EXTENSION` (ver H-05 y §6) |

### 5.2 Las 8 tablas del esquema `public`

#### 1) `user_profiles` — raíz del modelo de perfiles (líneas 35-40)

| Campo | Tipo | Restricción |
|---|---|---|
| `profile_id` | `SERIAL` | **PK** |
| `profile_name` | `VARCHAR(50)` | `NOT NULL`, `UNIQUE` |
| `optimization_focus` | `VARCHAR(100)` | `NOT NULL` |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` |

**Propósito:** catálogo de las 4 intenciones de uso — `Gamer` (1), `Creator` (2), `Office` (3), `Developer` (4). Es la **tabla padre** de `driver_packages` y `profile_apps`.

#### 2) `hardware_components` — Recurso CRUD N.º 1 (líneas 43-56)

| Campo | Tipo | Restricción |
|---|---|---|
| `component_id` | `SERIAL` | **PK** |
| `ven_id` | `VARCHAR(10)` | `NOT NULL` (ej. `1002` AMD, `10DE` NVIDIA, `14C3` MediaTek, `8086`/`8087` Intel) |
| `dev_id` | `VARCHAR(10)` | `NOT NULL` (ej. `1638`, `2684`, `7961`, `A780`, `51F0`, `0033`) |
| `subsys_id` | `VARCHAR(20)` | `DEFAULT 'GENERIC'` |
| `commercial_name` | `VARCHAR(150)` | `NOT NULL` |
| `category` | `VARCHAR(50)` | `NOT NULL` (`GPU`, `Network`, `Audio`) |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` |

- **Restricción única:** `uq_hardware_signature UNIQUE (ven_id, dev_id, subsys_id)` — dos componentes no pueden compartir firma física.
- **Índice:** `idx_hardware_lookup (ven_id, dev_id)` — acelera el Paso 2 del caso de uso.

#### 3) `driver_packages` — Recurso CRUD N.º 2 (líneas 59-84)

| Campo | Tipo | Restricción |
|---|---|---|
| `driver_id` | `SERIAL` | **PK** |
| `component_id` | `INT` | `NOT NULL`, **FK** `→ hardware_components.component_id` **`ON DELETE CASCADE`** (`fk_driver_component`) |
| `profile_id` | `INT` | `NOT NULL`, **FK** `→ user_profiles.profile_id` **`ON DELETE RESTRICT`** (`fk_driver_profile`) |
| `os_environment` | `VARCHAR(30)` | `NOT NULL` (`Win11_x64`, `Win10_x64`) |
| `edition_name` | `VARCHAR(120)` | `NOT NULL` (ej. `AMD Software: Adrenalin Edition`, `NVIDIA Studio Driver`) |
| `version_number` | `VARCHAR(40)` | `NOT NULL` |
| `release_date` | `DATE` | `NOT NULL` |
| `download_url` | `TEXT` | `NOT NULL` — URL de Azure Blob Storage (offloading) |
| `file_size_mb` | `INT` | `NOT NULL` |
| `silent_install_flags` | `VARCHAR(50)` | `DEFAULT '/S'` — parámetros del Paso 5 (instalación silenciosa) |
| `is_whql_certified` | `BOOLEAN` | `DEFAULT TRUE` |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` |

- **Única:** `uq_driver_recommendation UNIQUE (component_id, profile_id, os_environment)` → un único driver recomendado por componente+perfil+SO.
- **Índice:** `idx_driver_profile (profile_id)`.

#### 4) `recommended_apps` — Recurso CRUD N.º 3 (líneas 87-97)

| Campo | Tipo | Restricción |
|---|---|---|
| `app_id` | `SERIAL` | **PK** |
| `app_name` | `VARCHAR(120)` | `NOT NULL`, `UNIQUE` |
| `category` | `VARCHAR(60)` | `NOT NULL` |
| `version_number` | `VARCHAR(40)` | `NOT NULL` |
| `download_url` | `TEXT` | `NOT NULL` (contenedor `apps/`) |
| `file_size_mb` | `INT` | `NOT NULL`, **`CHECK ck_app_size (file_size_mb > 0)`** |
| `silent_install_flags` | `VARCHAR(80)` | `NOT NULL` |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` |

#### 5) `profile_apps` — tabla pivote N:M (líneas 104-117)

| Campo | Tipo | Restricción |
|---|---|---|
| `profile_id` | `INT` | **PK compuesta**, **FK** `→ user_profiles` `ON DELETE CASCADE` (`fk_pa_profile`) |
| `app_id` | `INT` | **PK compuesta**, **FK** `→ recommended_apps` `ON DELETE CASCADE` (`fk_pa_app`) |
| `assigned_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` |

- **Índice inverso:** `idx_profile_apps_app (app_id)` → *"¿qué perfiles recomiendan esta app?"*.
- La PK compuesta garantiza que el par `(perfil, app)` exista **una sola vez** → la `UNION` de perfiles no duplica apps.

#### 6) `bloatware_rules` — Recurso CRUD N.º 4 (líneas 120-131)

| Campo | Tipo | Restricción |
|---|---|---|
| `bloatware_id` | `SERIAL` | **PK** |
| `app_display_name` | `VARCHAR(150)` | `NOT NULL` |
| `package_signature` | `VARCHAR(150)` | `NOT NULL`, **`UNIQUE uq_bloatware_signature`** (comodín, ej. `*XboxGamingOverlay*`) |
| `detection_powershell_cmd` | `TEXT` | `NOT NULL` — inspección de registro de desinstalación + `Get-AppxPackage` |
| `removal_powershell_cmd` | `TEXT` | `NOT NULL` — desinstalación silenciosa |
| `risk_level` | `VARCHAR(10)` | `NOT NULL`, `DEFAULT 'BAJO'`, **`CHECK ck_bloatware_risk IN ('BAJO','MEDIO','ALTO')`** |
| `description` | `TEXT` | `NOT NULL` |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` |

#### 7) `subscription_tiers` — matriz de financiamiento (líneas 142-154)

| Campo | Tipo | Restricción |
|---|---|---|
| `tier_id` | `SERIAL` | **PK** |
| `tier_name` | `VARCHAR(80)` | `NOT NULL`, `UNIQUE` |
| `target_persona` | `VARCHAR(80)` | `NOT NULL` |
| `pricing_model` | `VARCHAR(40)` | `NOT NULL` (`Mensual`, `Única`, `Tarifa Plana`, `Lote`, `Convenio B2B`) |
| `price_clp` | `NUMERIC(12,2)` | **`CHECK ck_tier_price (price_clp IS NULL OR price_clp >= 0)`** — `NULL` = tarifa plana/convenio |
| `max_devices` | `INT` | **`CHECK ck_tier_devices (max_devices IS NULL OR max_devices > 0)`** — `NULL` = ilimitado |
| `device_scope` | `VARCHAR(60)` | `NOT NULL` (ej. `3 PCs`, `Lote de 100 PCs`) |
| `description` | `TEXT` | `NOT NULL` |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` |

Semilla: `Pase Mensual` ($5.000 CLP / 3 PCs) · `Compra Única Vitalicia` ($30.000 CLP / 1 PC) · `Plan Builder Pro` (tarifa plana, ilimitado) · `Pack por Volumen` ($1.500.000 CLP / 100 PCs) · `Alianza OEM / Certificado` (convenio).

#### 8) `synthetic_users` — usuarios de prueba (líneas 157-174)

| Campo | Tipo | Restricción |
|---|---|---|
| `user_id` | `SERIAL` | **PK** |
| `full_name` | `VARCHAR(120)` | `NOT NULL` |
| `email` | `VARCHAR(160)` | `NOT NULL`, **`UNIQUE`** |
| `user_role_type` | `VARCHAR(60)` | `NOT NULL` (ej. `Técnico Armador`) |
| `tier_id` | `INT` | `NOT NULL`, **FK** `→ subscription_tiers.tier_id` `ON DELETE RESTRICT` (`fk_user_tier`) |
| `selected_profiles_array` | **`TEXT[]`** | `NOT NULL`, **`CHECK ck_profiles_not_empty (cardinality(...) >= 1)`** |
| `active_devices_count` | `INT` | `NOT NULL`, `DEFAULT 0`, **`CHECK ck_active_devices >= 0`** |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` |

- **Índice GIN:** `idx_synthetic_users_profiles USING GIN (selected_profiles_array)` → búsquedas rápidas de *"¿este perfil está en el array?"*.

### 5.3 Diagrama entidad-relación

```mermaid
erDiagram
    user_profiles ||--o{ driver_packages : "profile_id (RESTRICT)"
    hardware_components ||--o{ driver_packages : "component_id (CASCADE)"
    user_profiles ||--o{ profile_apps : "profile_id (CASCADE)"
    recommended_apps ||--o{ profile_apps : "app_id (CASCADE)"
    subscription_tiers ||--o{ synthetic_users : "tier_id (RESTRICT)"

    user_profiles {
        int profile_id PK
        varchar50 profile_name UK
        varchar100 optimization_focus
    }
    hardware_components {
        int component_id PK
        varchar10 ven_id
        varchar10 dev_id
        varchar20 subsys_id
        varchar150 commercial_name
        varchar50 category
    }
    driver_packages {
        int driver_id PK
        int component_id FK
        int profile_id FK
        varchar30 os_environment
        varchar120 edition_name
        varchar40 version_number
        date release_date
        text download_url
        int file_size_mb
        varchar50 silent_install_flags
        bool is_whql_certified
    }
    recommended_apps {
        int app_id PK
        varchar120 app_name UK
        varchar60 category
        varchar40 version_number
        text download_url
        int file_size_mb
        varchar80 silent_install_flags
    }
    profile_apps {
        int profile_id PK_FK
        int app_id PK_FK
        timestamp assigned_at
    }
    bloatware_rules {
        int bloatware_id PK
        varchar150 app_display_name
        varchar150 package_signature UK
        text detection_powershell_cmd
        text removal_powershell_cmd
        varchar10 risk_level
        text description
    }
    subscription_tiers {
        int tier_id PK
        varchar80 tier_name UK
        varchar80 target_persona
        varchar40 pricing_model
        numeric12_2 price_clp
        int max_devices
        varchar60 device_scope
        text description
    }
    synthetic_users {
        int user_id PK
        varchar120 full_name
        varchar160 email UK
        varchar60 user_role_type
        int tier_id FK
        text_array selected_profiles_array
        int active_devices_count
    }
```

> **Nota de diseño:** `bloatware_rules` y `subscription_tiers` son **catálogos desacoplados** (sin FK hacia perfiles) a propósito: las reglas de limpieza son universales y se filtran por `risk_level` + perfil en la capa de servicio, y los planes se referencian sólo desde `synthetic_users`.

### 5.4 Cómo se relacionan para resolver el caso de uso central

**Caso:** *Javier (perfil Gamer) con `VEN_1002`/`DEV_1638` quiere actualizar su driver.*

| Paso | Tablas involucradas | Operación | Por qué |
|---|---|---|---|
| 1. El cliente declara intención | `user_profiles` | `SELECT` por `profile_name = 'Gamer'` → `profile_id = 1` | La intención es el **filtro maestro** de todo el sistema |
| 2. Detecta hardware | `hardware_components` | `SELECT` por `ven_id='1002' AND dev_id='1638'` (usa `idx_hardware_lookup`) | Traduce el código físico a `commercial_name` |
| 3. Cruza | `driver_packages` ⋈ `hardware_components` ⋈ `user_profiles` | `WHERE component_id=1 AND profile_id=1 AND os_environment='Win11_x64'` (protegido por `uq_driver_recommendation`) | Entrega **exactamente un** paquete: `Adrenalin Edition 24.9.1` en lugar del `PRO Edition` (Creator) o el `WHQL Minimal` (Office) |
| 4. Entrega apps | `profile_apps` ⋈ `recommended_apps` | `UNION` por los perfiles seleccionados con `DISTINCT` (consultas 1 y 3 de `init.sql`) | Un usuario Gamer+Creator recibe 10 apps sin duplicados gracias a la PK compuesta |
| 5. Limpieza | `bloatware_rules` | `SELECT` filtrado por `risk_level`; se omiten `MEDIO/ALTO` si perfil = Gamer | Respeta la regla declarada en la fila de `*XboxGamingOverlay*` |
| 6. Comercio | `synthetic_users` ⋈ `subscription_tiers` | Validación `active_devices_count <= max_devices` (consulta 6: debe dar 0 filas) | Sin datos huérfanos: FK `RESTRICT` |
| 7. Descarga | `driver_packages.download_url` / `recommended_apps.download_url` | Entrega de texto → **Blob Storage** | El binario jamás transita por la API |

**Reglas de integridad que protegen el caso de uso:**
`uq_hardware_signature` (no duplicar hardware) · `uq_driver_recommendation` (no duplicar recomendaciones) · `uq_bloatware_signature` y `app_name UNIQUE` (catálogos sin duplicados) · `ON DELETE RESTRICT` en perfiles y planes (no borrar lo referenciado) · `ON DELETE CASCADE` en componentes y vínculos (limpieza proporcional) · `ck_profiles_not_empty` y `ck_app_size` (datos con sentido).

---

## 6. Manejo de credenciales, variables de entorno y seguridad (Criterio B4 — 10 pts)

### 6.1 Barrido de credenciales (metodología y resultado)

| Verificación | Comando / método | Resultado |
|---|---|---|
| Contraseñas o cadenas de conexión en el árbol | `git grep -niE 'password\|AccountKey=\|Server=\|Host=\|pwd=\|postgres.database.azure.com'` | **0 coincidencias** ✅ |
| Secretos en **toda la historia** de Git (41 commits) | `git log --all -S'password' -p` y `git grep` sobre `$(git rev-list --all)` | **0 coincidencias** ✅ |
| Llaves privadas | Patrones `.pem`, `.key`, `.cert`, `.pfx`, `.p12` en el árbol | **0 archivos** ✅ (y además ignorados) |
| Archivos `.env` existentes | `glob **/.env*` | **0 archivos** ⚠️ (ni reales ni de ejemplo — H-04) |
| Nombre de la BD `driwin_catalog` | `git grep` sobre toda la historia | **0 coincidencias** — el nombre vive sólo en la infraestructura, no en el código (H-05) |
| Literales no secretos sí presentes | `db/init.sql` | 32 URLs públicas `https://driwinstorage.blob.core.windows.net/{apps,drivers}/...` — **son endpoints públicos por diseño, no credenciales** |

**Conclusión:** **no hay ninguna credencial hardcodeada que mover a variables de entorno.** El repositorio está limpio; lo que falta es el archivo de ejemplo y la implementación del cliente que consume dichas variables.

### 6.2 Análisis de `.gitignore`

**`.gitignore` raíz (70 líneas, commit `e71d85d` "Correccion de error de seguridad" + enmienda sin commitear):**

| Bloque | Reglas | Efecto |
|---|---|---|
| **1. Variables de entorno y credenciales (CRÍTICO)** | `.env`, `.env.*`, `*.env`, `*.pem`, `*.key`, `*.cert`, `*.pfx`, `*.p12` con excepción `!.env.example` y `!.env.*.example` | Bloquea cualquier variante de `.env` (incluye `.env.production.local`) pero **permite commitear la plantilla** — exactamente lo que exige el criterio B4 |
| **2. Dependencias** | `node_modules/`, `**/node_modules/`, `.pnp`, `.pnp.js` | — |
| **3. Compilación** | `dist/`, `dist-ssr/`, `build/`, `out/`, `coverage/`, `**/coverage/`, `*.local` | Cubre Vite (`dist/`) y futuros reportes de `vitest` |
| **4. Herramientas de desarrollo** | `.vscode/*` (con excepción de `extensions.json`), `**/.vscode/*`, `.idea/`, `.continue/`, `.dbclient/`, `*.sublime-*` | `.dbclient/` bloquea volcados de clientes de BD |
| **5. Logs y temporales** | `logs/`, `*.log`, `npm-debug.log*`, `.DS_Store`, `Thumbs.db`, `desktop.ini`, `*.sw?` | — |

**`app-inicio-windows/.gitignore`:** defensa en profundidad — repite `.env`, `.env.*`, `*.env`, `*.pem`, `*.key`, `*.cert` "si se opera sin la raíz", más `node_modules`, `dist`, logs y directorios de editor.

**Veredicto B4:** la política de secretos está **correctamente implementada y verificada**; el único faltante es la plantilla `.env.example`.

### 6.3 Variables de entorno requeridas — `.env.example` exacto (🟡 plantilla propuesta, **sin secretos reales**)

#### `server-api/.env.example` (backend Express/TS)

```bash
# ============================================================
# DriWin API — variables de entorno (Hito 2)
# Copiar a: server-api/.env   (NUNCA commitear .env)
#   Windows:  Copy-Item server-api\.env.example server-api\.env
#   Linux:    cp server-api/.env.example server-api/.env
# ============================================================

# --- Servidor ---
NODE_ENV=development
PORT=3000
API_BASE_PATH=/api/v1
# Orígenes permitidos por CORS (separados por coma)
ALLOWED_ORIGINS=http://localhost:5173,https://driwin.vercel.app
# Cambiar en producción (mínimo 32 caracteres aleatorios)
API_KEY=CHANGE_ME_generate_with_openssl_rand_hex_32
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60

# --- Azure Database for PostgreSQL Flexible Server ---
# Formato: postgresql://<usuario>:<password>@<host>:5432/<bd>?sslmode=require
DATABASE_URL=postgresql://driwin_admin:CHANGE_ME@driwin-db-server.postgres.database.azure.com:5432/driwin_catalog?sslmode=require
PGSSLMODE=require
DB_POOL_MAX=10
DB_STATEMENT_TIMEOUT_MS=5000

# --- Azure Blob Storage (offloading) ---
# Sólo se necesita la cuenta y el contenedor: el cliente descarga directo.
AZURE_STORAGE_ACCOUNT_NAME=driwinstorage
AZURE_BLOB_ENDPOINT=https://driwinstorage.blob.core.windows.net
AZURE_CONTAINER_APPS=apps
AZURE_CONTAINER_DRIVERS=drivers
# Opcional: token SAS de lectura si los contenedores pasan a privados
AZURE_SAS_TOKEN=
# Opcional: cadenas completas sólo si el API llega a firmar URLs
AZURE_STORAGE_CONNECTION_STRING=

# --- Observabilidad / trazabilidad ---
REQUEST_ID_HEADER=X-Request-Id
```

#### `app-inicio-windows/.env.example` (frontend Vite)

```bash
# Vite sólo expone variables con prefijo VITE_
VITE_API_BASE_URL=http://localhost:3000
VITE_API_BASE_PATH=/api/v1
# Sustituir por la URL real del API desplegado en Azure
# VITE_API_BASE_URL=https://driwin-api.azurewebsites.net
```

> **Reglas de seguridad del entorno:** (1) `dotenv` se carga **sólo** en `config/env.ts`, que valida con Zod y **aborta el arrancado** si `API_KEY` sigue en `CHANGE_ME` con `NODE_ENV=production`; (2) el front **nunca** ve `DATABASE_URL` (Vite sólo publica `VITE_*`); (3) rotación de `API_KEY` en Azure Key Vault (o App Settings) antes de producción; (4) `sslmode=require` es obligatorio en Flexible Server; (5) el firewall de Azure debe restringir `0.0.0.0` con *Authentication* y, preferentemente, limitar el acceso a la red de la instancia/`Allow Azure services`.

### 6.4 Matriz de riesgos de seguridad y controles

| # | Riesgo | Control actual (✅) | Control diseñado (🟡) / recomendación |
|---|---|---|---|
| 1 | Vazamiento de credenciales a Git | `.gitignore` raíz + anidado; 0 secretos en historia | Activar *GitHub secret scanning* + *push protection*; `git-secrets` en pre-commit |
| 2 | Inyección SQL | — | **Sólo** SQL parametrizado `$1..$n` en `repositories/`; prohibido concatenar; revisión de código en PR |
| 3 | API abierto a Internet | — | `X-API-Key` sólo para escrituras (`401`; la antigua clave de sólo lectura, embebida en el .exe, fue revocada), `helmet`, CORS allowlist, `express-rate-limit` (60 req/min) |
| 4 | Intercepts de la conexión a BD | — | `sslmode=require` + firewall de Flexible Server + usuario dedicado con privilegios mínimos (sólo `SELECT/INSERT/UPDATE/DELETE` en `public`) |
| 5 | Lectura indebida de hardware sin consentimiento | Modal UAC en `App.tsx` (simulado) | Electron con `contextIsolation` y `sandbox`: los canales IPC verifican el emisor y solo las tareas fijas piden elevación (UAC); declaración en `THIRD_PARTY_LICENSES.md` §3.3 (sin RUT, correo ni historial) |
| 6 | Instalación de binario manipulado | URLs fijas en `init.sql` | Verificación de hash SHA-256 y firma Authenticode en `electron/driverInstaller.ts` antes de ejecutar; migración a **enlaces oficiales** (hallazgo H-05 legal) |
| 7 | Escalar privilegios vía `removal_powershell_cmd` | — | Whitelist: el cliente **nunca** ejecuta comandos arbitrarios del cliente HTTP, sólo los de `bloatware_rules` descargados de la API (HTTPS) y validados contra una lista permitida local (`electron/bloatwarePolicy.ts`) y `ck_bloatware_risk` |
| 8 | Datos personales | Minimización (sin PII); `synthetic_users` es semilla de prueba | Evaluar **Ley N° 21.719** (vigente 01-12-2026) antes del alta real de usuarios (`THIRD_PARTY_LICENSES.md` §8) |
| 9 | Errores que filtren infraestructura | — | `errorHandler.ts` responde `INTERNAL_ERROR` genérico; stack sólo en logs con nivel `debug` |
| 10 | Dependencias vulnerables | Auditoría de 70 paquetes (0 copyleft fuerte) | `npm audit --production` + `npm outdated` en CI antes de cada entrega |

---

## 7. Argumentos técnicos: Monolito vs. Distribuido (Criterio A3 — 8 pts)

### 7.1 Postura adoptada

> **"Cliente-Servidor modular desacoplado en el tráfico pesado"**: una **aplicación de cliente rica** (monolito modular React + capa local Electron/TypeScript) frente a un **servicio de metadatos monolítico en Azure** (Express/TS + PostgreSQL Flexible Server), con el **tráfico binario delegado a un servicio externo** (Azure Blob Storage). Es decir: ni un monolito absoluto, ni microservicios.

| Componente | ¿Monolito o distribuido? |
|---|---|
| Interfaz + lógica de presentación | Monolito (SPA React, un solo bundle) |
| Lógica local de Windows | Módulo aislado dentro del binario del cliente (proceso main de Electron) |
| API de metadatos | **Monolito modular** (routes/services/repositories en un único proceso Node) |
| Persistencia | Servicio gestionado externo (Azure PostgreSQL Flexible Server) |
| Binarios (drivers/apps) | **Externo**: `driwinstorage` contenedores `apps` y `drivers` |

### 7.2 Argumento 1 — Carga esperada (escaneo + instalación desatendida)

| Escenario | Volumen | Quién lo soporta |
|---|---|---|
| Escaneo de hardware | 1 request de ~1 KB por equipo y sesión | API (monolito): negligible; es texto y consultas con índice |
| Resolución de recomendación | 1 `SELECT` con `idx_hardware_lookup` + `idx_driver_profile` → < 10 ms | API |
| **Descarga de un driver Gamer** | **540–700 MB** | **Blob Storage** (ancho de banda de Azure, sin CPU de la API) |
| **Descarga de apps del perfil** | 65 MB (Steam) … **2.900 MB** (DaVinci Resolve) | **Blob Storage** |
| Instalación silenciosa | 0 tráfico de red (ejecución local de `pnputil`/flags) | Cliente |

**Cálculo del beneficio del offloading:** si la API sirviera los binarios, atender 10 usuarios simultáneos descargando 500 MB agotaría **5 GB** de egress y saturaría el proceso Node; con offloading esos 10 usuarios consumen **10 × 1 KB de JSON** y los 5 GB los absorbe el Blob con CDN/escalamiento horizontal propio. **La API escala por número de peticiones, no por bytes transferidos** — por eso el monolito de metadatos es suficiente y la escala real (bytes) está externalizada.

**Carga de la capa local:** el escaneo WMI y la instalación corren en el CPU del usuario final, no en el servidor → el servidor **no escala con el número de PCs del país, escala con el número de consultas**, que son ligeras e indexadas.

### 7.3 Argumento 2 — Tamaño del equipo (3 integrantes)

| Factor | Consecuencia arquitectónica |
|---|---|
| 3 desarrolladores (Vicente Acevedo, Javier Cáceres, Joaquín Castillo) | **Microservicios multiplicarían el *toil***: cada servicio exige repo, pipeline, despliegue, monitoreo y contrato propio → 3-4× más superficie que una sola persona puede operar |
| Curva de aprendizaje ya comprometida (Rust en Hito 1) | Primero se **confinó Rust a la capa local** y se usó **TypeScript en el back**; al construir la capa local también se reemplazó Rust por TypeScript (Electron), dejando **un solo lenguaje** en todo el proyecto (§2.4) |
| Plazo académico del Hito 2 | Un monolito modular permite entregar CRUD completo (§3) iterando sobre una **base de código única**, sin orquestación |
| Sin equipo de DevOps ni SRE | Se prefieren **servicios gestionados** de Azure (Flexible Server, Blob) a infraestructura propia: quien opera es Azure, no el equipo |
| Requisito de defensa trazable | Un solo proceso permite mostrar de punta a punta `route → controller → service → repository → SQL` sin saltos entre contenedores |

**Regla asumida:** *premature distributed architecture is the root of all evil* — se distribuye **sólo** donde hay una razón física (bytes pesados, servicios gestionados), no por moda.

### 7.4 Argumento 3 — Costo de operación (créditos Azure for Students)

| Recurso | Elección | Justificación de costo |
|---|---|---|
| PostgreSQL | **Azure Database for PostgreSQL Flexible Server, tier *Burstable* B1ms** | Instancia de bajo consumo que cabe en los créditos de *Azure for Students*; permite escalar a `Burstable`/`General Purpose` sólo cuando crezca la carga (`Borrador.md`) |
| Blob Storage | **Account `driwinstorage`, redundancia LRS, tier Hot** | LRS es la redundancia más barata (3 réplicas en la misma región) suficiente para un catálogo de semilla; **Hot** porque los instaladores se descargan con frecuencia |
| API | **1 instancia** de App Service consumo/básico (o *serverless* consumible) | Servicio único = 1 línea de facturación; sin malla de servicios |
| Costo asumido | Flexible Server **no tiene auto-pausa a cero** | El servidor queda encendido 24/7 con consumo mínimo → **monitoreo mensual obligatorio** de la factura (`Borrador.md`, "Desventaja y Costo Asumido") |
| Costo del modelo distribuido descartado | 3+ servicios, Gateway/API Management, colas, caché | Se paga infraestructura que **3 estudiantes no podrían operar** ni justificar ante el caso de uso |
| Egress | Desplazado al Blob | El ancho de banda suele ser el cargo variable dominante; aislarlo permite medirlo por recurso |

**Argumento económico final:** la arquitectura elegida consume créditos de forma **predecible y plana** (1 instancia BD + 1 instancia API + almacenamiento), en lugar de un costo variable atado al tráfico binario.

### 7.5 Argumento 4 — Complejidad de despliegue y umbral de revisión

**Despliegue actual (mínimo viable):**

```text
git push → build (tsc + vite build / tsc -b) → 1 servicio en Azure → 1 BD gestionada → 1 cuenta Blob
```

Sin Kubernetes, sin mesh de servicios, sin broker de mensajes, sin descubrimiento de servicios. **Reproducción en un equipo limpio en < 10 minutos** (§8).

**Umbrales en los que revisaríamos la decisión (indicadores objetivos):**

| Señal | Umbral propuesto | Evolución sugerida |
|---|---|---|
| Peticiones al API | > **500 req/s sostenidos** o p95 > 300 ms | Escalar *vertical* primero (tier de Flexible Server + `DB_POOL_MAX`); luego **extraer** `recommendations` a un servicio independiente con caché (Redis) |
| Instancias de API | > **3 réplicas** en balanceador | Indicio de monolito saturado: separar por dominio (catálogo vs recomendación vs comercio) |
| Crecimiento del catálogo | > **10.000 componentes** o scrapers en Fase 2 | Desacoplar la **ingesta** del catálogo como servicio propio (`EstrategiaRecoleccionDatos.md` ya lo prevé) |
| Funciones comerciales reales | Cobros, cuentas, suscripciones | Extraer **`subscriptions`/`users`** a un servicio con su propio ciclo de despliegue y mayor nivel de seguridad (PCI/Ley 21.719) |
| Multi-región / usuarios > 1 país | Latencia > 200 ms desde LatAm | CDN delante de Blob + réplicas de lectura |
| Equipo | > 5 integrantes con dominios separados | Se justifica la frontera de microservicio por *Conway's Law* |

**Conclusión A3:** se adopta un **monolito modular con dos desacoplamientos deliberados** (Blob para bytes, BD gestionada para persistencia). Es la arquitectura de menor costo, menor complejidad de despliegue y mayor velocidad de entrega **para un equipo de 3 estudiantes**, con umbrales numéricos explícitos que justifican cuándo y cómo evolucionaría a un diseño distribuido.

---

## 8. Instrucciones de ejecución reproducible (Puerta de Entrada Hito 2)

> **Estado:** los pasos 8.1-8.5 están **verificados hoy** (frontend + base de datos). El paso 8.6 correspondiente al API está **marcado 🟡** hasta que exista `server-api/`.

### 8.1 Requisitos previos

| Herramienta | Versión mínima | Verificación |
|---|---|---|
| Git | 2.x | `git --version` |
| Node.js | ≥ 20 LTS (probado: **v24.21.0**) | `node -v` |
| npm | ≥ 10 (probado: **11.19.0**) | `npm -v` |
| PostgreSQL client (`psql`) | 16 | `psql --version` |
| (App de escritorio) Windows | 10 u 11, x64 | El escaneo y las instalaciones usan PowerShell de Windows |
| (App de escritorio) Electron | 44 (se instala con `npm ci`) | `npx electron --version` |
| Cuenta | Azure for Students con `driwin-db-server` y cuenta `driwinstorage` | — |

### 8.2 Clonar el repositorio

```bash
git clone https://github.com/VinJimbo97/DriWinProyect.git
cd DriWinProyect
git checkout feature/auditoria-vibecode   # rama que contiene db/init.sql y la documentación del Hito 2
git log -1 --oneline                      # debe mostrar 01375c0
```

> ⚠️ Si se clona sólo `main`, **no existirá `db/init.sql`** ni la documentación legal (ver §4.3).

### 8.3 Configurar variables de entorno

```powershell
# Windows (PowerShell, desde la raíz del proyecto)
Copy-Item .\app-inicio-windows\.env.example .\app-inicio-windows\.env   # si existe; si no, crearlo con §6.3
New-Item -ItemType Directory -Force .\server-api
Copy-Item .\server-api\.env.example .\server-api\.env                    # requiere server-api/ (§1.4)
notepad .\server-api\.env                                                # completar DATABASE_URL y API_KEY
```

```bash
# Linux / macOS
cp app-inicio-windows/.env.example app-inicio-windows/.env
cp server-api/.env.example server-api/.env && $EDITOR server-api/.env
```

**Verificación de que `.env` no se commiteará:**

```bash
git check-ignore -v server-api/.env    # debe imprimir la regla ".env" de .gitignore
git status --short                      # .env NO debe aparecer
```

### 8.4 Inicializar la base de datos con el script SQL

**Opción A — Azure Database for PostgreSQL Flexible Server (recomendada para la defensa):**

```bash
# 1) Crear la base de datos (una sola vez; init.sql no la crea — hallazgo H-05)
psql "host=driwin-db-server.postgres.database.azure.com port=5432 user=driwin_admin dbname=postgres sslmode=require" \
     -c "CREATE DATABASE driwin_catalog;"

# 2) Ejecutar el script de esquema + semilla (idempotente: puede correr N veces)
psql "host=driwin-db-server.postgres.database.azure.com port=5432 user=driwin_admin dbname=driwin_catalog sslmode=require" \
     -v ON_ERROR_STOP=1 -f db/init.sql
```

**Opción B — PostgreSQL local (100 % reproducible sin cuenta Azure):**

```bash
createdb driwin_catalog
psql -d driwin_catalog -v ON_ERROR_STOP=1 -f db/init.sql
```

**Verificación de la semilla (esperados entre paréntesis):**

```sql
SELECT COUNT(*) AS perfiles        FROM user_profiles;         -- 4
SELECT COUNT(*) AS componentes     FROM hardware_components;   -- 6
SELECT COUNT(*) AS drivers         FROM driver_packages;       -- 9
SELECT COUNT(*) AS apps            FROM recommended_apps;      -- 20
SELECT COUNT(*) AS vinculos        FROM profile_apps;          -- 20
SELECT COUNT(*) AS reglas          FROM bloatware_rules;       -- 3
SELECT COUNT(*) AS planes          FROM subscription_tiers;    -- 5
SELECT COUNT(*) AS usuarios_test   FROM synthetic_users;       -- 6

-- Caso Javier (consulta N.º 8 de db/init.sql)
SELECT h.ven_id, h.dev_id, h.commercial_name, d.edition_name, d.version_number, d.download_url
FROM driver_packages d
INNER JOIN user_profiles p       ON p.profile_id   = d.profile_id
INNER JOIN hardware_components h ON h.component_id = d.component_id
WHERE p.profile_name = 'Gamer' AND h.ven_id = '1002' AND h.dev_id = '1638';
-- esperado: 1 fila -> AMD Software: Adrenalin Edition 24.9.1

-- Unión Gamer + Creator (consulta N.º 1): 10 filas sin duplicados
SELECT DISTINCT a.app_name
FROM synthetic_users u
CROSS JOIN LATERAL unnest(u.selected_profiles_array) AS sel(profile_name)
INNER JOIN user_profiles p    ON p.profile_name = sel.profile_name
INNER JOIN profile_apps pa    ON pa.profile_id  = p.profile_id
INNER JOIN recommended_apps a ON a.app_id       = pa.app_id
WHERE u.user_id = 3;
```

### 8.5 Levantar el Front-End (✅ funciona hoy)

```bash
cd app-inicio-windows
npm ci                 # instala exactamente los 70 paquetes del lockfile (no usar npm install en la raíz)
npm run lint           # oxlint
npm run build          # tsc -b && vite build  -> valida tipos
npm run dev            # servidor de desarrollo (por defecto http://localhost:5173)
```

Abrir `http://localhost:5173` → modal **UAC** → **Conceder Permisos de Administrador** → cuestionario de perfil → dashboard de 5 pestañas.
*(Prototipo publicado: `https://driwin.vercel.app/`.)*

### 8.6 🟡 Levantar la API REST (pasos a ejecutar cuando exista `server-api/`, §1.4)

```bash
cd server-api
npm ci
npm run dev             # tsx watch src/server.ts  -> http://localhost:3000/api/v1/health
# en producción:
npm run build           # tsc -p tsconfig.json
npm start               # node dist/server.js
```

**Prueba de humo (una terminal aparte):**

```bash
curl -i http://localhost:3000/api/v1/health

curl -s -X POST http://localhost:3000/api/v1/recommendations/driver \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"ven_id":"1002","dev_id":"1638","os_environment":"Win11_x64","profiles":["Gamer"]}' | jq

curl -s "http://localhost:3000/api/v1/recommendations/apps?profiles=Gamer,Creator" \
  -H "X-API-Key: $API_KEY" | jq '.meta'

# CRUD del Recurso 1 (ejemplo: crear y luego borrar)
curl -i -X POST http://localhost:3000/api/v1/hardware-components \
  -H "Content-Type: application/json" -H "X-API-Key: $API_KEY" \
  -d '{"ven_id":"8086","dev_id":"9A49","commercial_name":"Intel Iris Xe Graphics","category":"GPU"}'
curl -i -X DELETE http://localhost:3000/api/v1/hardware-components/5 -H "X-API-Key: $API_KEY"   # 204
```

### 8.7 Levantar la app de escritorio (Electron, `app-inicio-windows/electron/`)

```bash
cd app-inicio-windows
npm ci
npm run electron:dev     # app de escritorio contra la API local
npm run electron:start   # app de escritorio contra la API publicada en Azure
npm run dist:win         # instalador NSIS y versión portable en release/
```

El escaneo de hardware no necesita permisos de administrador; instalar drivers o quitar bloatware abre el aviso de UAC de Windows.

### 8.8 Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `npm run dev` no encuentra scripts en la raíz | No hay `package.json` raíz (lock huérfano, H-06) | Ejecutar dentro de `app-inicio-windows/` |
| `psql: could not connect` a Azure | Firewall / `sslmode` | Agregar IP en *Connection security* de Flexible Server y usar `sslmode=require` |
| `ERROR: relation "driver_packages" does not exist` | No se corrió `init.sql` | Repetir paso 8.4 con `-v ON_ERROR_STOP=1` |
| `ERROR: database "driwin_catalog" does not exist` | `init.sql` no crea la BD (H-05) | Ejecutar el `CREATE DATABASE` del paso 8.4.1 |
| `CORS policy: No 'Access-Control-Allow-Origin'` | Origen no listado | Agregar el origen a `ALLOWED_ORIGINS` en `.env` |
| `401 UNAUTHORIZED` en curl | Falta `X-API-Key` | Incluir la cabecera (§3.1) |
| Perfil "Desarrollador" no encuentra drivers | Desfase UI ↔ BD (H-07) | Usar los nombres canónicos `Developer/Creator/Office` (Anexo A) |

---

## Anexo A — Inconsistencias detectadas entre la UI y el modelo de datos

Verificadas comparando `app-inicio-windows/src/App.tsx` con `db/init.sql`. Son **deuda de integración** pendiente de resolver al conectar el frontend al API.

| # | Elemento | En `App.tsx` (mock) | En `db/init.sql` (real) | Acción propuesta |
|---|---|---|---|---|
| A-1 | Nombres de perfil | `Gamer`, `Desarrollador`, `Creador`, `Oficinista / Thin Clients` (líneas 151-173) | `Gamer`, `Creator`, `Office`, `Developer` (líneas 184-188) | Tabla de correspondencia en `profile.service` o renombrar la UI a los canónicos |
| A-2 | Drivers mostrados | `NVIDIA RTX 3060 Laptop 512.15 → 551.76`, `Intel Iris Xe`, `Intel Wi-Fi 6 AX201`, `Realtek 6.0.9239.1` | Componentes `1002/1638`, `10DE/2504`, `14C3/7961`, `10EC/0256` con versiones `24.9.1`, `561.09`, `3.4.0.1023`, `6.0.9723.1` | Reemplazar `useState` por `GET /api/v1/recommendations/driver` |
| A-3 | Bloatware | `OneDrive`, `Xbox Game Bar`, `Cortana`, `Clipchamp` | `*BingNews*/*BingWeather*`, `*XboxGamingOverlay*`, `*MicrosoftSolitaireCollection*` con `risk_level` | Consumir `GET /api/v1/bloatware-rules` |
| A-4 | Apps instalables | 4 fijas: Steam, VS Code, Discord, Git | 20 apps repartidas en 4 perfiles | Consumir `GET /api/v1/recommendations/apps?profiles=...` |
| A-5 | Plan Premium | `$9.99 USD` anual (línea 335) | Planes en CLP: $5.000 / $30.000 / $1.500.000 (`subscription_tiers`) | Unificar moneda y planes con la BD |
| A-6 | Perfil persistido | `localStorage['driwin_profile']` = `"Gamer & Creator"` (cadena libre) | `synthetic_users.selected_profiles_array TEXT[]` | Persistir array canónico vía `POST/PATCH /api/v1/synthetic-users` |
| A-7 | Permisos UAC | `setHasAdminRights(true)` por clic (sin elevar de verdad) | — | Resuelto con Electron: el escaneo no necesita elevación y el UAC real se pide solo al instalar o quitar bloatware (`electron/elevated.ts`) |
| A-8 | Escaneo VEN/DEV | `setTimeout(2000)` que marca `parallelScanDone` | — | Resuelto: canal IPC `hardware:scan` real (`electron/hardwareScanner.ts`) |

---

## Anexo B — Mapa de criterios → secciones y checklist de cierre

### B.1 Mapa de criterios

| Criterio | Puntaje | Sección de este documento | Estado del artefacto |
|---|---|---|---|
| **A1** — Contrato y diseño de la API REST | 15 pts | §3 (3.1-3.11): convenciones, tabla maestra, 5 recursos con CRUD completo, 2 endpoints de consulta, envoltorios de error | 🟡 Diseñado |
| **A2** — Stack tecnológico y dependencias | 12 pts | §2.1-§2.5 con versiones verificadas | ✅ + 🟡 |
| **A3** — Monolito vs. distribuido | 8 pts | §7 (carga, equipo, costo, despliegue, umbrales) | ✅ Argumentado |
| **B1** — Trazabilidad con el Hito 1 | 8 pts | §4 (PDF Hito 1, cronología Git, tabla de evolución, diagrama) | ✅ |
| **B2** — Diseño de la API | 14 pts | §3 + estructura `routes/controllers/services/repositories` de §1.4 | 🟡 |
| **B3** — Árbol y separación de responsabilidades | 12 pts | §1.1 árbol, §1.2 clasificación en 5 capas, §1.3 trazabilidad punta a punta, §1.4 estructura en capas | ✅ + 🟡 |
| **B4** — Persistencia y seguridad | 10 + 10 pts | §5 (8 tablas, PK/FK/constraints, relaciones) y §6 (barrido, `.env.example`, matriz de riesgos) | ✅ |
| **B5** — Configuración y dependencias | 6 pts | §2 (roles, versiones, licencias) + §6.2 (`.gitignore`) | ✅ |

### B.2 Checklist de cierre antes de la defensa

- [ ] **1.** Commitear los cambios pendientes (`git status`: `.gitignore`, `.gitignore` de la app, `EstrategiaRecoleccionDatos.md`) — *H-12*.
- [ ] **2.** Hacer `merge`/PR de `feature/auditoria-vibecode` → `main` (en `main` falta `db/init.sql`, `LICENSE`, `THIRD_PARTY_LICENSES.md`) — *§4.3*.
- [ ] **3.** Crear `server-api/` con la estructura de §1.4 e implementar los 5 recursos CRUD de §3 (mínimo 2 completos) — *H-01 / A1 / B2*.
- [ ] **4.** Crear `server-api/.env.example` y `app-inicio-windows/.env.example` con §6.3 — *H-04 / B4*.
- [ ] **5.** Crear la BD `driwin_catalog` explícitamente y documentar el paso en el README — *H-05*.
- [ ] **6.** Alinear nombres de perfil UI ↔ BD (`Developer`, `Creator`, `Office`) — *H-07 / Anexo A-1*.
- [ ] **7.** Reemplazar los mocks de `App.tsx` por `src/services/api.ts` (`fetch` a `/api/v1/...`) — *H-03*.
- [ ] **8.** Corregir el case `app-inicio-Windows` en `README.md` y reescribir la sección de instalación con §8 — *H-11*.
- [ ] **9.** Decidir el destino del lock raíz huérfano (workspaces o eliminación) — *H-06*.
- [ ] **10.** Agregar `vitest` + `supertest` (pruebas del CRUD) y un workflow básico en `.github/workflows/ci.yml` — *H-09*.
- [ ] **11.** Verificar que los 32 binarios referenciados en `driwinstorage` existen y registrar su hash SHA-256 — *H-14*.
- [ ] **12.** `git check-ignore` sobre `.env` + `npm audit --production` como puerta de ingreso.

---

*Documento generado por auditoría directa del workspace el 21 de octubre de 2026. Toda afirmación con etiqueta ✅ fue verificada en el código o en el historial de Git; todo lo etiquetado 🟡 es un diseño pendiente de implementación y debe presentarse como tal en la defensa del Hito 2.*

