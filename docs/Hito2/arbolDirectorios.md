DriWinProyect/  
├── .gitignore                                    # Reglas de exclusión de secretos (.env*, *.pem, *.key) y builds  
├── LICENSE                                       # Licencia MIT (Copyright 2026 Equipo DriWin)  
├── README.md                                     # Manual raíz del repositorio e instrucciones de levantamiento  
├── THIRD_PARTY_LICENSES.md                       # Auditoría de 70 paquetes npm y descargos de responsabilidad  
│  
├── app-inicio-windows/                           # === CAPA 1: PRESENTACIÓN / INTERFAZ CLIENTE (React 19 + TS) ===  
│   ├── .env.example                              # Plantilla de variables públicas del cliente (VITE_API_BASE_URL)  
│   ├── package.json                              # Dependencias de UI y scripts Vite  
│   └── src/  
│       ├── main.tsx                              # Punto de montaje del árbol React en el DOM  
│       ├── App.tsx                               # Vistas de cuestionario, modal UAC y 5 pestañas del Dashboard  
│       ├── services/  
│       │   └── api.ts                            # Cliente HTTP tipado (fetch hacia /api/v1/*)  
│       └── styles/  
│           └── theme.css                         # Tokens de diseño visual y paleta corporativa DriWin  
│  
├── src-tauri/                                    # === CAPA 2: NEGOCIO LOCAL (Rust + Tauri 2.12.4 en PC Cliente) ===  
│   ├── Cargo.toml                                # Manifiesto de crates Rust (tauri, serde, serde_json, thiserror)  
│   ├── tauri.conf.json                           # Permisos de ventana y capabilities de ejecución local  
│   └── src/  
│       ├── main.rs                               # Registro de invoke_handler para comandos locales  
│       ├── powershell.rs                         # Wrapper seguro sobre std::process::Command  
│       └── commands/  
│           ├── hardware.rs                       # Comando detect_hardware() -> extrae VEN_ID y DEV_ID vía WMI  
│           ├── drivers.rs                        # Comando install_driver(url, flags) -> descarga de Blob y ejecuta  
│           └── bloatware.rs                      # Comando remove_bloatware(cmd) -> ejecuta Remove-AppxPackage  
│  
├── server-api/                                   # === CAPAS 3, 4 Y 5 DEL SERVIDOR BACK-END (Node.js + Express + TS) ===  
│   ├── .env.example                              # Plantilla de variables del servidor (DATABASE_URL, API_KEY)  
│   ├── package.json                              # Manifiesto del servidor (express, pg, zod, helmet, cors)  
│   ├── tsconfig.json                             # Configuración estricta del compilador TypeScript  
│   └── src/  
│       ├── server.ts                             # Arranque del servidor HTTP y cierre limpio (graceful shutdown)  
│       ├── app.ts                                # Pipeline de middlewares (helmet -> cors -> morgan -> routes -> errors)  
│       ├── config/  
│       │   ├── env.ts                            # Validación de variables de entorno al arranque mediante Zod  
│       │   └── db.ts                             # Instancia única de pg.Pool conectada a Azure PostgreSQL (SSL)  
│       ├── middlewares/  
│       │   ├── authenticate.ts                   # Verificación de cabecera X-API-Key (HTTP 401 / 403)  
│       │   ├── validate.ts                       # Validación de req.body / req.query contra esquemas Zod (HTTP 400)  
│       │   └── errorHandler.ts                   # Traducción de códigos SQLSTATE (23505, 23503) a respuestas HTTP  
│       ├── routes/                               # --- CAPA 3A: ENRUTAMIENTO HTTP ---  
│       │   ├── index.ts                          # Montaje central bajo el prefijo /api/v1  
│       │   ├── hardware.routes.ts                # Rutas CRUD para /hardware-components  
│       │   ├── drivers.routes.ts                 # Rutas CRUD para /driver-packages  
│       │   ├── apps.routes.ts                    # Rutas CRUD para /recommended-apps  
│       │   ├── bloatware.routes.ts               # Rutas CRUD para /bloatware-rules  
│       │   ├── profiles.routes.ts                # Rutas CRUD para /user-profiles  
│       │   └── recommendations.routes.ts         # Rutas POST /driver y GET /apps  
│       ├── controllers/                          # --- CAPA 3B: CONTROLADORES HTTP ---  
│       │   ├── hardware.controller.ts            # Extrae DTO de req, invoca al servicio y emite res.status().json()  
│       │   ├── drivers.controller.ts             # Sin consultas SQL ni reglas de negocio internas  
│       │   ├── apps.controller.ts  
│       │   ├── bloatware.controller.ts  
│       │   ├── profiles.controller.ts  
│       │   └── recommendations.controller.ts  
│       ├── services/                             # --- CAPA 4: LÓGICA DE NEGOCIO DEL SERVIDOR ---  
│       │   ├── hardware.service.ts               # Normalización de cadenas VEN/DEV y control de borrado en cascada  
│       │   ├── driver.service.ts                 # Reglas de priorización WHQL / Game Ready / Studio por perfil  
│       │   ├── app.service.ts                    # Consolidación de aplicaciones y cálculo de peso total en MB  
│       │   ├── bloatware.service.ts              # Regla de exclusión de riesgo MEDIO/ALTO para el perfil Gamer  
│       │   └── recommendation.service.ts         # Orquestación del cruce hardware x perfil y metadatos de Offloading  
│       ├── repositories/                         # --- CAPA 5A: ACCESO A DATOS (REPOSITORIOS SQL) ---  
│       │   ├── hardware.repository.ts            # Consultas SQL parametrizadas ($1..$n) sobre hardware_components  
│       │   ├── driver.repository.ts              # Consultas SQL parametrizadas sobre driver_packages  
│       │   ├── app.repository.ts                 # Consultas SQL parametrizadas sobre recommended_apps y profile_apps  
│       │   ├── bloatware.repository.ts           # Consultas SQL parametrizadas sobre bloatware_rules  
│       │   └── profile.repository.ts             # Consultas SQL parametrizadas sobre user_profiles  
│       └── domain/                               # Interfaces TypeScript compartidas (DTOs) y clase ApiError  
│  
├── db/                                           # === CAPA 5B: ESQUEMA Y SEMILLA PERSISTENTE ===  
│   └── init.sql                                  # Script DDL + DML idempotente (8 tablas, 4 índices, semilla y tests)  
│  
└── docs/                                         # Documentación técnica, diagramas y auditoría normativa 
