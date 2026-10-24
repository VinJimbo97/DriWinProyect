# DriWin — Licencias de Terceros y Descargo de Responsabilidad

**Documento:** THIRD_PARTY_LICENSES / DISCLAIMER
**Versión:** 1.0
**Fecha de emisión:** 17 de octubre de 2026
**Hito de referencia:** Hito 2 — *Aspectos Legales, Normativos y Licenciamiento*
**Titular del proyecto:** Joaquín Castillo y Equipo DriWin

> **Naturaleza del documento.** Este archivo constituye una declaración técnica y de
> cumplimiento (*compliance*) elaborada con fines académicos y de documentación de
> producto. No constituye asesoría jurídica profesional ni una opinión legal vinculante;
> su finalidad es dejar constancia formal, verificable y auditable de las prácticas de
> licenciamiento, tercerización y obtención de datos del sistema DriWin. Para efectos de
> explotación comercial definitiva se recomienda ratificar este texto con asesoría jurídica
> especializada.

---

## 1. Licencia principal del software DriWin

El código fuente propio de DriWin (interfaz, lógica de negocio local, scripts y
documentación del repositorio) se publica bajo los términos de la **Licencia MIT**,
cuyo texto íntegro se encuentra en el archivo [`LICENSE`](./LICENSE) de la raíz del
repositorio.

```
Copyright (c) 2026 Joaquín Castillo y Equipo DriWin
```

La Licencia MIT es una licencia *permisiva* (OSI Approved) que permite copiar, modificar,
combinar, distribuir y comercializar el software —incluyendo modelos de explotación
SaaS/B2B— siempre que se preserve el aviso de copyright y el texto de la licencia.
Es compatible con la incorporación de componentes bajo licencias permisivas
(MIT, Apache-2.0, ISC, BSD).

---

## 2. (a) Descargo de responsabilidad sobre *drivers* y software propietarios de fabricantes

**2.1. Titularidad.** DriWin **no es propietario**, ni afiliado, ni patrocinado, ni
autorizado por **AMD (Radeon/Adrenalin)**, **NVIDIA (GeForce/Game Ready/Studio)**,
**Intel (Arc/Graphics)**, **RealTek** ni por ningún otro fabricante de hardware o
software. Todas las marcas, logotipos, nombres comerciales, *drivers*, paneles de
gestión y binarios de dichos fabricantes pertenecen a sus respectivos titulares y se
mencionan en DriWin únicamente con fines descriptivos y de interoperabilidad
(nominative use).

**2.2. No redistribución con fines de lucro.** DriWin no comercializa, no revende y no
redistribuye con ánimo de lucro los binarios de terceros. Su papel se limita a
**facilitar la localización e instalación** del controlador adecuado en el equipo del
usuario final.

**2.3. Patrón arquitectónico de Offloading.** La obtención del *driver* opera bajo el
patrón de **Offloading** documentado en `docs/DiagramaMD/DiagramaBackEnd/`:

| Fase | Agente responsable | Tráfico de red | Contenido |
|---|---|---|---|
| 1. Resolución de metadatos | API REST propia (Azure) | Cliente → API | JSON de ~1 KB con nombre comercial y `download_url` |
| 2. Descarga del binario | **No interviene la API central** | Cliente → origen autorizado (`Blob Storage` o *endpoint* oficial) | Binario pesado (ej. 500 MB) |
| 3. Instalación | Capa local con privilegios elevados | Sin tráfico | `pnputil` / instalador silencioso |

En consecuencia, DriWin actúa como **orquestador que vincula** (*linking*) hacia
*endpoints* y contenedores *blob* autorizados, y no como fuente originaria del software
de terceros. La transferencia binaria se resuelve directamente entre el equipo del
usuario y el origen autorizado.

**2.4. Sujeción al EULA del fabricante.** Todo usuario final queda **plenamente sujeto al
Acuerdo de Licencia de Usuario Final (EULA)** del fabricante correspondiente al
descargar e instalar el controlador. DriWin no modifica, no deriva, no *reempaqueta* y
no altera las condiciones de dichos acuerdos; la aceptación del EULA ocurre en el canal
del propio fabricante o en el instalador por él distribuido. El usuario es responsable
único del cumplimiento de las condiciones de uso, redistribución y soporte de cada
fabricante.

**2.5. Control de cumplimiento (*takedown*).** Si un fabricante comunicare que un artefacto
alojado para facilitar la descarga no puede ser replicado en el almacén de DriWin, se
activará un procedimiento de **retiro inmediato** y se sustituirá por el enlace de
descarga oficial. En Hito 2 el catálogo es **reducido y sembrado manualmente**
(`EstrategiaRecoleccionDatos.md`, §1), lo que permite verificar el origen de cada
artefacto antes de publicarlo.

**2.6. Riesgo residual identificado (recomendación para Hito 3).** Almacenar binarios de
fabricantes en el *Azure Blob Storage* propio del proyecto sólo resulta conforme cuando
el fabricante autoriza expresamente la redistribución. Se recomienda, como objetivo de
arquitectura, sustituir progresivamente el alojamiento propio por **enlaces profundos
oficiales** (*official download URLs*), dejando el *blob* sólo para artefactos con
licencia de redistribución acreditada.

---

## 3. (b) Legitimidad en el uso de identificadores de hardware (PCI IDs / USB IDs / WMI)

**3.1. Qué datos lee DriWin.** La capa de negocio local ejecuta, tras la acreditación del
usuario mediante la prompt UAC de Windows, un script de PowerShell que invoca la API
documentada de **WMI/CIM** (`Get-CimInstance`, `Win32_VideoController`,
`Win32_PnPEntity`, o sus equivalentes bajo `Win32_SystemDriver`) o consulta las claves
del registro bajo
`HKLM\SYSTEM\CurrentControlSet\Enum\PCI\VEN_xxxx&DEV_xxxx&...`. De ahí se extraen
exclusivamente tres categorías de metadatos:

1. **Identificador de vendedor** (`VEN_1002`, `VEN_10DE`, `VEN_8086`, `VEN_10EC`);
2. **Identificador de dispositivo** (`DEV_1638`, `DEV_2684`, …);
3. **Entorno operativo y arquitectura** (`Win11_x64`).

**3.2. Fundamento técnico de legitimidad.**

* **Lectura local, no extracción ajena.** Los valores `VEN_/DEV_` son *hechos*
  comunicados por el propio firmware del equipo y expuestos por el sistema operativo
  mediante APIs públicas y documentadas. DriWin lee datos **del equipo del usuario y con
  su consentimiento**, no copia información de servidores ni de productos de terceros.
* **Naturaleza factual de los identificadores.** `VEN_10DE` es un número de registro de
  vendedor asignado por **PCI-SIG** (bus PCI/PCIe) o por **USB-IF** (bus USB). Se trata
  de datos de carácter **fáctico y no creativo**: los derechos de autor protegen la
  expresión, no los hechos, los números ni las listas de identificadores
  (art. 9.2 del Acuerdo TRIPS; art. 2 del Convenio de Berna). Su lectura no reproduce
  ninguna obra protegida.
* **No se redistribuye ninguna base de terceros.** DriWin **no incluye ni redistribuye**
  en su repositorio los archivos comunitarios `pci.ids` / `usb.ids`, ni catálogos de
  terceros: el mapeo `VEN/DEV → componente comercial → paquete` reside en el
  **catálogo relacional propio** en Azure Database for PostgreSQL (inicializado en
  `db/init.sql`).
* **Interoperabilidad.** La observación y descompilación limitada con fines de
  interoperabilidad entre programas está expresamente admitida en varios ordenamientos,
  por ejemplo en los arts. 5 y 6 de la Directiva 2009/24/UE (protección jurídica de los
  programas de ordenador) y en la excepción de interoperabilidad del art. 1201(f) del
  Título 17 del Código de los EE. UU.
* **Estándares abiertos de la industria.** DriWin opera sobre especificaciones públicas
  y documentadas: *PCI Local Bus Specification* (PCI-SIG), *USB Specification* (USB-IF)
  y el modelo de gestión de Windows (WMI/CIM, promovido por DMTF y documentado por
  Microsoft). La interoperabilidad con dichos estándares es una práctica consolidada y
  legítima en la industria del *hardware* y los controladores.

**3.3. Transparencia y consentimiento.** La lectura se produce tras mostrar al usuario la
solicitud de control de cuentas de usuario (UAC), queda descrita en la documentación
funcional del proyecto y **no se colectan datos personales**: ni RUT, ni correo, ni
identificadores de red, ni historial de uso. El cuestionario de perfil (ej. „Gamer")
genera una etiqueta funcional local que viaja junto a los códigos `VEN/DEV` en la carga
útil de la API.

---

## 4. (c) Ausencia de *scraping* o plagio de APIs de terceros

**4.1. Declaración formal.** En la implementación correspondiente al **Hito 2**, DriWin
**no realiza *scraping*, *crawling*, *deep scraping*, ni consumo de APIs privadas de
terceros**, ni practica plagio de código, de interfaces ni de catálogos ajenos. El
sistema consume exclusivamente:

* una **API REST propia**, desarrollada por el equipo, desplegada en Azure (capa de
  negocio); y
* un **catálogo relacional propio** en **Azure Database for PostgreSQL (Flexible Server)**,
  cuyo esquema semilla se materializa en `db/init.sql` del repositorio.

El flujo documentado en `docs/DiagramaMD/DiagramaBackEnd/DescripcionDiagramaPrueba1.md`
muestra una única petición `HTTP POST` con carga útil ultraligera
(`{"ven":"1002","dev":"1638","os":"Win11_x64","profile":"Gamer"}`), a la que la API
responde con metadatos en texto (nombre comercial y enlace). No existe, en ninguna etapa
del ciclo, una interacción automática con sistemas de terceros ajenos a los canales
oficiales de descarga.

**4.2. Alcance honesto de la declaración.** Se deja constancia de que el documento
`docs/DiagramaMD/DiagramaBackEnd/EstrategiaRecoleccionDatos.md` contempla, **como
propuesta futura de nivel Beta y no implementada**, dos vías que sí exigirían revisión
jurídica previa antes de su desarrollo:

1. *Microservicio de scraping dirigido* sobre páginas públicas de fabricantes; y
2. *Interceptación de metadatos nativos* mediante ingeniería inversa de *endpoints* de
   actualización usados por software oficial (p. ej. GeForce Experience).

**Ninguna de ambas está operativa ni forma parte del alcance del Hito 2.** Su eventual
implementación deberá considerar los términos de servicio del fabricante, las cláusulas
de interoperabilidad aplicables y una evaluación legal explícita. La tercera vía
mencionada en ese documento (traducción de códigos `VEN/DEV` a partir de diccionarios de
código abierto) es compatible con la declaración de este apartado siempre que se realice
sin redistribuir dichos diccionarios, condición que DriWin ya cumple.

**4.3. Ausencia de plagio.** El código fuente de DriWin es original del equipo; las
dependencias se declaran en `app-inicio-windows/package.json` con sus respectivas
licencias (ver §5). No se ha copiado código, textos, diagramas ni interfaces de
soluciones comerciales existentes en el mercado de gestión de controladores.

---

## 5. Inventario de dependencias de terceros y sus licencias

Ámbito de la auditoría: `app-inicio-windows/package.json`,
`app-inicio-windows/package-lock.json` (lockfileVersion 3, **70 paquetes resueltos**) y
`package-lock.json` raíz. Método: lectura del campo `license` de cada manifiesto
instalado en `node_modules`, contraste con el `package-lock.json` y barrido de texto
libre en busca de cláusulas copyleft.

### 5.1. Dependencias de producción (se distribuyen con la aplicación): 3 paquetes

| Paquete | Versión | Licencia | Tipo | Fuente |
|---|---|---|---|---|
| `react` | 19.2.8 | MIT | Producción (directa) | Meta Platforms, Inc. |
| `react-dom` | 19.2.8 | MIT | Producción (directa) | Meta Platforms, Inc. |
| `scheduler` | 0.27.0 | MIT | Producción (transitiva de React) | Meta Platforms, Inc. |

### 5.2. Dependencias de desarrollo y cadena de compilación (no se distribuyen): 67 paquetes

| Paquete | Versión | Licencia | Rol |
|---|---|---|---|
| `vite` | 8.2.2 | MIT | Bundler / servidor de desarrollo |
| `@vitejs/plugin-react` | 6.1.1 | MIT | Plugin oficial de React para Vite |
| `typescript` | ~6.0.2 (6.0.3) | Apache-2.0 | Compilador de tipos |
| `oxlint` | 1.79.x (1.81.0) | MIT | Linter |
| `@types/node` | 24.13.3 | MIT | Definiciones de tipos |
| `@types/react` | 19.2.18 | MIT | Definiciones de tipos |
| `@types/react-dom` | 19.2.7 | MIT | Definiciones de tipos |
| `postcss` | 8.5.28 | MIT | Procesamiento CSS (transitivo) |
| `nanoid` | 3.3.18 | MIT | Generación de identificadores (transitivo) |
| `picocolors` | 1.1.1 | ISC | Salida en consola (transitivo) |
| `picomatch` | 4.0.7 | MIT | Coincidencia de rutas (transitivo) |
| `tinyglobby` | 0.2.17 | MIT | Búsqueda de archivos (transitivo) |
| `fdir` | 6.5.0 | MIT | Directorios recursivos (transitivo) |
| `csstype` | 3.2.3 | MIT | Tipos CSS (transitivo) |
| `source-map-js` | 1.2.1 | BSD-3-Clause | Mapas de origen (transitivo) |
| `undici-types` | 7.18.2 | MIT | Tipos HTTP (transitivo) |
| `detect-libc` | 2.1.2 | Apache-2.0 | Detección de libc (transitivo) |
| `rolldown` + `@rolldown/pluginutils` + 15 binarios `@rolldown/binding-*` | 1.2.7 / 1.0.1 | MIT | Bundler nativo (transitivo) |
| `@oxc-project/types` | 0.148.0 | MIT | AST de Oxlint (transitivo) |
| `@oxlint/binding-*` (19 binarios por plataforma) | 1.81.0 | MIT | Binarios nativos de Oxlint (transitivo) |
| **`lightningcss` + 11 binarios `lightningcss-*`** | **1.33.0** | **MPL-2.0** | Minificación CSS (transitivo, sólo compilación) |
| `fsevents` | — | MIT | Sistema de archivos en macOS (opcional) |

### 5.3. Distribución por familias de licencia

| Licencia | Categoría | N.º de paquetes | ¿Copyleft? | Compatibilidad con MIT y SaaS/B2B |
|---|---|---|---|---|
| MIT | Permisiva | 54 | No | ✅ Total |
| Apache-2.0 | Permisiva (con patentado) | 2 | No | ✅ Total |
| ISC | Permisiva (equivalente a MIT) | 1 | No | ✅ Total |
| BSD-3-Clause | Permisiva | 1 | No | ✅ Total |
| MPL-2.0 | Copyleft **débil por archivo** | 12 | Parcial | ✅ Compatible con reservas (ver §6) |
| **GPL / AGPL / LGPL / SSPL** | — | **0** | — | **Sin conflictos detectados** |

**Total auditado: 70 paquetes resueltos** (67 de desarrollo y 3 de producción),
de los cuales **58 (82,9 %)** son permisivos, **12 (17,1 %)** copyleft débil MPL-2.0 y
**0 (0 %)** copyleft fuerte.

---

## 6. Análisis de compatibilidad y resultado de la auditoría copyleft

**6.1. Resultado.** **No se detectó ninguna dependencia bajo GPL v2/v3, AGPL, LGPL, SSPL,
CDDL ni ninguna otra licencia copyleft fuerte o *network copyleft*.** En particular,
no existe ninguna cláusula incompatible con un modelo de explotación SaaS/B2B bajo
licencia MIT, ni obligación de divulgar el código fuente propio de DriWin, ni de liberar
el catálogo relacional ni la API bajo una licencia copyleft.

**6.2. Excepción relevante: MPL-2.0 (`lightningcss`).** `lightningcss` (y sus binarios
nativos por plataforma) se distribuye bajo la **Mozilla Public License 2.0**, un copyleft
**débil y de ámbito archivo**. Conforme a la FAQ oficial de Mozilla, el copyleft sólo
alcanza a los archivos que contienen código MPL; los archivos nuevos que no lo contienen
pertenecen a una *Larger Work* y no quedan afectados, aun cuando se compilen y distribuyan
junto con archivos MPL. Aplicado a DriWin:

* es una dependencia **exclusivamente de desarrollo** (transitiva de `vite`), por lo que
  **no se distribuye** junto con el producto compilado en los escenarios habituales de
  entrega;
* **no ha sido modificada** por el equipo, por lo que no surge la obligación de publicar
  parches;
* no existe integración por fuente con el código propio de DriWin: actúa como herramienta
  externa de compilación.

**Conclusión:** su presencia es compatible con la licencia MIT de DriWin y con un modelo
de monetización SaaS/B2B. Se recomienda, no obstante, mantenerla actualizada y conservar
aviso de su licencia en la documentación distribuida (*NOTICE*), tal como se hace en este
archivo.

**6.3. Riesgos de tercerización (fabricantes).** El único riesgo material no derivado de
licencias de código abierto es el contractual/EULA de los fabricantes de *drivers*
(tratado en §2.5 y §2.6) y los términos de servicio de sitios de terceros, sólo
aplicables si se implementan las propuestas futuras de §4.2.

---

## 7. Marcas de terceros

AMD, Radeon, Adrenalin, NVIDIA, GeForce, Game Ready, Intel, Arc, RealTek, Windows,
Azure, PostgreSQL, React, Vite y TypeScript son marcas o nombres comerciales de sus
respectivos titulares. Su mención en DriWin tiene carácter puramente descriptivo e
identificativo y no implica, por sí sola, patrocinio, afiliación o respaldo.

---

## 8. Protección de datos personales (nota de cumplimiento)

DriWin opera con un principio de **minimización**: procesa únicamente metadatos de
hardware del equipo local (`VEN/DEV`, sistema operativo) y una etiqueta de perfil
funcional, sin datos personales identificables. No obstante, la **Ley N° 21.719** de Chile,
que regula la protección y tratamiento de los datos personales y crea la Agencia de
Protección de Datos Personales, entra en vigencia el **1 de diciembre de 2026**; se
recomienda evaluar su aplicación antes del despliegue productivo del servicio y del
formulario de alta de usuarios.

---

## 9. Referencias normativas y técnicas

* Instituto Licencias de Código Abierto (OSI). *MIT License*. https://opensource.org/license/mit
* Mozilla. *Mozilla Public License 2.0*. https://www.mozilla.org/en-US/MPL/2.0/ (incl. FAQ Q11–Q12)
* World Trade Organization. *Agreement on Trade-Related Aspects of Intellectual Property Rights (TRIPS)*, art. 9.2.
* European Parliament and Council. *Directive 2009/24/EC on the legal protection of computer programs*, arts. 5–6.
* United States Congress. *17 U.S.C. § 1201(f) — Reverse engineering for interoperability*.
* PCI-SIG. *PCI Local Bus Specification and Vendor/Device ID registry*. https://pcisig.com/
* USB Implementers Forum. *USB Specification and ID registry*. https://www.usb.org/
* Microsoft. *Windows Management Instrumentation (WMI)*. https://learn.microsoft.com/en-us/windows/win32/wmisdk/wmi-portal
* DMTF. *Common Information Model (CIM)*. https://www.dmtf.org/standards/cim
* Biblioteca del Congreso Nacional de Chile. *Ley N° 21.719* (vigencia: 01-12-2026). https://www.leychile.cl/leychile/navegar?idNorma=1209272

---

*Este archivo debe actualizarse en cada incorporación, sustitución o retiro de
dependencias, y en cada cambio del catálogo de controladores.*
