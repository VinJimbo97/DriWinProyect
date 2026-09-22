```mermaid
flowchart TD
    classDef frontend fill:#00ADB5,stroke:#222831,stroke-width:2px,color:#fff,font-weight:bold;
    classDef local fill:#393E46,stroke:#00ADB5,stroke-width:2px,color:#fff;
    classDef api fill:#ffd32a,stroke:#222831,stroke-width:2px,color:#222831,font-weight:bold;
    classDef db fill:#ff4757,stroke:#222831,stroke-width:2px,color:#fff,font-weight:bold;
    classDef blob fill:#2ed573,stroke:#222831,stroke-width:2px,color:#222831,font-weight:bold;

    subgraph Capa_Presentacion [Capa de Presentación Frontend]
        UI[Interfaz DriWin React]
    end

    subgraph Capa_Negocio_Local [Capa de Negocio Local]
        Shell[Scripts PowerShell / WMI]
    end

    subgraph Capa_Negocio_Servidor [Capa de Negocio Servidor]
        API[API REST en Azure Node.js/Python]
    end

    subgraph Capa_Datos [Capa de Datos]
        DB[(Base de Datos Relacional)]
    end

    subgraph Almacenamiento_Estatico [Almacenamiento Estático / Offloading]
        Blob[(Azure Blob Storage)]
    end

    %% Flujo de ejecución
    UI -- "1. Usuario hace clic en Instalar Driver" --> Shell
    Shell -- "2. Extrae ID físico ej. DEV_1638" --> UI
    UI -- "3. Petición HTTP POST ID + Perfil Gamer" --> API
    API -- "4. Consulta SQL SELECT download_url" --> DB
    DB -- "5. Retorna solo metadatos texto ligero" --> API
    API -- "6. Responde con JSON 1KB con la URL" --> UI
    
    %% La descarga pesada
    UI == "7. Petición HTTP GET Descarga 500MB" === Blob
    Blob == "8. Entrega binario al sistema" === UI

    %% Aplicar estilos
    class UI frontend;
    class Shell local;
    class API api;
    class DB db;
    class Blob blob;