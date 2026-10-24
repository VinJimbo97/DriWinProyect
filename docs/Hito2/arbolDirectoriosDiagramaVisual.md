```mermaid
graph TD
    subgraph Presentacion["🎨 CAPA 1: PRESENTACIÓN (React 19 + TypeScript)"]
        Main["main.tsx<br/>Montaje DOM"]
        App["App.tsx<br/>Vistas & Modales"]
        ApiClient["services/api.ts<br/>Cliente HTTP Tipado"]
        Theme["styles/theme.css<br/>Tokens de Diseño"]
        Main --> App
        App --> ApiClient
        App --> Theme
    end

    subgraph Local["⚙️ CAPA 2: NEGOCIO LOCAL (Rust + Tauri)"]
        MainRs["main.rs<br/>Registro de Comandos"]
        Powershell["powershell.rs<br/>Wrapper Seguro"]
        Hardware["commands/hardware.rs<br/>detect_hardware()"]
        Drivers["commands/drivers.rs<br/>install_driver()"]
        Bloatware["commands/bloatware.rs<br/>remove_bloatware()"]
        MainRs --> Hardware
        MainRs --> Drivers
        MainRs --> Bloatware
        Hardware --> Powershell
        Drivers --> Powershell
        Bloatware --> Powershell
    end

    subgraph Backend["🖥️ CAPAS 3-5: SERVIDOR BACKEND (Node.js + Express + TS)"]
        subgraph Configuracion["Capa: Config & DB"]
            Server["server.ts<br/>Arranque HTTP"]
            App2["app.ts<br/>Pipeline Middlewares"]
            Env["config/env.ts<br/>Validación Zod"]
            Db["config/db.ts<br/>Pool PostgreSQL"]
            Server --> App2
            Server --> Env
            Server --> Db
        end

        subgraph Middlewares["Middlewares: Seguridad & Validación"]
            Auth["middlewares/authenticate.ts<br/>X-API-Key"]
            Validate["middlewares/validate.ts<br/>Zod Schemas"]
            ErrorH["middlewares/errorHandler.ts<br/>SQLSTATE → HTTP"]
            App2 --> Auth
            App2 --> Validate
            App2 --> ErrorH
        end

        subgraph Enrutamiento["Capa 3A: Enrutamiento HTTP"]
            RoutesIndex["routes/index.ts<br/>/api/v1"]
            RoutesHW["routes/hardware.routes.ts"]
            RoutesDrv["routes/drivers.routes.ts"]
            RoutesApps["routes/apps.routes.ts"]
            RoutesBloat["routes/bloatware.routes.ts"]
            RoutesPrf["routes/profiles.routes.ts"]
            RoutesRec["routes/recommendations.routes.ts"]
            RoutesIndex --> RoutesHW
            RoutesIndex --> RoutesDrv
            RoutesIndex --> RoutesApps
            RoutesIndex --> RoutesBloat
            RoutesIndex --> RoutesPrf
            RoutesIndex --> RoutesRec
            Auth --> RoutesIndex
            Validate --> RoutesIndex
        end

        subgraph Controladores["Capa 3B: Controladores HTTP"]
            CtrlHW["controllers/hardware.controller.ts"]
            CtrlDrv["controllers/drivers.controller.ts"]
            CtrlApps["controllers/apps.controller.ts"]
            CtrlBloat["controllers/bloatware.controller.ts"]
            CtrlPrf["controllers/profiles.controller.ts"]
            CtrlRec["controllers/recommendations.controller.ts"]
            RoutesHW --> CtrlHW
            RoutesDrv --> CtrlDrv
            RoutesApps --> CtrlApps
            RoutesBloat --> CtrlBloat
            RoutesPrf --> CtrlPrf
            RoutesRec --> CtrlRec
        end

        subgraph Servicios["Capa 4: Lógica de Negocio"]
            SvcHW["services/hardware.service.ts<br/>Normalización & Cascada"]
            SvcDrv["services/driver.service.ts<br/>Priorización WHQL"]
            SvcApps["services/app.service.ts<br/>Consolidación & Peso"]
            SvcBloat["services/bloatware.service.ts<br/>Filtro Riesgo"]
            SvcRec["services/recommendation.service.ts<br/>Orquestación"]
            CtrlHW --> SvcHW
            CtrlDrv --> SvcDrv
            CtrlApps --> SvcApps
            CtrlBloat --> SvcBloat
            CtrlRec --> SvcRec
            SvcRec -.Orquesta.-> SvcHW
            SvcRec -.Orquesta.-> SvcDrv
            SvcRec -.Orquesta.-> SvcApps
            SvcRec -.Orquesta.-> SvcBloat
        end

        subgraph Persistencia["Capa 5A: Repositorios SQL"]
            RepoHW["repositories/hardware.repository.ts"]
            RepoDrv["repositories/driver.repository.ts"]
            RepoApps["repositories/app.repository.ts"]
            RepoBloat["repositories/bloatware.repository.ts"]
            RepoPrf["repositories/profile.repository.ts"]
            SvcHW --> RepoHW
            SvcDrv --> RepoDrv
            SvcApps --> RepoApps
            SvcBloat --> RepoBloat
            SvcRec --> RepoApps
            SvcRec --> RepoPrf
        end

        subgraph Domain["Domain: DTOs & ApiError"]
            Interfaces["domain/*.ts<br/>Tipos TypeScript"]
            RepoHW --> Interfaces
            RepoDrv --> Interfaces
            RepoApps --> Interfaces
            RepoBloat --> Interfaces
            RepoPrf --> Interfaces
        end
    end

    subgraph BaseDatos["💾 CAPA 5B: ESQUEMA PERSISTENTE"]
        SQL["db/init.sql<br/>8 Tablas + 4 Índices<br/>Semilla & Tests"]
        Db --> SQL
    end

    subgraph Documentacion["📚 Documentación"]
        Docs["docs/"]
    end

    ApiClient -->|fetch /api/v1/*| RoutesIndex
    
    classDef capaUI fill:#eef2ff,stroke:#818cf8,stroke-width:2px
    classDef capaLocal fill:#fdf4ff,stroke:#e879f9,stroke-width:2px
    classDef capaBackend fill:#f0fdf4,stroke:#4ade80,stroke-width:2px
    classDef capaDB fill:#ecfeff,stroke:#22d3ee,stroke-width:2px
    classDef capaConfig fill:#fff7ed,stroke:#fb923c,stroke-width:2px
    classDef capaMiddleware fill:#fef2f2,stroke:#f87171,stroke-width:2px
    classDef capaRouter fill:#f0f9ff,stroke:#38bdf8,stroke-width:2px
    classDef capaController fill:#f7fee7,stroke:#a3e635,stroke-width:2px
    classDef capaService fill:#fff1f2,stroke:#fb7185,stroke-width:2px
    classDef capaRepository fill:#f5f3ff,stroke:#a78bfa,stroke-width:2px
    classDef capaDomain fill:#f0fdfa,stroke:#2dd4bf,stroke-width:2px
    
    class Presentacion,Main,App,ApiClient,Theme capaUI
    class Local,MainRs,Powershell,Hardware,Drivers,Bloatware capaLocal
    class Server,App2,Env,Db,Configuracion capaConfig
    class Auth,Validate,ErrorH,Middlewares capaMiddleware
    class RoutesIndex,RoutesHW,RoutesDrv,RoutesApps,RoutesBloat,RoutesPrf,RoutesRec,Enrutamiento capaRouter
    class CtrlHW,CtrlDrv,CtrlApps,CtrlBloat,CtrlPrf,CtrlRec,Controladores capaController
    class SvcHW,SvcDrv,SvcApps,SvcBloat,SvcRec,Servicios capaService
    class RepoHW,RepoDrv,RepoApps,RepoBloat,RepoPrf,Persistencia capaRepository
    class Interfaces,Domain capaDomain
    class SQL,BaseDatos capaDB
    class Docs,Documentacion capaBackend