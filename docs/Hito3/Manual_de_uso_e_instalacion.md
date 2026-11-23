# DriWin · Manual de uso e instalación

DriWin deja listo un computador con Windows: detecta el hardware, recomienda e instala los drivers
correctos desde su fuente oficial, instala las aplicaciones que corresponden al perfil de uso y
quita el software preinstalado que sobra. Este manual cubre la instalación para usar el producto,
su uso diario, la cuenta de demostración y las fallas más frecuentes. Para levantar la API y la base
de datos en otro equipo, ver la [sección 8](#8-instalación-desde-el-código-fuente).

🎬 **Video de presentación:** <https://youtu.be/Yz2jpcqObtQ>

---

## 1. Requisitos

| Para | Requisito |
|---|---|
| Usar DriWin | Windows 10 u 11 de 64 bits y conexión a internet |
| Instalar drivers o quitar bloatware | Permiso de administrador del equipo (Windows lo pide con el aviso UAC) |
| Compilar desde el código | Git 2.x, Node.js 20 o superior y npm 10 |
| Levantar la API propia | PostgreSQL 16 (`psql`) y las variables de `server-api/.env.example` |

No hace falta configurar nada: la aplicación se conecta a la API publicada en Microsoft Azure.

## 2. Instalación

1. Descargar la [versión 1.1.0](https://github.com/VinJimbo97/DriWinProyect/releases/tag/v1.1.0),
   ejecutar `DriWin-Setup-1.1.0.exe` y seguir el asistente. Si no se quiere instalar, abrir
   `DriWin-Portable-1.1.0.exe`, que funciona sin instalación.
2. Si Windows SmartScreen muestra "Windows protegió su PC", elegir **Más información → Ejecutar de
   todas formas**. El aviso aparece porque el instalador no tiene firma de código; los drivers que
   DriWin descarga sí se verifican (ver 3.3).
3. Al abrir la aplicación por primera vez puede aparecer el aviso **"El servidor estaba en reposo y está despertando"**.
   La API se suspende tras un rato sin uso y la primera respuesta puede tardar cerca de un minuto;
   las siguientes son inmediatas.

**Desinstalar:** Configuración de Windows → Aplicaciones → DriWin → Desinstalar. La versión portable
se elimina borrando el archivo.

## 3. Uso

### 3.1 Elegir el perfil

En la primera apertura, DriWin pregunta **para qué se usa el computador**: Gamer, Creador,
Oficinista o Desarrollador. Se puede elegir más de uno y se confirma con **Confirmar y Entrar a DriWin**. Mientras se responde, la aplicación escanea
el hardware en el propio equipo. El perfil se puede cambiar después en
Configuración → **Volver a hacer el cuestionario**.

### 3.2 Drivers

La pestaña **DriWin** muestra a la izquierda los drivers instalados y a la derecha la recomendación
para cada dispositivo: edición, versión, tamaño y certificación WHQL. Los dispositivos que no están en
el catálogo aparecen atenuados como "Hardware no catalogado", sin interrumpir la lista.

### 3.3 Instalar un driver

1. Presionar **Instalar** junto al driver recomendado.
2. DriWin descarga el instalador oficial y comprueba su huella SHA-256 y su firma de Windows. Si no
   coinciden, lo descarta y no lo ejecuta.
3. Aceptar el aviso de UAC y completar el asistente del fabricante.

### 3.4 Aplicaciones

En **Apps** aparecen las aplicaciones recomendadas para el perfil elegido. **Instalar** las instala con
el gestor oficial de Windows (winget); si una aplicación no está disponible en winget, el botón abre su
página oficial.

### 3.5 Optimizar Windows

**Optimizar Windows** lista las aplicaciones preinstaladas que consumen recursos sin aportar. Vienen
marcadas según el riesgo y el perfil; revisar la selección y presionar **Ejecutar limpieza**. Las de
riesgo alto son una función Premium y siempre se quitan después de crear un punto de restauración.

### 3.6 DriWin Premium y la cuenta

La versión gratuita no requiere cuenta. Premium agrega:

| Función | Qué hace |
|---|---|
| Instalar todo | Instala los drivers y apps pendientes de una vez, con un solo aviso de UAC |
| Bloatware de riesgo alto | Quita apps sensibles, con punto de restauración previo |
| Chequeo de salud | Respaldo de drivers y limpieza de dispositivos desconectados |
| Soporte técnico | Formulario de consulta asociado a la cuenta (el mensaje se guarda cifrado) |

Para activarlo, abrir el **ícono de usuario** (arriba a la derecha) y crear una cuenta o iniciar
sesión. Al crear la cuenta se acepta el aviso de privacidad, que queda registrado con su versión y
fecha. Una cuenta cubre hasta **3 equipos**; desde **Mi cuenta** se ven los equipos registrados, se
puede liberar un cupo, comprar un plan de 1, 2 o 3 años, **descargar mis datos** (archivo JSON) o
**borrar la cuenta** y todos sus datos. La sesión del equipo se guarda cifrada por Windows (DPAPI) y
se borra al cerrar sesión.

### 3.7 Configuración

El engranaje abre la configuración: idioma (español o inglés), tema (claro, oscuro o igual que
Windows), perfil activo y, en **Avanzado**, el origen del escaneo (equipo real o equipos de ejemplo).

## 4. Cuenta de demostración y datos de prueba

| Dato | Valor |
|---|---|
| Correo | `demo@driwin.example` (dominio reservado, ficticio) |
| Contraseña | `DriWin-Demo-2026` |
| Plan | DriWin Premium 1 año, vigente hasta el 12-11-2027 (pago simulado `SIM-3992A6BAD8AC6ED7`) |
| Equipos | 3 cupos: al iniciar sesión, el equipo se registra y Premium se activa en él |

**Probar otros escenarios de hardware:** Configuración → Avanzado → origen del escaneo → equipos de
ejemplo. La aplicación carga perfiles de hardware de muestra en vez del equipo real, útil para revisar
las recomendaciones sin instalar nada.

Para dejar libre el cupo al terminar una prueba, cerrar sesión o liberar el equipo desde **Mi cuenta**.

## 5. Fallas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| La primera carga tarda casi un minuto o aparece "tardó demasiado" | La API estaba en reposo (arranque en frío) | Esperar el aviso y presionar **Reintentar**; las siguientes respuestas son inmediatas |
| "Credencial de API inválida" (401) al abrir la aplicación | Se usa un instalador anterior a la revocación de la clave | Instalar la versión actual de DriWin |
| El instalador del driver no se abre | Se respondió "No" al aviso de UAC o el antivirus bloqueó la descarga | Volver a presionar **Instalar** y aceptar el aviso de Windows |
| SmartScreen impide abrir DriWin | El instalador no tiene firma de código | **Más información → Ejecutar de todas formas** |
| "No se pudo conectar con el servidor de DriWin" | Sin internet o un firewall bloquea la salida HTTPS | Revisar la conexión y presionar **Reintentar** |
| Premium no se activa en un equipo | La cuenta ya tiene 3 equipos registrados | Liberar un equipo desde **Mi cuenta** |

## 6. Privacidad

DriWin envía a la API solo lo necesario para recomendar: los identificadores del hardware (VEN/DEV) y
el perfil elegido, sin nombre de equipo ni de usuario. Los datos de la cuenta (correo, equipos, compras
y consultas de soporte) se guardan cifrados en la base de datos. El detalle está en la sección 6 del
documento final y en el aviso de privacidad de la aplicación.

## 7. Soporte

Con Premium, desde el formulario de **Soporte técnico** de la aplicación. Sin cuenta, mediante los
*issues* del repositorio.

## 8. Instalación desde el código fuente

Resumen; los comandos completos están en el [README](../../README.md#️-instalación-desde-el-código-fuente-equipo-limpio).

1. Clonar el repositorio.
2. Crear la base `driwin_catalog` y ejecutar `db/init.sql` y luego las migraciones
   `db/migrations/007_roles_minimo_privilegio.sql` y `008_cuentas_y_suscripciones.sql`.
3. Copiar `server-api/.env.example` a `server-api/.env` y completar `DATABASE_URL`, `API_KEY` y
   `DATA_ENCRYPTION_KEY`. El archivo `.env` nunca se sube al repositorio.
4. API: `cd server-api && npm ci && npm test && npm run dev`, y comprobar `GET /api/v1/health`.
5. Aplicación: `cd app-inicio-windows && npm ci && npm test && npm run electron:start`.
   `npm run dist:win` genera el instalador y la versión portable en `release/`.
