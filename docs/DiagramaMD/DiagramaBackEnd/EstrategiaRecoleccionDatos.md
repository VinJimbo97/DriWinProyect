## Estrategia de Ejecución y Obtención de Controladores

El modelo de obtención de metadatos en DriWin se divide en dos fases operativas. Esta separación asegura la estabilidad absoluta durante la evaluación del prototipo y traza una ruta técnica escalable para la recolección automatizada de enlaces oficiales.

### 1. Fase Inicial: Catálogo Reducido
Para la etapa actual de desarrollo, la capa de datos opera mediante un repositorio semilla delimitado y controlado.
* **Propósito:** Asegurar la demostración técnica del flujo completo y la arquitectura de delegación de descargas (Offloading), aislando el sistema de interrupciones de red externas.
* **Mecanismo:** Mapeo manual de una lista representativa de componentes de hardware, garantizando que el enlace de descarga responda de forma estricta a la intención del perfil seleccionado (ej. diferenciar entre software de alto rendimiento y software de estabilidad).

### 2. Próximas Características: Plan de Expansión del Repertorio (SIN FECHA DE IMPLEMENTACION/ CONCEPTO A FUTURO)
Para automatizar y escalar la cobertura de hardware en futuras versiones, la arquitectura migrará a un modelo de recolección dinámico, procesando las solicitudes según la prioridad técnica de cada perfil de usuario.

* **Perfil Oficinista (Certificación y Estabilidad Absoluta):** 
  Integración nativa con el **Catálogo de Windows Update**. Mediante *wrappers* y herramientas de línea de comandos (como el módulo `PSWindowsUpdate`), el sistema enviará el identificador físico (VEN/DEV) a los servidores de Microsoft para obtener de forma silenciosa paquetes `.cab` con certificación WHQL, garantizando seguridad normativa.

* **Perfiles Específicos (Gamer, Desarrollador, Creador) [Propuesta Beta]:**
  Dado que los controladores de alto rendimiento y sus paneles de gestión no se distribuyen a través de Microsoft Update, se evaluarán tres vías de recolección avanzadas:
  1. **Microservicio de Scraping Dirigido:** Despliegue de un servicio secundario para extraer URLs oficiales directamente de las páginas de los fabricantes, aplicando filtros de intención (ej. seleccionar "NVIDIA Studio" en lugar de "Game Ready").
  2. **Interceptación de Metadatos Nativos:** Ingeniería inversa sobre los *endpoints* de actualización utilizados por el software oficial (como GeForce Experience) para solicitar y recibir enlaces de descarga directos mediante respuestas ligeras en JSON o XML.
  3. **Extracción Selectiva de Índices Open Source:** Consumo de diccionarios comunitarios de código abierto (como Snappy Driver Installer Origin) de manera exclusiva para traducir códigos VEN/DEV complejos a nombres comerciales de alta precisión, manteniendo las descargas libres de redes de pares (Torrents).