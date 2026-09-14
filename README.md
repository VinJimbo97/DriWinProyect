```mermaid
---
config:
  layout: elk
  look: neo
---
flowchart TB
    %% Estilos basados en arquitectura limpia de contenedores
    classDef frontend fill:#1a202c,stroke:#3182ce,stroke-width:2px,color:#fff
    classDef local fill:#1a2b23,stroke:#38a169,stroke-width:2px,color:#fff
    classDef cloud fill:#2d2d1e,stroke:#d69e2e,stroke-width:2px,color:#fff
    classDef backend fill:#1c2d28,stroke:#4fd1c5,stroke-width:2px,color:#fff
    classDef database fill:#2b1d3a,stroke:#9f7aea,stroke-width:2px,color:#fff
    classDef error fill:#3b1e1e,stroke:#fc8181,stroke-width:2px,color:#fff

    subgraph Capa_Presentacion ["Capa de Presentación (Frontend)"]
        direction TB
        A[Inicio App / Interfaz Cliente]:::frontend --> B{¿Software posee permisos de Admin?}:::frontend
        B -- No --> C[Solicitar Permisos]:::frontend --> D
        B -- Sí --> D{¿Cuestionario fue Respondido?}:::frontend
        
        D -- Sí --> E[Recuperar Datos Guardados]:::frontend --> H
        D -- No --> F[Cuestionario: Creacion del tipo de Perfil]:::frontend
        
        H((Menu Principal de la Aplicación)):::frontend
        H --> H1[Instalador de Software]:::frontend
        H --> H2[Limpieza de Bloatware]:::frontend
        H --> H3[Configuracion y Perfil]:::frontend
        H --> H4[Cambiar a Plan Premium]:::frontend
    end

    subgraph Capa_Negocio ["Capa de Negocio (Local y Servidor)"]
        direction TB
        
        subgraph Entorno_Local [Ejecución Local]
            G[Shell: Obtener ID Hardware]:::local
        end

        subgraph Servidor_Nube [Microsoft Azure / API Backend]
            direction TB
            I[API Backend: Recibe Petición]:::backend
            K{¿Existen drivers relacionados al ID del hardware?}:::backend
            L["Entregar URL y Nombre (JSON)"]:::backend
            
            M{Evaluación de Errores}:::error
            M1[Falta URL / Nombre / Ambos]:::error
        end
    end

    subgraph Capa_Datos ["Capa de Datos (Almacenamiento)"]
        direction TB
        J[(Repositorios Físicos: PCI/USB ID)]:::database
    end

    %% Conexiones e Interacciones entre Capas
    F -. "Ejecución en Paralelo con el Cuestionario" .-> G
    F --> H
    
    %% Frontera Cliente - Servidor
    G -- "Petición HTTP" --> I
    I --> J --> K
    
    K -- Sí --> L
    K -- No --> M --> M1
    
    %% Retorno de datos a la interfaz
    L -- "Respuesta JSON" --> H
    M1 -. "Notifica Error Visual" .-> H