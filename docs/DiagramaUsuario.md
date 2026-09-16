```mermaid
---
config:
  layout: elk
  look: neo
  theme: dark
---
flowchart TD
    %% Estilos Neón / Modo Oscuro Coordinados
    classDef root fill:#1a103c,stroke:#9f7aea,stroke-width:2px,color:#fff,font-weight:bold
    classDef onboarding fill:#1e1e2e,stroke:#fbcb05,stroke-width:2px,color:#fff
    classDef home fill:#062314,stroke:#38a169,stroke-width:2px,color:#fff,font-weight:bold
    classDef section fill:#1a202c,stroke:#3182ce,stroke-width:2px,color:#fff
    classDef action fill:#1f2937,stroke:#4fd1c5,stroke-width:1px,color:#d1d5db,stroke-dasharray: 5 5

    Raiz[Inicio: Aplicación DriWin]:::root
    Raiz --> UAC[Intervención de Seguridad<br/>Petición de Permisos]:::onboarding
    UAC -->|El usuario inicia por primera vez| Quiz[Cuestionario Para Definir Perfil: <br/>Gamer / Dev / Oficinista / Otros...]:::onboarding
    UAC -->|El usuario ya tenía su perfil creado| Dashboard
    Quiz -->|Entrada al menu principal| Dashboard
    
    Dashboard((Dashboard Principal<br/>Menú de Navegación)):::home

    subgraph Grid_Secciones ["Visualizacion de Home para Usuario"]
        direction LR
        
        subgraph Columna_1 ["Módulos Principales (A)"]
            direction TB
            Tab1[⚡ DriWin<br/>Gestor de Drivers]:::section
            Tab2[📦 Apps<br/>Instalador Software]:::section
            Tab3[🧹 Optimizar Windows<br/>Limpieza Bloatware]:::section
            
            Tab1 --- Act1A[Ver y Actualizar Drivers]:::action
            Tab1 --- Act1B[Instalar Recomendados]:::action
            Tab2 --- Act2A[Explorar Catálogo]:::action
            Tab3 --- Act3A[Limpieza Instantánea]:::action
        end

        subgraph Columna_2 ["Módulos de Sistema (B)"]
            direction TB
            Tab4[⚙ Configuración<br/>Ajustes de Perfil]:::section
            Tab5[👑 DriWin Premium<br/>Licencia Pro]:::section
            
            Tab4 --- Act4A[Rehacer Cuestionario]:::action
            Tab5 --- Act5A[Actualizar Licencia / Pagar]:::action
        end
    end

    Dashboard --> Tab1
    Dashboard --> Tab2
    Dashboard --> Tab3
    Dashboard --> Tab4
    Dashboard --> Tab5