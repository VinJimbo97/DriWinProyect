flowchart TD
    %% Estilos
    classDef frontend fill:#1e1e1e,stroke:#4a90e2,stroke-width:2px,color:#fff
    classDef local fill:#2d2d2d,stroke:#50c878,stroke-width:2px,color:#fff
    classDef azure fill:#0078d4,stroke:#fff,stroke-width:2px,color:#fff
    classDef database fill:#f39c12,stroke:#fff,stroke-width:2px,color:#fff

    %% Subgrafos para separar responsabilidades
    subgraph Cliente [1. Aplicación Local DriWin]
        A[Primer Inicio de la App]:::frontend --> B[Cuestionario: Intenciones y Perfil]:::frontend
        B --> C[Escaneo Local: WMI y PowerShell]:::local
        C --> D[Extracción de Hardware IDs VEN/DEV y Drivers actuales]:::local
        
        K[Revisión de Choques y Resolución Local]:::local --> L[Confirmación de Sugerencias por Usuario]:::frontend
        L --> M[Descarga de Drivers desde Fabricante y Apps vía Winget]:::local
        
        M --> N((Dashboard Principal)):::frontend
        N --> O[Control de Hardware y Drivers]:::frontend
        N --> P[Instalador de Apps por Perfil]:::frontend
        N --> Q[Configuración y Privacidad]:::frontend
    end

    subgraph Servidor [2. Microsoft Azure for Students]
        E[API Backend: Recibe IDs anónimos]:::azure
        F[(Base de Datos: ~30GB)]:::database
        G[Cruce con PCI ID / USB ID]:::azure
        H[Cruce con Catálogo Semilla MVP]:::azure
        J[Respuesta JSON: Nombres reales y URLs oficiales]:::azure
    end

    %% Conexiones entre Cliente y Servidor
    D -- "Petición Segura (Solo IDs de hardware)" --> E
    E --> F
    F --> G
    G --> H
    H --> J
    J -- "Retorna Datos Procesados" --> K

    %% Lógica de reinicio
    N -. "Inicios posteriores" .-> A