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
├── app-inicio-windows/     # Frontend React 19 + TypeScript + Vite
├── server-api/             # Back-End Node.js + Express 5 + TypeScript (API REST /api/v1)
├── db/
│   ├── init.sql            # DDL + DML idempotente (8 tablas, 4 índices, semilla)
│   └── modelo_datos.md     # Diagrama Entidad-Relación (Mermaid) y diccionario
├── docs/
│   ├── Hito2/              # Documento técnico, contrato de API y consideraciones
│   └── postman/            # Colección de pruebas lista para importar
├── .env.example            # Plantilla raíz (backend + frontend, sin secretos)
└── README.md
```

## 🧭 Estado de los hitos

| Hito | Alcance | Estado |
|---|---|---|
| **Hito 1** | Propuesta técnica, mapa de usuario y diagrama cliente-servidor | ✅ Entregado |
| **Hito 2** | Motor Back-End: API REST `/api/v1` + PostgreSQL + Azure Blob (offloading) | ✅ Implementado |

### Recursos de la API implementados

| Recurso | GET lista | GET por id | POST | PUT | DELETE |
|---|:--:|:--:|:--:|:--:|:--:|
| `/api/v1/hardware-components` | ✅ | ✅ | ✅ | ✅ | ✅ (`?cascade=true`) |
| `/api/v1/driver-packages` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/v1/bloatware-rules` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/v1/recommendations/driver` | — | — | ✅ | — | — |
| `/api/v1/recommendations/apps` | ✅ | — | — | — | — |
| `/api/v1/health` | ✅ | — | — | — | — |

## ✅ Requisitos previos

| Herramienta | Versión mínima | Verificación |
|---|---|---|
| Git | 2.x | `git --version` |
| Node.js | ≥ 20 LTS | `node -v` |
| npm | ≥ 10 | `npm -v` |
| PostgreSQL (`psql`) | 16 | `psql --version` |

> Para la defensa se recomienda **PostgreSQL local** (Opción B), porque no
> depende de la red ni de las credenciales de Azure.

## 🛠️ Instalación paso a paso en un equipo limpio (Hito 2)

### 1) Clonar el repositorio

```powershell
git clone https://github.com/VinJimbo97/DriWinProyect.git
cd DriWinProyect
# Si los cambios del Hito 2 aún no están fusionados en main:
git checkout feature/backend
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
crear las 8 tablas, 4 índices y la semilla. Verificación rápida:

```sql
SELECT COUNT(*) FROM user_profiles;        -- 4
SELECT COUNT(*) FROM hardware_components;  -- 6
SELECT COUNT(*) FROM driver_packages;      -- 9
SELECT COUNT(*) FROM recommended_apps;     -- 20
SELECT COUNT(*) FROM bloatware_rules;      -- 3
```

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
npm test              # 56 pruebas unitarias y de contrato
npm run dev           # http://localhost:3000/api/v1/health
```

En otra terminal, verificar la sonda de vida:

```powershell
curl "http://localhost:3000/api/v1/health"
# {"status":"ok","version":"1.0.0","database":"up","latency_ms":3,...}
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

### 6) Levantar el Front-End

```powershell
cd app-inicio-windows
npm ci
npm run dev           # http://localhost:5173
```

### 7) Importar la colección de pruebas

1. Abrir **Postman** → *Import* → seleccionar
   [`docs/postman/DriWin_Hito2.postman_collection.json`](./docs/postman/DriWin_Hito2.postman_collection.json).
2. Editar las variables de colección:
   * `baseUrl` = `http://localhost:3000/api/v1`
   * `apiKey` = la misma `API_KEY` del `server-api/.env`
   * `readOnlyKey` = opcional, la misma `API_KEY_READ_ONLY`
3. Ejecutar las carpetas en orden: **Health → Hardware CRUD → Driver CRUD →
   Bloatware CRUD → Recommendations → Errores**.

La colección incluye las 4 operaciones CRUD, la recomendación de driver, la
unión de apps por perfil y los casos `400/401/403/404/409/422`.

## 📡 Contrato y documentación del Hito 2

* 📑 **[Documento Técnico Back-End (PDF)](./docs/Hito2/Documento_Tecnico_Backend_Hito2_DriWin.pdf)**
* 📘 **[Contrato completo de la API y auditoría técnica](./docs/Hito2/backendInfo.md)**
* 🧾 **[Consideraciones oficiales y rúbrica del Hito 2](./docs/Hito2/consideraciones_oficiales_del_hito_2.md)**
* 🗄️ **[Script de base de datos](./db/init.sql)** · **[Modelo de datos](./db/modelo_datos.md)**
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
* TLS obligatorio hacia PostgreSQL (`sslmode=require`) y URLs de descarga
  restringidas a los contenedores `apps/` y `drivers/` de Azure Blob Storage.
* Logs minimizados: no registran cuerpos, query strings sensibles ni PII
  (Ley N.º 21.719). La semilla usa **usuarios y correos ficticios**.

## ⚖️ Licencia

* **Licencia del proyecto:** [MIT](./LICENSE) — `Copyright (c) 2026 Joaquín Castillo y Equipo DriWin`.
* **Licencias de terceros y descargo de responsabilidad:** [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md) (drivers de fabricantes, uso de identificadores PCI/USB/WMI y ausencia de *scraping*).
