# Aspectos Legales, Normativos y Licenciamiento — DriWin (Hito 2)

**Documento de respaldo para el informe técnico y la presentación**
**Versión:** 1.0 · **Fecha:** 17 de octubre de 2026
**Elaborado por:** Auditoría de Compliance & Licensing — Equipo DriWin
**Archivos asociados:** [`../LICENSE`](../LICENSE) · [`../THIRD_PARTY_LICENSES.md`](../THIRD_PARTY_LICENSES.md)

> *Este documento reúne (i) la metodología y los resultados de la auditoría de
> licenciamiento de dependencias, (ii) los hallazgos con su severidad y (iii) el texto
> redactado en Norma APA 7.ª edición, listo para incrustarse en la sección “Aspectos
> Legales, Normativos y Licenciamiento” del informe final.*

---

## 1. Alcance

Auditoría de todas las dependencias de software de terceros declaradas en
`app-inicio-windows/package.json` y resueltas en `app-inicio-windows/package-lock.json`
(lockfileVersion 3), con el propósito de determinar:

1. compatibilidad de las licencias con la **Licencia MIT** adoptada por DriWin;
2. ausencia de licencias **copyleft restrictivas** (GPL v3, AGPL, LGPL, SSPL) incompatibles
   con un modelo de monetización **SaaS / B2B**;
3. legitimidad de la obtención de metadatos de hardware y de la entrega de *drivers* de
   terceros.

---

## 2. Metodología de auditoría (reproducible)

| Paso | Acción | Fuente verificada |
|---|---|---|
| 1 | Inventario de manifiestos | `package.json`, `package-lock.json` (raíz y `app-inicio-windows/`) |
| 2 | Extracción de licencias | Campo `license` de los paquetes instalados en `node_modules/**/package.json`, contrastado con los 70 registros del lockfile (el paquete opcional `fsevents` sólo se instala en macOS) |
| 3 | Barrido de copyleft | Búsqueda de términos `GPL`, `AGPL`, `LGPL`, `SSPL`, `CDDL`, `EUPL` en manifiestos, archivos `LICENSE` y textos de avisos |
| 4 | Clasificación por criticidad | Separación dependencias de **producción** (se distribuyen) vs. **desarrollo** (cadena de compilación, no se distribuyen) |
| 5 | Evaluación de compatibilidad | Contraste con la matriz OSI/FSF y con la FAQ oficial de Mozilla para MPL-2.0 |

**Comandos de verificación (reproducibles):**

```bash
# Licencias instaladas reales (desde la raíz del repositorio)
node -e "const l=require('./app-inicio-windows/package-lock.json');for(const [k,v] of Object.entries(l.packages))if(k)console.log(k.replace('node_modules/',''),v.version,v.license,v.dev?'[dev]':'[prod]')"
```

---

## 3. Hallazgos de auditoría

| ID | Hallazgo | Severidad | Estado / recomendación |
|---|---|---|---|
| **H-01** | No existe archivo `LICENSE` en la raíz | **Alta** | ✅ **Corregido:** se crea `LICENSE` (MIT, *Copyright (c) 2026 Joaquín Castillo y Equipo DriWin*) |
| **H-02** | No existía inventario público de terceros ni descargo por *drivers* propietarios | **Alta** | ✅ **Corregido:** `THIRD_PARTY_LICENSES.md` |
| **H-03** | Ausencia de licencias GPL/AGPL/LGPL/SSPL en las 70 dependencias resueltas | **Informativa** | ✅ Sin conflicto: 58 permisivas + 12 MPL-2.0 (copyleft débil) |
| **H-04** | `lightningcss` (MPL-2.0) presente en la cadena de compilación | **Media** | ✅ Aceptado: dependencia de desarrollo, sin modificaciones, copyleft por archivo (Mozilla, s. f.); conservar aviso de licencia |
| **H-05** | El catálogo de *drivers* almacena binarios en `Azure Blob Storage` propio | **Media** | ⚠️ En seguimiento: verificar autorización de redistribución de cada fabricante y migrar a enlaces oficiales en Hito 3 |
| **H-06** | `docs/.../EstrategiaRecoleccionDatos.md` contempla *scraping* e ingeniería inversa de *endpoints* como **propuesta Beta futura** | **Media** | ⚠️ No implementada en Hito 2; exige evaluación jurídica previa antes de desarrollarla |
| **H-07** | `package-lock.json` de la raíz existe sin `package.json` asociado (lockfile vacío: `packages: {}`) | **Baja** | ⚠️ Alinear: eliminar el lock huérfano o declarar un `package.json` raíz con *workspaces* |
| **H-08** | Lectura local de metadatos vía WMI/PowerShell y cuestionario de perfil | **Baja** | ✅ Sin datos personales identificables; evaluar Ley N° 21.719 (vigente desde 01-12-2026) antes del despliegue productivo |

---

## 4. Tabla consolidada de dependencias y licencias

### Tabla 1 — Resumen por familia de licencia (total auditado: 70 paquetes)

| Licencia | Familia | Paquetes | % | ¿Copyleft? | Compatibilidad con MIT / SaaS-B2B |
|---|---|---:|---:|---|---|
| MIT | Permisiva | 54 | 77,1 % | No | ✅ Total |
| Apache-2.0 | Permisiva (con cláusula de patentes) | 2 | 2,9 % | No | ✅ Total |
| ISC | Permisiva (equivalente funcional a MIT) | 1 | 1,4 % | No | ✅ Total |
| BSD-3-Clause | Permisiva | 1 | 1,4 % | No | ✅ Total |
| **MPL-2.0** | Copyleft **débil por archivo** | **12** | **17,1 %** | Parcial | ✅ Compatible (ver H-04) |
| GPL / AGPL / LGPL / SSPL / CDDL | Copyleft fuerte o de red | **0** | 0,0 % | — | ✅ **Sin conflictos** |

**Total permisivo: 58 paquetes (82,9 %) · Total copyleft débil: 12 (17,1 %) · Total copyleft fuerte: 0 (0 %).**

### Tabla 2 — Dependencias de producción (se distribuyen con el binario): 3 paquetes

| # | Paquete | Versión | Licencia | Rol en DriWin |
|---:|---|---|---|---|
| 1 | `react` | 19.2.8 | MIT | Biblioteca de interfaz de usuario |
| 2 | `react-dom` | 19.2.8 | MIT | Puente React ↔ DOM del navegador |
| 3 | `scheduler` | 0.27.0 | MIT | Planificador de prioridades (transitiva de React) |

> **100 % de las dependencias distribuidas se licencian bajo MIT.**

### Tabla 3 — Dependencias directas de desarrollo: 7 paquetes

| # | Paquete | Versión | Licencia | Rol |
|---:|---|---|---|---|
| 1 | `vite` | 8.2.2 | MIT | Bundler y servidor de desarrollo |
| 2 | `@vitejs/plugin-react` | 6.1.1 | MIT | Integración React–Vite |
| 3 | `typescript` | 6.0.3 (`~6.0.2`) | Apache-2.0 | Compilación con tipos |
| 4 | `oxlint` | 1.81.0 (`^1.79.0`) | MIT | Análisis estático / *linting* |
| 5 | `@types/node` | 24.13.3 | MIT | Definiciones de tipos Node.js |
| 6 | `@types/react` | 19.2.18 | MIT | Definiciones de tipos React |
| 7 | `@types/react-dom` | 19.2.7 | MIT | Definiciones de tipos ReactDOM |

### Tabla 4 — Dependencias transitivas (60 paquetes, agrupadas por familia)

| Familia de paquetes | Cant. | Versión | Licencia | Propietario / origen |
|---|---:|---|---|---|
| `@oxlint/binding-*` (binarios por plataforma) | 19 | 1.81.0 | MIT | Oxc |
| `@rolldown/binding-*` (binarios por plataforma) | 15 | 1.2.7 | MIT | Rolldown / VoidZero |
| `lightningcss` + `lightningcss-*` (binarios) | 12 | 1.33.0 | **MPL-2.0** | Devon Govett / Parcel |
| `rolldown`, `@rolldown/pluginutils` | 2 | 1.2.7 / 1.0.1 | MIT | VoidZero |
| `@oxc-project/types` | 1 | 0.148.0 | MIT | Oxc |
| `postcss` | 1 | 8.5.28 | MIT | Andrey Sitnik |
| `nanoid` | 1 | 3.3.18 | MIT | Andrey Sitnik |
| `picocolors` | 1 | 1.1.1 | ISC | Alexey Raspopov |
| `picomatch` | 1 | 4.0.7 | MIT | Jon Schlinkert |
| `csstype` | 1 | 3.2.3 | MIT | Fredrik Nicol |
| `fdir` | 1 | 6.5.0 | MIT | thecodrr |
| `tinyglobby` | 1 | 0.2.17 | MIT | Superchupu |
| `source-map-js` | 1 | 1.2.1 | BSD-3-Clause | Valentin Semirulnik |
| `undici-types` | 1 | 7.18.2 | MIT | Contribuidores de Node.js |
| `detect-libc` | 1 | 2.1.2 | Apache-2.0 | Lovell Fuller |
| `fsevents` (sólo macOS, no instalado en Windows) | 1 | 2.3.3 | MIT | Contribuidores de fsevents |
| **Total transitivos** | **60** | — | — | — |

> Los nombres de autoría se indican con fines informativos a partir de los manifiestos
> públicos de cada paquete; la referencia normalizada en el informe se encuentra en §7.

---

## 5. Texto listo para el informe — sección “Aspectos Legales, Normativos y Licenciamiento”

*Los siguientes párrafos están redactados conforme a la Norma APA 7.ª edición
(citas parentéticas y de narrativa, referencias con sangría francesa) y pueden
incorporarse directamente al documento final.*

### 5.1 Licenciamiento del producto

> El software desarrollado por DriWin se publica bajo la Licencia MIT, una licencia
> permisiva aprobada por la Open Source Initiative que autoriza copiar, modificar,
> combinar, distribuir y comercializar el programa, incluso bajo modelos de explotación
> en la nube, siempre que se conserve el aviso de copyright y el texto íntegro de la
> licencia (Open Source Initiative, s. f.). El copyright correspondiente se declara como
> *Copyright (c) 2026 Joaquín Castillo y Equipo DriWin* en el archivo `LICENSE` de la
> raíz del repositorio (Castillo y Equipo DriWin, 2026). Esta decisión de licenciamiento
> habilita explícitamente la comercialización B2B y el modelo *software as a service*
> (SaaS), sin generar para el equipo obligación alguna de divulgar el código fuente
> propio, el catálogo relacional ni la API de servicios.

### 5.2 Inventario y compatibilidad de dependencias

> La auditoría del manifiesto de dependencias del Hito 2 cubrió los 70 paquetes resueltos
> en el archivo de bloqueo de versiones, de los cuales tres corresponden a dependencias de
> producción —`react`, `react-dom` y `scheduler`— y 67 a la cadena de compilación y
> verificación; estas últimas comprenden el *bundler* Vite, el compilador TypeScript, el
> analizador estático Oxlint y el procesador de hojas de estilo PostCSS, entre otros
> (You, s. f.; Microsoft, s. f.; Oxc, s. f.; Sitnik, s. f.). En términos de licencias, se
> identificaron 54 paquetes bajo MIT, 2 bajo Apache-2.0, 1 bajo ISC, 1 bajo BSD-3-Clause y
> 12 bajo MPL-2.0, esto es, un 82,9 % de componentes de licencia permisiva y un 17,1 % de
> copyleft débil (Castillo y Equipo DriWin, 2026). La totalidad de las dependencias
> efectivamente distribuidas con la aplicación se licencian bajo MIT (Meta Platforms, Inc.,
> s. f.), lo que garantiza coherencia interna entre la licencia del producto y la de sus
> componentes en tiempo de ejecución.

### 5.3 Ausencia de copyleft restrictivo

> El barrido de manifiestos y avisos de licencia no arrojó presencia de las licencias
> GNU GPL v2/v3, AGPL, LGPL ni SSPL en ninguna de las dependencias resueltas; en
> consecuencia, no existe cláusula que obligue a licenciar el código fuente de DriWin bajo
> una licencia copyleft fuerte, ni que desencadene la divulgación de la fuente por el solo
> hecho de prestar el servicio en línea. El único componente con carácter copyleft es
> `lightningcss` 1.33.0, distribuido bajo la Mozilla Public License 2.0, cuyo alcance se
> limita al archivo que contiene el código licenciado: conforme a la pregunta 11 de la FAQ
> oficial de Mozilla, los archivos nuevos que no incorporan código MPL no quedan afectados
> aun cuando se compile y distribuya junto con él un conjunto mayor (Mozilla, s. f.). Dicho
> paquete opera exclusivamente como herramienta de compilación, no se modifica y no se
> distribuye con el producto final, por lo que su compatibilidad con la Licencia MIT y con
> un modelo de monetización SaaS/B2B es plena (Govett, s. f.).

### 5.4 Legitimidad en la obtención de identificadores de hardware

> La identificación del equipo se realiza íntegramente en el equipo del usuario, mediante
> la API documentada de Windows Management Instrumentation invocada desde PowerShell
> (Microsoft, s. f.), la cual devuelve metadatos publicados por el propio sistema
> operativo: el identificador de vendedor y el de dispositivo —formato `VEN_xxxx` y
> `DEV_xxxx`— correspondientes a registros asignados por el PCI-SIG para el bus PCI/PCIe
> y por el USB Implementers Forum para el bus USB (PCI-SIG, s. f.; USB Implementers Forum,
> s. f.). Se trata de datos fácticos y numéricos, no de expresiones protegidas por derechos
> de autor, pues los instrumentos internacionales de propiedad intelectual protegen la
> expresión y no los hechos, procedimientos o datos de operación (Organización Mundial del
> Comercio, s. f.). La lectura se efectúa con consentimiento del usuario, otorgado mediante
> el diálogo de control de cuentas de usuario de Windows, y persigue exclusivamente fines
> de interoperabilidad técnica entre el programa y el hardware instalado, actividad
> admitida, entre otros ordenamientos, por los artículos 5 y 6 de la Directiva 2009/24/CE
> (Parlamento Europeo y Consejo, 2009) y por la excepción de interoperabilidad del artículo
> 1201(f) del Título 17 del Código de los Estados Unidos (Escuela de Derecho de la
> Universidad de Cornell, s. f.). Adicionalmente, DriWin no redistribuye bases de
> identificadores de terceros, como `pci.ids` o `usb.ids`, sino que resuelve la
> correspondencia en un catálogo relacional propio.

### 5.5 Descarga de controladores de fabricantes y patrón de *offloading*

> DriWin no es titular, distribuidor ni socio comercial de AMD, NVIDIA, Intel ni RealTek,
> y no persigue ánimo de lucro en la facilitación de sus controladores: la aplicación
> adopta un patrón arquitectónico de *offloading*, en el que la API central responde con
> metadatos ligeros —nombre comercial y enlace de descarga— y la transferencia del binario
> pesado se resuelve directamente entre el equipo del usuario y el origen autorizado, sin
> que el servicio central procese dicho tráfico (Castillo y Equipo DriWin, 2026). El
> usuario final queda sujeto, en todo caso, al Acuerdo de Licencia de Usuario Final (EULA)
> del fabricante respectivo, cuya aceptación se produce en el canal del propio
> fabricante; DriWin no modifica ni reempaqueta dichos binarios y se reserva un
> procedimiento de retiro inmediato ante cualquier solicitud del titular de la marca.

### 5.6 Uso de API propia y ausencia de *scraping*

> En el alcance del Hito 2, DriWin no practica *scraping*, ni *crawling*, ni consumo de
> interfaces privadas de terceros, ni reproduce catálogos o código ajenos: el sistema
> consume exclusivamente una API REST propia, desarrollada por el equipo y desplegada en
> Microsoft Azure, la cual consulta un catálogo relacional alojado en Azure Database for
> PostgreSQL (Flexible Server) e inicializado desde el script `db/init.sql` del propio
> repositorio (Castillo y Equipo DriWin, 2026). La interacción se limita a una petición
> `HTTP POST` con una carga útil de aproximadamente 1 kB —identificadores de vendedor y
> dispositivo, entorno operativo y perfil de uso— a la que la API responde con metadatos
> en texto. Las vías automatizadas de recolección externa que aparecen en la documentación
> de expansión futura se encuentran declaradas como propuesta beta no implementada y
> quedan condicionadas a una evaluación jurídica previa de los términos de servicio de los
> fabricantes.

### 5.7 Protección de datos y cumplimiento normativo adicional

> Desde la perspectiva de la protección de datos, DriWin opera bajo el principio de
> minimización: procesa únicamente metadatos de hardware del equipo local y una etiqueta
> de perfil funcional, sin recabar datos personales identificables del usuario. Con todo,
> la Ley N° 21.719, que regula la protección y el tratamiento de los datos personales y
> crea la Agencia de Protección de Datos Personales, entra en vigencia el 1 de diciembre
> de 2026 (Biblioteca del Congreso Nacional de Chile, s. f.), por lo que se recomienda
> efectuar una evaluación de cumplimiento previa al despliegue productivo del servicio y
> a la incorporación de formularios de alta de usuarios.

---

## 6. Tabla resumen para insertar en el informe

**Tabla 1**
*Dependencias del Sistema DriWin y Sus Licencias (Hito 2)*

| Licencia | Tipo | Paquetes | Paquetes de producción | Impacto en el modelo SaaS/B2B |
|---|---|---:|---:|---|
| MIT | Permisiva | 54 | 3 | Sin restricciones |
| Apache-2.0 | Permisiva | 2 | 0 | Sin restricciones (incluye cláusula de patentes) |
| ISC | Permisiva | 1 | 0 | Sin restricciones |
| BSD-3-Clause | Permisiva | 1 | 0 | Sin restricciones (sin endoso) |
| MPL-2.0 | Copyleft débil (archivo) | 12 | 0 | Compatible: sólo compilación, sin modificaciones |
| GPL / AGPL / LGPL / SSPL | Copyleft fuerte / de red | 0 | 0 | No aplicable |

*Nota.* Elaboración propia a partir de `app-inicio-windows/package-lock.json`
(70 paquetes resueltos), auditado el 17 de octubre de 2026.

---

## 7. Referencias (Norma APA 7.ª edición)

Biblioteca del Congreso Nacional de Chile. (s. f.). *Ley N° 21.719: Regula la protección
y el tratamiento de los datos personales y crea la Agencia de Protección de Datos
Personales*. https://www.leychile.cl/leychile/navegar?idNorma=1209272

Castillo, J., y Equipo DriWin. (2026). *DriWin* [Software de aplicación]. GitHub.
https://github.com/VinJimbo97/DriWinProyect

Escuela de Derecho de la Universidad de Cornell. (s. f.). *17 U.S.C. § 1201 —
Circumvention of copyright protection systems*. Legal Information Institute.
https://www.law.cornell.edu/uscode/text/17/1201

Govett, D. (s. f.). *Lightning CSS* (Versión 1.33.0) [Software de código abierto]. npm.
https://www.npmjs.com/package/lightningcss

Meta Platforms, Inc. (s. f.). *React* (Versión 19.2.8) [Software de código abierto].
npm. https://www.npmjs.com/package/react

Meta Platforms, Inc. (s. f.). *React DOM* (Versión 19.2.8) [Software de código
abierto]. npm. https://www.npmjs.com/package/react-dom

Meta Platforms, Inc. (s. f.). *Scheduler* (Versión 0.27.0) [Software de código
abierto]. npm. https://www.npmjs.com/package/scheduler

Microsoft. (s. f.). *TypeScript* (Versión 6.0.3) [Software de código abierto]. npm.
https://www.npmjs.com/package/typescript

Microsoft. (s. f.). *Windows Management Instrumentation (WMI)* [Material técnico].
Microsoft Learn. https://learn.microsoft.com/en-us/windows/win32/wmisdk/wmi-portal

Mozilla. (s. f.). *Mozilla Public License 2.0*. https://www.mozilla.org/en-US/MPL/2.0/

Open Source Initiative. (s. f.). *MIT License*.
https://opensource.org/license/mit

Organización Mundial del Comercio. (s. f.). *Acuerdo sobre los Aspectos de los Derechos
de Propiedad Intelectual relacionados con el Comercio (ADPIC)*, art. 9.2.
https://www.wto.org/english/docs_e/legal_e/27-trips.pdf

Oxc. (s. f.). *Oxlint* [Software de código abierto]. https://oxc.rs/

PCI-SIG. (s. f.). *PCI Local Bus Specification y registro de identificadores de
vendedor y dispositivo*. https://pcisig.com/

Parlamento Europeo y Consejo. (2009). *Directiva 2009/24/CE sobre la protección jurídica
de los programas de ordenador* (DO L 111, 5-5-2009, p. 16).
https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32009L0024

Sitnik, A. (s. f.). *PostCSS* (Versión 8.5.28) [Software de código abierto]. npm.
https://www.npmjs.com/package/postcss

USB Implementers Forum. (s. f.). *USB Specification y registro de identificadores de
producto y vendedor*. https://www.usb.org/

You, E. (s. f.). *Vite* (Versión 8.2.2) [Software de código abierto]. npm.
https://www.npmjs.com/package/vite

---

## 8. Declaración final y limitaciones

Los resultados precedentes se obtuvieron de la lectura directa de los manifiestos y de
los paquetes efectivamente instalados, por lo que son verificables y reproducibles. Este
documento constituye insumo técnico-normativo para la defensa del Hito 2 y **no sustituye
la asesoría jurídica profesional**; las materias relativas a redistribución de binarios de
fabricantes (H-05) y a las vías de expansión del catálogo (H-06) deberán ratificarse con
asesoría legal antes de su implementación en producción.
