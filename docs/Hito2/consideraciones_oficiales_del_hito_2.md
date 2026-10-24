# Guía Maestra y Consideraciones Oficiales — Hito 2: El Motor que Sostiene la Promesa

**Asignatura:** Arquitectura de Desarrollo (Móvil y Web) · `INGT1003`  
**Institución:** Universidad Mayor · Facultad de Ciencias, Ingeniería y Tecnología · Escuela de Ingeniería Civil  
**Docente:** Prof. Carlos Muñoz S.  
**Semestre:** Segundo Semestre 2026  

---

## 1. Ficha General y Fechas Clave

| Parámetro | Detalle Oficial |
| :--- | :--- |
| **Nombre del Hito** | **Hito 2 · El motor que sostiene la promesa (Back-End)** |
| **Resultado de Aprendizaje (RDA)** | **RDA 2:** Aplica en forma integrada las tecnologías de desarrollo de Back-End. |
| **Unidad del Programa** | **Unidad 2:** Arquitecturas monolíticas y distribuidas. |
| **Ponderación en la Asignatura** | **35 %** (Nota parcial N2). |
| **Distribución del Puntaje** | **100 puntos totales:** 50 puntos Presentación en vivo (Bloque A) + 50 puntos Documento técnico y repositorio (Bloque B). |
| **Cierre de Entrega en GitHub** | **Viernes 30 de octubre de 2026 a las 23:59 hrs** (hora marcada por el repositorio en GitHub). |
| **Fechas de Presentación** | **Semana del 2 al 6 de noviembre de 2026**, en el bloque de laboratorio (orden sorteado al inicio de cada sesión). |
| **Duración de la Exposición** | **7:00 minutos exactos** (corte estricto con cronómetro proyectado) + hasta **2:00 minutos** de preguntas al integrante sorteado. |

---

## 2. Puertas de Entrada y Reglas Duras (Se aplican antes de puntuar)

Estas condiciones se verifican antes de aplicar la rúbrica. Si alguna se activa, su efecto reemplaza o limita el puntaje calculado:

1. **Sin GitHub no hay entrega:** Si al cierre del plazo (viernes 30 de octubre, 23:59) el repositorio no existe, es privado sin acceso de lectura para el docente o está vacío, la entrega se considera **no recibida y se califica con nota $1,0$**. No se aceptan archivos comprimidos por correo.
2. **Tope por servicio que no levanta (Puerta Crítica del Hito 2):** Si el proyecto entregado **no compila** o el servicio **no levanta** siguiendo las instrucciones entregadas en el repositorio, el **Bloque A (Presentación) queda limitado a un máximo de 20 puntos sobre 50**.
3. **Atrasos en días hábiles:**
   * Entrega con retraso de **hasta 1 día hábil**: se recibe con un **descuento de 20 puntos** sobre el total del hito.
   * Entrega con retraso **mayor a 1 día hábil**: no se recibe y el hito queda con **nota $1,0$**.
4. **El reloj corta la presentación:** A los **7:00 minutos exactos** la presentación se detiene en el punto en que vaya. Solo se evalúa lo que alcanzaron a mostrar. No hay minutos de gracia por fallas de conexión o configuración.
5. **Prohibición de cambiar de idea:** El producto comprometido en el Hito 1 es el mismo que se programa en el Hito 2.
6. **Integridad académica y plagio:** Plagio, referencias bibliográficas inexistentes, declaración de IA desmentida en la defensa, historial de Git manipulado o material de terceros presentado como propio implica **nota $1,0$ e informe a la Dirección de Escuela**.

---

## 3. Escala de Calificación y Factor Individual

### 3.1. Conversión de Puntaje a Nota Grupal (Exigencia del $60\%$)
Sobre un total de $100$ puntos ($60$ puntos equivalen a nota $4,0$):
* Si el puntaje es menor a $60$:
  $$\text{Nota Grupal} = 1,0 + 3,0 \times \frac{\text{Puntaje}}{60}$$
* Si el puntaje es $60$ o más:
  $$\text{Nota Grupal} = 4,0 + 3,0 \times \frac{\text{Puntaje} - 60}{40}$$

*(El resultado se redondea a un decimal).*

### 3.2. Factor Individual
Sobre la nota grupal se aplica un factor individual a cada integrante, determinado por dos evidencias: **(1) la respuesta a la pregunta sorteada al azar** y **(2) el historial de aportes (`commits`) en el repositorio con su propia cuenta de GitHub**:
$$\text{Nota Individual} = \max\left(1,0,\; \text{Nota Grupal} \times \text{Factor Individual}\right)$$

| Factor | Situación Observada en la Defensa y en GitHub |
| :---: | :--- |
| **$1,00$** | Responde con solvencia la pregunta sorteada y su aporte es visible en el historial del repositorio. |
| **$0,90$** | Responde de forma parcial, pero su aporte es visible en el historial del repositorio. |
| **$0,70$** | No logra responder la pregunta, aunque su aporte es visible en el historial del repositorio. |
| **$0,50$** | No responde la pregunta y su aporte en el historial del repositorio es marginal. |
| **$0,00$** | No se presenta a la evaluación sin justificación formal. |

> **Regla grupal adicional:** Si dos o más integrantes de un mismo equipo no logran responder, el grupo completo pierde además los **10 puntos** del criterio **A5**.

---

## 4. Qué se Pide y Mínimo Funcional Exigido en el Hito 2

### 4.1. Lo que se evalúa de verdad
Que el servicio funcione es **el piso, no el techo**. Lo que sube la nota es poder explicar **por qué está construido así**: por qué ese lenguaje, por qué ese framework, por qué ese motor de base de datos, por qué monolito o por qué distribuido, y **qué costo o desventaja aceptaron con cada elección**.

### 4.2. Contenidos de la Unidad 2 que deben aplicarse
* **Protocolo HTTP:** Verbos (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`), códigos de estado (`2xx`, `4xx`, `5xx`), cabeceras y contratos de datos.
* **Diseño de API REST:** Interfaz de programación orientada a recursos y versionada.
* **Frameworks para servicios web:** Rol técnico específico que resuelve cada librería empleada.
* **Separación de responsabilidades y programación en capas:** División real entre ruteo/controladores, lógica de negocio (servicios) y acceso a datos (repositorios).
* **Monolito frente a microservicios:** Ventajas, desventajas y postura defendida con datos aplicados al caso propio (carga esperada, tamaño del equipo, costo de operación y complejidad de despliegue).

### 4.3. Checklist del Mínimo Funcional Exigido
* [ ] **Al menos dos (2) recursos del dominio** con las cuatro operaciones completas: **Crear (`POST`), Leer (`GET`), Actualizar (`PUT`/`PATCH`) y Borrar (`DELETE`)**.
* [ ] **Persistencia real en un motor de base de datos** (no se acepta persistencia en memoria volátil ni en archivos temporales).
* [ ] **Códigos de estado HTTP semánticamente correctos**, incluidos los de validación y error (`200`, `201`, `204`, `400`, `401`, `404`, `409`, `422`, `500`, etc.).
* [ ] **Credenciales fuera del repositorio** (excluidas en `.gitignore`) junto con un archivo de ejemplo (`.env.example`) sin datos sensibles reales.
* [ ] **Ejecución reproducible:** El servicio debe poder levantarse en otro equipo limpio siguiendo únicamente el archivo de instrucciones (`README.md`).

---

## 5. Entregables Obligatorios del Hito 2

Todos los entregables deben estar cargados en la **rama principal (`main`)** del repositorio antes del **viernes 30 de octubre de 2026 a las 23:59**:

| # | Entregable | Formato y Ubicación en el Repositorio | Condición Mínima para ser Recibido |
| :---: | :--- | :--- | :--- |
| **1** | **Código del servicio (Back-End)** | Rama principal (`main`) del repositorio | Se levanta siguiendo el `README.md`, sin credenciales en el código y con estructura de capas visible y funcional. |
| **2** | **Documento técnico del Back-End** | Archivo **PDF** dentro de la carpeta **`docs/`** | Estructura formal completa (Anexo A), incluyendo la sección de cambios respecto del Hito 1. **Máximo 30 páginas** sin contar anexos. |
| **3** | **Tabla de la interfaz de programación (Contrato API)** | Dentro del documento técnico y en el repositorio | Especificación de rutas, verbos HTTP, parámetros, cuerpo JSON de ejemplo, criterio de versionado y códigos de estado de éxito y error. |
| **4** | **Modelo de datos y script de creación** | Carpeta **`db/`** del repositorio | Diagrama Entidad-Relación del modelo y script SQL reproducible (`db/init.sql`) que crea la base de datos y tablas desde cero. |
| **5** | **Colección del cliente de pruebas** | Archivo exportado en el repositorio (Postman / Thunder Client / REST) | Contiene las peticiones reales (incluyendo las 4 operaciones CRUD) listas para importar y ejecutar en la demostración en vivo. |
| **6** | **Archivo de configuración de ejemplo** | `.env.example` en la raíz / carpeta del servidor | Todas las variables de entorno necesarias documentadas con valores de plantilla y **sin credenciales reales**. |

---

## 6. Ruta de Trabajo Oficial (10 Pasos)

1. **Cerrar el contrato de la API (Semana 1):** Escribir la tabla de recursos (rutas, verbos, parámetros, cuerpos de ejemplo y códigos de éxito/error) antes de programar.
2. **Elegir el motor de datos y modelar (Semana 1):** Definir entidades, claves primarias/foráneas, relaciones, restricciones y escribir el script SQL de creación desde cero.
3. **Armar la estructura de capas (Semana 2):** Separar carpetas para ruteo/controladores, negocio (servicios) y acceso a datos (repositorios). Regla estricta: *en el controlador no va lógica de negocio, y las consultas SQL viven solo en la capa de datos*.
4. **Implementar el primer recurso completo (Semana 2):** Un recurso con las 4 operaciones CRUD funcionando de punta a punta contra la base de datos como molde para el resto.
5. **Sacar las credenciales del código (Semana 2):** Usar variables de entorno, crear `.env.example` sin claves reales y bloquear `.env` en `.gitignore`. Si alguna credencial se subió por error al historial, debe **rotarse** (cambiar la clave en el servidor) además de borrarse.
6. **Implementar el segundo recurso y el manejo de errores (Semana 3):** Incorporar validación de entrada y respuestas de error claras con su código HTTP real (nunca devolver `200 OK` cuando ocurre un error).
7. **Documentar la decisión de arquitectura (Semana 3):** Defender la postura Monolito vs. Distribuido evaluando **carga esperada, tamaño del equipo, costo de operación y complejidad de despliegue**, e indicar en qué escenario u umbral revisarían esa decisión.
8. **Escribir la sección de cambios respecto al Hito 1 (Semana 3):** Declarar qué cambió desde el Hito 1, **por qué** se movió y **qué impacto** tuvo.
9. **Preparar la demostración en vivo (Semana 4):** Guardar al menos las 4 peticiones reales (`POST`, `GET`, `PUT`, `DELETE`) en orden dentro del cliente de pruebas y ensayar en un equipo distinto.
10. **Ensayar los 7 minutos (Antes de presentar):** Orden recomendado por el docente: **1.º Demostración en vivo -> 2.º Justificación de tecnologías -> 3.º Decisión de arquitectura (monolito/distribuido)**. Todos los integrantes deben hablar y poder explicar cualquier archivo del código propio.

---

## 7. Rúbrica Oficial de Evaluación — Hito 2 (100 Puntos)

### Bloque A · Presentación Técnica de 7 Minutos (50 Puntos)

| Cód. | Criterio | Pts | Destacado ($100\%$) | Competente ($75\%$) | En Desarrollo ($45\%$) | Insuficiente ($0\%$) | Acción de Mejora / Foco del Evaluador |
| :---: | :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| **A1** | **Demostración de la API en vivo** | **15** | Ejecutan al menos **cuatro peticiones reales** contra su servidor, cubriendo **crear, leer, actualizar y borrar**, y muestran el **código de estado** y el **dato ya guardado** en la BD. | Ejecutan peticiones reales pero solo de lectura, o no muestran que el dato quedó guardado. | Muestran capturas o una grabación en lugar de ejecutar en vivo. | No hay demostración, o el servidor no levanta. | *En vivo contra el servicio corriendo y mostrando la persistencia en la base de datos.* |
| **A2** | **Justificación de las tecnologías empleadas** | **12** | Explican **lenguaje, framework y motor de datos** con criterios declarados y contrastados contra alternativas, y dicen **qué costo asumen** por cada elección. | Explican las elecciones con criterios generales, sin costos ni alternativas. | Justifican por moda, por un tutorial o por comodidad. | No justifican las tecnologías empleadas. | *Nombrar siempre la alternativa descartada y el precio/desventaja que se asume.* |
| **A3** | **Decisión monolito o distribuido** | **8** | Toman postura firme y la sostienen con **carga esperada, tamaño del equipo, costo de operación y complejidad de despliegue**. | Toman postura con uno o dos argumentos válidos. | Repiten definiciones teóricas de clase sin aplicarlas a su caso. | No abordan la decisión. | *Incluir los 4 factores obligatorios y el escenario en que revisarían la postura.* |
| **A4** | **Claridad técnica y tiempo** | **5** | Cierran dentro de los **7 minutos**, reparten la palabra entre los integrantes y usan vocabulario técnico correcto. | Cierran dentro del tiempo con imprecisiones de vocabulario. | Se les corta a los 7:00 con contenido central pendiente. | Presentación inconexa o sin estructura reconocible. | *Priorizar: demostración primero, justificación después, arquitectura al final.* |
| **A5** | **Respuesta del integrante consultado** | **10** | El integrante elegido al azar **explica una parte del código propio y por qué está escrita así**. | Explica qué hace el código pero no por qué se decidió así. | Reconoce el código pero no puede explicarlo. | No responde, o desconoce el código que su grupo entregó. | *Cada integrante debe conocer las capas, las consultas SQL y las decisiones de diseño.* |

### Bloque B · Documento Técnico del Back-End (50 Puntos)

| Cód. | Criterio | Pts | Destacado ($100\%$) | Competente ($75\%$) | En Desarrollo ($45\%$) | Insuficiente ($0\%$) | Acción de Mejora / Foco del Evaluador |
| :---: | :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| **B1** | **Trazabilidad con el Hito 1** | **8** | Sección de cambios que declara **qué se movió respecto del Hito 1, por qué y qué impacto tuvo**. | Declaran cambios sin explicar el motivo o el impacto. | Mencionan que hubo cambios sin detallarlos. | El documento ignora el Hito 1 o se contradice con él. | *Un cambio sin motivo documentado se evalúa como un error de planificación.* |
| **B2** | **Diseño de la API REST** | **14** | Tabla de recursos con **verbos, rutas, parámetros, cuerpo de ejemplo, códigos de estado de éxito y de error, y criterio de versionado**. | Tabla completa de rutas y verbos, pero con códigos de error incompletos o sin ejemplos de carga útil. | Lista de rutas sin contrato ni códigos de estado. | No hay diseño de API documentado. | *Documentar tanto los payloads JSON de entrada/salida como todos los códigos HTTP de error.* |
| **B3** | **Separación de responsabilidades y capas** | **12** | Muestran la **estructura de carpetas indicando qué archivo corresponde a cada capa**, con el **recorrido completo de una petición desde la ruta hasta la base de datos**. | Describen las capas y la estructura, sin recorrer una petición completa. | Afirman tener capas, pero el código muestra lógica de negocio en el controlador o consultas en la vista. | No hay separación ni descripción de capas. | *Trazar paso a paso un caso de uso real nombrando los archivos y funciones que intervienen.* |
| **B4** | **Persistencia y manejo de credenciales** | **10** | **Modelo de datos con claves, relaciones y tipos**, **script de creación reproducible**, y **credenciales fuera del repositorio con un archivo de ejemplo**. | Modelo correcto, pero sin script reproducible o sin documentar cómo configurar las credenciales. | Modelo incompleto, o credenciales escritas dentro del código. | Sin persistencia real, o con credenciales expuestas en un repositorio público. | *Verificar cero secretos en Git, `db/init.sql` idempotente y `.env.example` completo.* |
| **B5** | **Referencias técnicas** | **6** | Citan la **documentación oficial de cada tecnología usada, en norma APA 7.ª edición**, y la usan en el texto para sostener decisiones. | Citan documentación oficial, pero de manera decorativa (sin vincularla a decisiones en el texto). | Citan solo blogs, videos o foros. | Sin referencias. | *Citar documentación oficial de Node.js, Express, PostgreSQL, TypeScript, Zod, Azure, etc.* |

---

## 8. Los 6 Errores que Cuestan Puntos en el Hito 2

1. **Programar antes de definir el contrato:** Construir rutas improvisadas sin una tabla de contratos previa genera inconsistencias entre lo documentado y el código real.
2. **Devolver `200 OK` para todo:** Responder con código de éxito cuando falla una validación o no existe un registro es una falla grave de diseño HTTP.
3. **Capas que son solo carpetas:** Crear carpetas `controllers/`, `services/` y `repositories/` pero escribir consultas SQL o reglas de negocio dentro del controlador se detecta en dos minutos inspeccionando un archivo y degrada el criterio **B3**.
4. **Credenciales en el repositorio:** Subir el archivo `.env` o contraseñas de Azure/PostgreSQL dentro del código obliga a rotar la credencial, limpiar el historial de Git y penaliza severamente el criterio **B4**.
5. **Demostrar con una grabación o capturas:** Una grabación solo prueba que alguna vez funcionó. La evaluación exige ejecutar las peticiones **en vivo** (de lo contrario, **A1** cae al nivel *En desarrollo* o *Insuficiente*).
6. **Justificar tecnologías por moda o tutorial:** Decir *"elegimos Express o PostgreSQL porque es popular o porque lo vimos en un video"* sin contrastar alternativas ni declarar el costo asumido deja el criterio **A2** en el nivel más bajo.

---

## 9. Anexos Normativos Obligatorios

### Anexo A · Formato Obligatorio del Documento Técnico
El documento debe entregarse **exclusivamente en formato PDF** dentro de la carpeta `docs/` (máximo 30 páginas sin contar anexos) cumpliendo con:
1. **Tapa:** Universidad, facultad, escuela, asignatura y código (`INGT1003`), título del proyecto, nombre del equipo, integrantes en **orden alfabético por apellido**, docente, ciudad y fecha.
2. **Índice:** Generado automáticamente y con numeración de páginas concordante.
3. **Introducción:** Contexto, problema, objetivo del documento y qué encontrará el lector (entre media y una página).
4. **Desarrollo:** Cuerpo numerado, con figuras y tablas numeradas, con leyenda y referenciadas explícitamente desde el texto.
5. **Conclusión:** Qué se logró en el hito, qué quedó pendiente para el Hito 3 y qué aprendió el equipo (no es un resumen del desarrollo).
6. **Bibliografía:** Norma APA 7.ª edición, ordenada alfabéticamente, donde todas las fuentes estén citadas en el cuerpo del texto.
7. **Anexos:** Material de respaldo (declaración de uso de IA, análisis de datos personales Ley 21.719, capturas o tablas extensas).
* **Especificaciones tipográficas:** Tamaño carta, márgenes de $2,5\text{ cm}$, fuente de $11$ o $12\text{ puntos}$, interlineado de $1,15$ o $1,5$, y páginas numeradas desde la introducción.

### Anexo B · Reglas del Repositorio GitHub
* **`README.md` en la raíz:** Nombre del proyecto, promesa en una frase, integrantes con su usuario de GitHub, instrucciones paso a paso para levantar la base de datos y el servidor, y enlaces a los documentos.
* **Carpetas obligatorias:** `docs/` (PDF del documento técnico, láminas y diagramas), `db/` (diagrama del modelo y script SQL de creación), código fuente separado en capas (`server-api/`, `app-inicio-windows/`), `.gitignore` y `.env.example`.
* **Flujo de trabajo en Git:** Todos los integrantes deben registrar commits frecuentes y descriptivos desde sus propias cuentas de GitHub, trabajando con ramas por funcionalidad e integrando a `main` mediante Pull Requests revisados.

### Anexo C · Declaración de Uso de Inteligencia Artificial
* Está permitido utilizar asistentes de IA, pero es obligatorio incluir un anexo que declare: **(1) qué herramienta se usó, (2) en qué parte del trabajo se empleó y (3) cómo verificó el equipo el resultado**.
* Todo el equipo debe comprender y poder explicar línea por línea el código entregado durante la pregunta sorteada.

### Anexo D · Protección de Datos Personales (Ley N.º 21.719)
* Considerando la entrada en vigencia de la Ley N.º 21.719 en Chile (1 de diciembre de 2026), el proyecto debe declarar qué datos trata, aplicar el principio de minimización, detallar las medidas técnicas de seguridad (control de acceso, cifrado TLS, etc.) y usar **únicamente datos ficticios/sintéticos** en los entornos de prueba y semillas (`db/init.sql`).