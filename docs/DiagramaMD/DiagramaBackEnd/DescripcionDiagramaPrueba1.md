## Caso de Uso Concreto: Actualización de Controlador con Patrón Offloading

**Perfil de Usuario:** Javier (Gamer). 
**Contexto:** Busca actualizar el controlador de su tarjeta de video para solucionar caídas de rendimiento, pero desconoce el modelo exacto de su hardware y la versión de software que más le conviene.

---

### Paso 1: Inicio y Asignación de Perfil
**Interacción del Usuario:** 
Abre DriWin por primera vez, lee la solicitud de intervención de seguridad (UAC) y le otorga permisos. Luego, selecciona la opción "Gamer" en el cuestionario inicial y hace clic en "Confirmar".

**Ejecución del Sistema:**
* **Capa de Presentación:** Renderiza la transición al menú principal y guarda el estado del perfil en la sesión.
* **Capa de Negocio (Local):** Al recibir privilegios de administrador, ejecuta un script de PowerShell (WMI) en segundo plano que extrae silenciosamente los identificadores físicos de la máquina. Detecta el adaptador de pantalla y registra los códigos `VEN_1002`, `DEV_1638` y el entorno operativo `Win11_x64`.

### Paso 2: Análisis y Búsqueda de Recomendaciones
**Interacción del Usuario:** 
Ingresa a la pestaña central de DriWin y observa un indicador visual que señala: "Buscando las mejores opciones para tu equipo...".

**Ejecución del Sistema:**
* **Capa de Presentación:** Envía una petición HTTP POST a la API en la nube con una carga útil ultraligera: `{"ven": "1002", "dev": "1638", "os": "Win11_x64", "profile": "Gamer"}`.
* **Capa de Negocio (Servidor):** Recibe la petición en Azure, valida la integridad de los datos y formula una consulta de base de datos.
* **Capa de Datos:** Ejecuta el filtro buscando el identificador físico 1638. Al cruzarlo con el perfil "Gamer", descarta la versión estándar y selecciona la versión "Adrenalin Edition". Retorna a la API únicamente metadatos en texto: el nombre comercial y el enlace directo de descarga.
* **Capa de Negocio (Servidor):** Devuelve a la interfaz un JSON de 1 KB con la respuesta. La conexión con la API se cierra instantáneamente, liberando los recursos del servidor para otras peticiones.

### Paso 3: Decisión e Inicio de Descarga
**Interacción del Usuario:** 
El indicador de carga desaparece. La pantalla advierte que su controlador actual está obsoleto y recomienda la versión optimizada. El usuario hace clic en el botón "Instalar".

**Ejecución del Sistema:**
* **Capa de Presentación:** Captura el evento del clic, rescata la URL almacenada en las propiedades del botón y actualiza la vista cambiando el estado visual a "Descargando... 0%".

### Paso 4: Descarga Pesada y Delegación (Offloading)
**Interacción del Usuario:** 
Observa el progreso de la barra de descarga hasta llegar al 100%, aguardando el tiempo correspondiente según el ancho de banda de su conexión a internet.

**Ejecución del Sistema:**
* **Capa de Presentación:** Inicia una conexión directa (HTTP GET) contra el Azure Blob Storage utilizando la URL proporcionada previamente por la API.
* **Almacenamiento Estático (Blob Storage):** Recibe la petición y transfiere el archivo binario pesado (ej. 500 MB) directamente al equipo local.
> **Nota Arquitectónica:** Durante esta fase, la API central de DriWin no interviene en el tráfico de red ni procesa la transferencia de datos, permaneciendo liberada para atender exclusivamente solicitudes de metadatos de otros clientes concurrentes.

### Paso 5: Instalación Silenciosa
**Interacción del Usuario:** 
Al finalizar la descarga, la interfaz indica "Instalando...". Tras un breve parpadeo de pantalla (comportamiento habitual en actualizaciones gráficas), el botón se bloquea destacando el texto "Instalado". El usuario cierra el programa de manera exitosa.

**Ejecución del Sistema:**
* **Capa de Presentación:** Detecta la finalización de la descarga y transfiere la ruta del archivo temporal descargado a la capa local.
* **Capa de Negocio (Local):** Captura el archivo binario y ejecuta comandos nativos de Windows (como `pnputil` o instaladores desatendidos con parámetros silenciosos `/S`) utilizando los privilegios elevados obtenidos en el Paso 1. El controlador se integra al núcleo del sistema operativo sin generar ventanas emergentes. Finalmente, envía la señal de confirmación a la interfaz gráfica.