# Arquitectura y Flujo de la Aplicación

Este documento detalla el flujo de funcionamiento de la aplicación, estructurado en dos fases principales: la configuración inicial (Post-Instalación) y la interfaz de uso regular.

## Diagrama de Flujo

El siguiente diagrama ilustra el recorrido del usuario desde el primer inicio hasta el uso continuo de las herramientas de la aplicación.

```mermaid
flowchart TD
    A[Primer Inicio de la App] --> B[Evaluación de hardware]
    B -- Confirmación del usuario --> C[Preguntas para creación de ambiente]
    C --> D[Establecimiento de perfil de usuario]
    D --> E[Búsqueda de Drivers y sugerencias a descargar]
    E --> F[Revisión de posibles choques]
    F --> G[Descarga de drivers]
    G --> H[Inicio de la app]

    H -- Luego de crear el perfil, de aquí iniciará siempre --> H

    H --> I[Control de drivers]
    H --> J[Búsqueda de Apps]
    H --> K[Configuración]

    I --> L[Mostrar dispositivos]
    L --> M[Mostrar drivers]
    M --> N[Administrar drivers]

    J --> O[Mostrar Apps recomendadas según perfil]
    O --> P[Descargar Apps]

    K --> Q[Configuración general]
    K --> R[Configuración de perfil]
    K --> S[Ayuda]