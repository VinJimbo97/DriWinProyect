<div align="center">
  <h1>⚡ DriWin Proyect</h1>
  <p><em>Para pymes, técnicos y usuarios con perfil propio que sufren la falta de productividad y rendimiento por sistemas ineficientes, garantizamos seguridad, tiempo y la máxima vida útil de su hardware.</em></p>
</div>

---

## 🚀 Prototipo Navegable

Puedes explorar la interfaz y el flujo interactivo de nuestra aplicación en el siguiente enlace:
👉 **[Acceder a DriWin (Vercel)](https://driwin.vercel.app/)**

## 👥 Equipo de Desarrollo

* **Joaquín Castillo** · [@joaquincastilloc](https://github.com/joaquincastilloc)
* **Vicente Acevedo** · [@VinJimbo97](https://github.com/VinJimbo97)
* **Javier Cáceres** · [@Ash-Lee213](https://github.com/Ash-Lee213)

## 🗂️ Estructura del repositorio

```text
DriWinProyect/
├── app-inicio-windows/     # App de escritorio: Electron 44 + React 19 + TypeScript + Vite
├── server-api/             # Back-End Node.js + Express 5 + TypeScript (API REST /api/v1)
├── db/
│   ├── init.sql            # DDL + DML idempotente (14 tablas, 7 índices, semilla)
│   ├── migrations/         # 002–011: cambios sobre una base existente (007 y 008 crean roles y permisos)
│   └── modelo_datos.md     # Diagrama Entidad-Relación (Mermaid), restricciones, índices y roles
├── docs/
│   ├── Hito2/              # Documento técnico, contrato de API, figuras y consideraciones
│   ├── qa/                 # QA y seguridad del Hito 3: benchmark, EXPLAIN, STRIDE, navegación, ISO 25010
│   └── postman/            # Colección de pruebas lista para importar
├── .env.example            # Plantilla raíz (backend + frontend, sin secretos)
└── README.md
```

## 🧭 Estado de los hitos

| Hito | Alcance | Estado |
|---|---|---|
| **Hito 1** | Propuesta técnica, mapa de usuario y diagrama cliente-servidor | ✅ Entregado |
| **Hito 2** | Motor Back-End: API REST `/api/v1` + PostgreSQL + Azure Blob (offloading) | ✅ Implementado |
| **Hito 3** | App de escritorio integrada con la API, cuentas DriWin Premium, seguridad y QA medido | ✅ Implementado · documentación en cierre |

### Recursos de la API implementados

| Recurso | GET lista | GET por id | POST | PUT | DELETE |
|---|:--:|:--:|:--:|:--:|:--:|
| `/api/v1/hardware-components` | ✅ | ✅ | ✅ | ✅ | ✅ (`?cascade=true`) |
| `/api/v1/driver-packages` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/v1/bloatware-rules` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/v1/recommendations/driver` | — | — | ✅ | — | — |
| `/api/v1/recommendations/apps` | ✅ | — | — | — | — |
| `/api/v1/health` | ✅ | — | — | — | — |
| `/api/v1/auth` (registro, inicio y cierre de sesión) | — | — | ✅ | — | — |
| `/api/v1/account` (estado, equipos, compra, privacidad, descarga y borrado de datos) | ✅ | — | ✅ | — | ✅ (`/devices/{id}`) |
| `/api/v1/support-tickets` | — | — | ✅ | — | — |

Las lecturas y recomendaciones son **públicas** (sin clave). Escribir en el catálogo exige `X-API-Key` (solo administración) y las rutas de la cuenta, el token de sesión `Authorization: Bearer dws_…`. Contrato completo: sección 5 del documento técnico.

## ✅ Requisitos previos

| Herramienta | Versión mínima | Verificación |
|---|---|---|
| Git | 2.x | `git --version` |
| Node.js | ≥ 20 LTS | `node -v` |
| npm | ≥ 10 | `npm -v` |
| PostgreSQL (`psql`) | 16 | `psql --version` |

> Para la defensa se usa la **API publicada en Azure** (sección 5.2), que sólo
> necesita HTTPS. Levantar todo en otro equipo es más simple con **PostgreSQL
> local** (Opción A): el firewall de la base de Azure sólo admite las IPs del App Service.

## 🛠️ Instalación paso a paso en un equipo limpio (Hito 2)

### 1) Clonar el repositorio

```powershell
git clone https://github.com/VinJimbo97/DriWinProyect.git
cd DriWinProyect
```

### 2) Crear la base de datos `driwin_catalog`

`db/init.sql` **no crea la base de datos** (sólo el esquema y la semilla), por lo
que este paso se ejecuta una sola vez.

**Opción A — PostgreSQL local (recomendada para la defensa):**

```powershell
createdb -U postgres driwin_catalog
# Alternativa si createdb no está en el PATH:
# psql -U postgres -c "CREATE DATABASE driwin_catalog;"
```

**Opción B — Azure Database for PostgreSQL Flexible Server:**

```powershell
psql "host=driwin-db-server.postgres.database.azure.com port=5432 user=driwin_admin dbname=postgres sslmode=require" `
     -c "CREATE DATABASE driwin_catalog;"
```

### 3) Ejecutar el script reproducible `db/init.sql`

```powershell
# Local
psql -U postgres -d driwin_catalog -v ON_ERROR_STOP=1 -f db/init.sql

# Azure
psql "host=driwin-db-server.postgres.database.azure.com port=5432 user=driwin_admin dbname=driwin_catalog sslmode=require" `
     -v ON_ERROR_STOP=1 -f db/init.sql
```

El script es **idempotente**: hace `DROP TABLE IF EXISTS ... CASCADE` y vuelve a
crear las 14 tablas, los índices y la semilla. Verificación rápida:

```sql
SELECT COUNT(*) FROM user_profiles;        -- 4
SELECT COUNT(*) FROM hardware_components;  -- 8
SELECT COUNT(*) FROM driver_packages;      -- 23
SELECT COUNT(*) FROM recommended_apps;     -- 20
SELECT COUNT(*) FROM bloatware_rules;      -- 30
```

Después, **una sola vez**, crear los roles de mínimo privilegio y sus permisos. `init.sql`
ya incluye el resultado del resto de las migraciones, así que en una base nueva solo hacen falta estas dos:

```powershell
# Local (mismo usuario que en el paso anterior)
psql -U postgres -d driwin_catalog -v ON_ERROR_STOP=1 -f db/migrations/007_roles_minimo_privilegio.sql
psql -U postgres -d driwin_catalog -v ON_ERROR_STOP=1 -f db/migrations/008_cuentas_y_suscripciones.sql
```

En Azure se ejecutan igual, con la cadena de `driwin_admin` del paso anterior. Luego se define la
contraseña del rol de la API con `\password driwin_api` dentro de psql (nunca en un archivo).

> Diagrama del modelo y diccionario de datos: [`db/modelo_datos.md`](./db/modelo_datos.md).

### 4) Configurar las variables de entorno

```powershell
# Backend
Copy-Item server-api\.env.example server-api\.env
notepad server-api\.env     # completar DATABASE_URL y API_KEY

# Frontend (opcional para la demo del API)
Copy-Item app-inicio-windows\.env.example app-inicio-windows\.env
```

Variables mínimas del backend:

```dotenv
API_KEY=<clave aleatoria de 32+ caracteres>
# Cifra los datos personales de las cuentas. Sin ella, las rutas de cuenta responden 503.
DATA_ENCRYPTION_KEY=<64 caracteres hexadecimales: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
# Opcional: puerto local de la API (por defecto, 3000).
# PORT=4300
# Azure (TLS obligatorio):
DATABASE_URL=postgresql://driwin_api:TU_PASSWORD@driwin-db-server.postgres.database.azure.com:5432/driwin_catalog?sslmode=require
PGSSLMODE=require

# PostgreSQL local sin TLS (sólo desarrollo):
# DATABASE_URL=postgresql://postgres:TU_PASSWORD@127.0.0.1:5432/driwin_catalog
# PGSSLMODE=disable
```

> En producción el arranque **falla** si `DATABASE_URL` no incluye
> `sslmode=require` o si `PGSSLMODE` es `disable`/`prefer`.
>
> Verificar que el `.env` real no se versionará:
> `git check-ignore -v server-api/.env`

### 5) Levantar el Back-End

```powershell
cd server-api
npm ci                # instala exactamente las versiones del lockfile
npm run typecheck     # validación de tipos (0 errores)
npm run build         # compilación a dist/
npm test              # 105 pruebas: unitarias, de contrato e integración con PostgreSQL en memoria
npm run dev           # http://localhost:3000/api/v1/health
```

En otra terminal, verificar la sonda de vida:

```powershell
curl "http://localhost:3000/api/v1/health"
# {"status":"ok","version":"1.1.0","database":"up","latency_ms":3,...}
```

Producción:

```powershell
npm run build
npm start
```

### 5.1) (Opcional) Generar datos sintéticos

El script agrega usuarios de prueba a `synthetic_users` respetando la matriz
comercial (plan acorde al segmento y nunca más PCs que `max_devices`). Es
**reproducible** (misma `--seed` ⇒ mismos usuarios), **reemplaza** el lote
anterior en cada ejecución y **no toca** los 6 usuarios de `init.sql`. Los
correos usan el dominio reservado `driwin-sintetico.example`, por lo que no
contienen datos personales reales.

```powershell
cd server-api
npm run seed:synthetic -- --dry-run                 # vista previa, no escribe
npm run seed:synthetic                              # 100 usuarios, semilla 42
npm run seed:synthetic -- --count 1000 --seed 7     # otro volumen / semilla
```

### 5.2) API publicada en Azure App Service

No hace falta levantar nada localmente para consumir la API: está publicada en

**https://driwin-api-hsgshffkeydpf2fe.canadacentral-01.azurewebsites.net/api/v1/health**

* Se despliega automáticamente con GitHub Actions
  ([`.github/workflows/deploy-backend.yml`](./.github/workflows/deploy-backend.yml))
  en cada push a `main` que modifique `server-api/`: instala, verifica tipos,
  ejecuta las pruebas y sólo publica si todas pasan.
* Las credenciales viven en las variables de entorno del App Service, nunca en el repositorio.
* Plan gratuito (F1): tras un rato sin uso se suspende y la primera petición
  tarda casi un minuto (~54 s medido); la app lo avisa a los 5 s. Después, cada
  consulta responde en unos 160 ms desde Chile ([benchmark](./docs/qa/benchmark/README.md)).

### 6) Levantar la app de escritorio

```powershell
cd app-inicio-windows
npm ci
npm test                 # 107 pruebas (interfaz, traducciones y políticas de seguridad de Electron)
npm run electron:start   # compila y abre la app contra la API publicada en Azure
npm run dist:win         # genera el instalador y la versión portable en release/
```

* `npm run electron:start` y `npm run dist:win` usan `.env.production`, que apunta a la API de Azure
  (la misma URL define la Content-Security-Policy de la app).
* `npm run electron:dev` usa la API local (`VITE_API_BASE_URL`, por defecto `http://localhost:3000`).
* El escaneo de hardware y las instalaciones solo funcionan en Windows 10/11; instalar drivers o
  quitar bloatware pide permiso de administrador (UAC).

### 7) Importar la colección de pruebas

1. Abrir **Postman** → *Import* → seleccionar
   [`docs/postman/DriWin_Hito2.postman_collection.json`](./docs/postman/DriWin_Hito2.postman_collection.json).
2. Editar las variables de colección:
   * `baseUrl` = `http://localhost:3000/api/v1`
   * `apiKey` = la misma `API_KEY` del `server-api/.env` (única clave; las lecturas son públicas)

   Para usar la API de Azure, importar también
   [`docs/postman/DriWin_Azure.postman_environment.json`](./docs/postman/DriWin_Azure.postman_environment.json)
   y seleccionar el entorno **DriWin · Azure (producción)** (ver [`docs/postman/README.md`](./docs/postman/README.md)).
3. Ejecutar las carpetas en orden: **Health → Hardware CRUD → Driver CRUD →
   Bloatware CRUD → Recommendations → Errores**.

La colección incluye las 4 operaciones CRUD, la recomendación de driver, la
unión de apps por perfil y los casos `400/401/404/409/422` (incluida una clave revocada → `401`).

## 📡 Contrato y documentación del Hito 2

* 📑 **[Documento Técnico Back-End (PDF)](./docs/Hito2/DriWin_Documento_Tecnico_Hito2.pdf)**
* 📘 **[Contrato completo de la API y auditoría técnica](./docs/Hito2/backendInfo.md)**
* 🧾 **[Consideraciones oficiales y rúbrica del Hito 2](./docs/Hito2/consideraciones_oficiales_del_hito_2.md)**
* 🗄️ **[Script de base de datos](./db/init.sql)** · **[Migraciones](./db/migrations/)** · **[Modelo de datos](./db/modelo_datos.md)**
* 📊 **[QA y seguridad del Hito 3](./docs/qa/README.md)** (benchmark, EXPLAIN ANALYZE, STRIDE, navegación, ISO/IEC 25010)
* 🧪 **[Colección Postman / Thunder Client](./docs/postman/DriWin_Hito2.postman_collection.json)**
* ⚖️ **[Aspectos legales, normativos y licenciamiento](./docs/Aspectos_Legales_Normativos_Licenciamiento_Hito2.md)**

### Documentación del Hito 1

* 📑 **[Documento de Propuesta Técnica](./docs/Propuesta_Tecnica.pdf)**
* 📽️ **[Láminas de Presentación](./docs/Laminas_Presentacion_DriWin.pdf)**
* 🗺️ **[Mapa del Producto (Arquitectura de Información)](./docs/Diagrama_Usuario.png)**
* ⚙️ **[Diagrama de Arquitectura Cliente-Servidor](./docs/Diagrama_Tecnico.png)**

## 🔐 Seguridad y datos personales

* Credenciales **fuera del repositorio** (`.env` excluido en `.gitignore`) y
  plantillas `.env.example` sin datos reales.
* Validación obligatoria con **Zod** de `body`, `params` y `query`.
* SQL **100 % parametrizado** (`$1..$n`), sin `SELECT *` y sin concatenación.
* Firewall de PostgreSQL cerrado: sólo acepta las IPs de salida del App Service.
* La API se conecta con el rol **`driwin_api`** (mínimo privilegio, migración 007), nunca como administrador.
* TLS obligatorio hacia PostgreSQL (`sslmode=require`). La app solo instala drivers del contenedor
  `drivers/` de Azure Blob, con SHA-256 y firma de Windows verificados; las apps se instalan con winget
  o desde su página oficial.
* La app de escritorio **no lleva claves**: la antigua clave de solo lectura estuvo dentro del `.exe`,
  se trató como credencial expuesta y se revocó. Tiene además Content-Security-Policy, `sandbox` y
  `contextIsolation`.
* Datos personales de las cuentas cifrados (AES-256-GCM, scrypt para contraseñas), aviso de privacidad
  con consentimiento registrado, y "Descargar mis datos" / "Borrar mis datos" (Ley N.º 21.719).
* Logs minimizados: no registran cuerpos, query strings sensibles ni PII. La semilla usa **usuarios y correos ficticios**.
* El CI audita las dependencias en cada Pull Request y Dependabot propone actualizaciones semanales.
  Modelo de amenazas completo: [`docs/qa/stride/`](./docs/qa/stride/README.md).

## ⚖️ Licencia

* **Licencia del proyecto:** [MIT](./LICENSE) — `Copyright (c) 2026 Joaquín Castillo y Equipo DriWin`.
* **Licencias de terceros y descargo de responsabilidad:** [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md) (drivers de fabricantes, uso de identificadores PCI/USB/WMI y ausencia de *scraping*).
