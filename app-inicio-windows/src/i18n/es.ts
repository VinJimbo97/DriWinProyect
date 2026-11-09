/**
 * Textos de la interfaz en español (idioma base).
 * Cada clave debe existir también en en.ts (lo revisa i18n.test.ts).
 * Los textos que vienen del catálogo (nombres de drivers, descripciones del
 * bloatware) llegan desde la base de datos y no se traducen aquí.
 */
export const es = {
  // Comunes
  'common.retry': 'Reintentar',
  'common.cancel': 'Cancelar',
  'common.loadingServer': 'Cargando desde el servidor...',
  'common.errorCode': 'Código: {code}',

  // Barra superior
  'tabs.driwin': 'DriWin',
  'tabs.apps': 'Apps',
  'tabs.optimize': 'Optimizar Windows',
  'bar.settings': 'Configuración',
  'bar.premium': 'Premium',
  'bar.premiumTitle': 'DriWin Premium',
  'window.minimize': 'Minimizar',
  'window.maximize': 'Maximizar',
  'window.close': 'Cerrar',
  'window.closingBrowser': 'Cerrando DriWin...',

  // Perfiles
  'profile.standard': 'Usuario Estándar',
  'profile.Gamer.label': 'Gamer',
  'profile.Gamer.title': '🎮 Uso este equipo para jugar (Gamer)',
  'profile.Gamer.hint': 'Prioridad a drivers Game Ready y baja latencia',
  'profile.Developer.label': 'Desarrollador',
  'profile.Developer.title': '💻 Uso este equipo para programar (Desarrollador)',
  'profile.Developer.hint': 'Drivers de virtualización y puertos seriales COM/UART',
  'profile.Creator.label': 'Creador',
  'profile.Creator.title': '🎨 Apps de Edición e Ilustración (Creador)',
  'profile.Creator.hint': 'Drivers NVIDIA Studio y perfiles de color estables',
  'profile.Office.label': 'Oficinista',
  'profile.Office.title': '🏢 Máxima Seguridad y Estabilidad (Oficinista)',
  'profile.Office.hint': 'Drivers WHQL certificados y ahorro energético',

  // Cuestionario
  'quiz.title': 'Cuestionario de Perfil',
  'quiz.scanDone': '● Hardware escaneado',
  'quiz.scanning': '○ Escaneando IDs VEN/DEV...',
  'quiz.intro': 'Selecciona las actividades prioritarias de tu equipo para sugerir los controladores ideales:',
  'quiz.confirm': 'Confirmar y Entrar a DriWin',

  // Pestaña DriWin (drivers)
  'drivers.currentTitle': 'Drivers Actuales',
  'drivers.scanning': 'Escaneando IDs VEN/DEV del equipo...',
  'drivers.installedVersion': 'Versión instalada: {version}',
  'drivers.updateTitle': 'Drivers a Actualizar',
  'drivers.byProfile': 'Según tu perfil: {profile}',
  'drivers.needQuiz': 'Completa el cuestionario de perfil para ver los drivers recomendados.',
  'drivers.waitingScan': 'Esperando el escaneo de hardware...',
  'drivers.notCataloged': 'Hardware no catalogado en DriWin',
  'drivers.noDriver': 'Sin driver publicado para tu perfil o versión de Windows',
  'drivers.profileLine': 'Perfil {profile} · {size} MB',
  'drivers.install': 'Instalar',
  'drivers.upToDate': '✓ Al día',
  'drivers.installAgain': 'Instalar de nuevo',
  'drivers.downloading': 'Descargando...',
  'drivers.downloadingPercent': 'Descargando {percent}%',
  'drivers.verifying': 'Verificando...',
  'drivers.installerOpen': 'Instalador abierto...',
  'drivers.noteInstalling': 'Acepta el permiso de Windows y sigue los pasos en la ventana del instalador.',
  'drivers.noteReboot': 'Reinicia el equipo para terminar la instalación.',
  'drivers.noteDone': 'El instalador terminó. Si lo cancelaste, tu driver sigue igual.',
  'drivers.noteDesktopOnly': 'La instalación solo está disponible en la app de escritorio, con el equipo real.',
  'drivers.notePendingVerification': 'Pendiente de verificación de seguridad.',
  'drivers.noteUnknownVersion': 'No se pudo comparar con tu versión instalada; revísala antes de instalar.',

  // Pestaña Apps
  'apps.title': 'Instalador de Software',
  'apps.subtitle': 'Aplicaciones recomendadas para tu entorno configurado ({profile}):',
  'apps.needQuiz': 'Completa el cuestionario de perfil para ver aplicaciones recomendadas.',
  'apps.count': '{count} aplicaciones · se descargan desde el sitio oficial de cada fabricante',
  'apps.checkingSuffix': ' · revisando cuáles ya tienes...',
  'apps.install': 'Instalar',
  'apps.officialSite': 'Sitio oficial ↗',
  'apps.noteNotInWinget': 'No está en winget: se descarga desde su página oficial.',
  'apps.notAvailable': 'No disponible',
  'apps.noteUnsupported': 'Esta versión de DriWin no instala esta app.',
  'apps.installing': 'Instalando...',
  'apps.noteFollowInstaller': 'Sigue los pasos en la ventana del instalador.',
  'apps.installed': '✓ Instalada',
  'apps.noteReboot': 'Reinicia el equipo para terminar la instalación.',
  'apps.checking': 'Revisando...',
  'apps.noteDesktopOnly': 'La instalación solo está disponible en la app de escritorio.',
  'apps.viaWinget': '{category} · vía winget',
  'apps.viaOfficial': '{category} · sitio oficial',

  // Pestaña Optimizar Windows (bloatware)
  'bloat.title': 'Limpieza de Bloatware',
  'bloat.byProfile': 'Según tu perfil: {profile}',
  'bloat.infoBefore':
    'DriWin solo quita apps de Microsoft Store para tu usuario, sin tocar el registro ni los servicios de Windows. Todas se pueden volver a instalar desde la Store. Pasa el mouse sobre',
  'bloat.infoAfter': 'para ver qué hace cada una.',
  'bloat.detecting': 'Buscando qué apps tienes instaladas...',
  'bloat.detectError': 'No se pudo revisar el equipo: {message}',
  'bloat.browserCatalog':
    'Estás viendo el catálogo completo: en el navegador no se puede revisar el equipo. La limpieza solo funciona en la app de escritorio.',
  'bloat.nothingToClean': '✓ Tu equipo no tiene ninguna de las apps de esta lista. No hay nada que limpiar.',
  'bloat.notInstalled': '{count} opciones del catálogo no están instaladas en tu equipo.',
  'bloat.hiddenByProfile': '{count} se ocultaron porque tu perfil las usa.',
  'bloat.running': 'Quitando apps... no cierres DriWin.',
  'bloat.doneSummary': 'Listo: {removed} quitadas.',
  'bloat.doneSummaryFailed': 'Listo: {removed} quitadas · {failed} no se pudieron quitar.',
  'bloat.selectedCount': '{count} seleccionadas',
  'bloat.cleaning': 'Limpiando...',
  'bloat.runCleanup': 'Ejecutar limpieza',
  'bloat.confirmTitleOne': '¿Quitar 1 app?',
  'bloat.confirmTitleMany': '¿Quitar {count} apps?',
  'bloat.confirmText':
    'Se quitarán solo para tu usuario. Si después necesitas alguna, la puedes volver a instalar desde Microsoft Store.',
  'bloat.confirmYes': 'Sí, quitar',
  'bloat.updateToRemove': 'Actualiza DriWin para poder quitar esta app.',
  'bloat.removed': '✓ Quitada',
  'bloat.risk.BAJO': 'Riesgo bajo',
  'bloat.risk.MEDIO': 'Riesgo medio',
  'bloat.risk.ALTO': 'Riesgo alto',
  'bloat.riskHelp.BAJO': 'Casi nadie la usa. Se puede volver a instalar desde Microsoft Store.',
  'bloat.riskHelp.MEDIO': 'Revisa si la usas antes de quitarla. Se puede volver a instalar desde Microsoft Store.',
  'bloat.riskHelp.ALTO': 'Puede afectar el funcionamiento de Windows.',
  'help.whatIs': '¿Qué es {title}?',

  // Configuración
  'settings.title': 'Configuración',
  'settings.section.general': 'General',
  'settings.section.profile': 'Perfil',
  'settings.section.premium': 'Premium',
  'settings.section.advanced': 'Avanzado',
  'settings.language': 'Idioma',
  'settings.languageHint': 'Idioma de la interfaz de DriWin.',
  'settings.language.es': 'Español',
  'settings.language.en': 'English',
  'settings.languageNote':
    'Los nombres y descripciones del catálogo (drivers, apps y bloatware) y los mensajes del servidor se muestran en español.',
  'settings.theme': 'Apariencia',
  'settings.themeHint': 'Colores de la app.',
  'settings.theme.system': 'Igual que Windows',
  'settings.theme.dark': 'Oscuro',
  'settings.theme.light': 'Claro',
  'settings.activeProfile': 'Perfil activo',
  'settings.adminNote': 'DriWin pide permisos de administrador solo al instalar, con el aviso de Windows.',
  'settings.retakeQuiz': 'Volver a hacer el cuestionario',
  'settings.scanSource': 'Origen del escaneo de hardware',
  'settings.scanSourceDesktop':
    'En la app de escritorio se lee el hardware real; los equipos simulados sirven para probar otros escenarios.',
  'settings.scanSourceBrowser':
    'En el navegador no se puede leer el hardware: se usan equipos simulados (Hardware Mock Fixture).',

  // Configuración → Premium
  'settings.premium.statusTitle': 'Tu plan',
  'settings.premium.statusFree': 'Gratis',
  'settings.premium.statusActive': 'DriWin Premium',
  'settings.premium.freeNote': 'Estas funciones se pueden activar o desactivar cuando tengas DriWin Premium.',
  'settings.premium.activeNote': 'Activa solo las funciones que quieras usar.',
  'settings.premium.seePlans': 'Ver planes',
  'settings.premium.locked': 'Requiere Premium',
  'settings.premium.group.install': 'Instalación',
  'settings.premium.group.optimize': 'Optimizar Windows',
  'settings.premium.group.health': 'Chequeo de salud',
  'premium.feature.installAll': 'Instalar todo',
  'premium.feature.installAll.desc':
    'Pone en cola todos los drivers y apps recomendados. Windows pide permiso una sola vez al inicio y los instaladores se abren uno tras otro.',
  'premium.feature.highRiskCleanup': 'Limpieza de riesgo alto con respaldo',
  'premium.feature.highRiskCleanup.desc':
    'Permite quitar bloatware de riesgo alto, solo después de crear un punto de restauración de Windows.',
  'premium.feature.driverBackup': 'Respaldo de drivers',
  'premium.feature.driverBackup.desc': 'Guarda una copia de tus drivers actuales en una carpeta antes de instalar otros.',
  'premium.feature.removeGhostDevices': 'Quitar dispositivos desconectados',
  'premium.feature.removeGhostDevices.desc':
    'Borra de Windows los dispositivos que ya no están conectados. Si los vuelves a conectar, reaparecen.',
  'premium.feature.removeOldDrivers': 'Quitar versiones antiguas de drivers',
  'premium.feature.removeOldDrivers.desc':
    'Elimina copias viejas de un driver cuando ya tienes instalada una versión más nueva del mismo.',
  'premium.feature.startupDriverCheck': 'Revisar drivers al iniciar Windows',
  'premium.feature.startupDriverCheck.desc':
    'Al encender el equipo, DriWin revisa si hay drivers nuevos y te avisa. No instala nada sin tu aprobación.',

  // Pestaña Premium (planes)
  'premium.title': '👑 DriWin Premium',
  'premium.subtitle': 'Una suscripción para dejar tu PC listo más rápido y mantenerlo sano. Úsala en hasta 3 equipos.',
  'premium.includes': 'Incluye',
  'premium.includes.support': 'Soporte técnico por formulario',
  'premium.includes.devices': 'Hasta 3 equipos con la misma cuenta',
  'premium.plan.years1': '1 año',
  'premium.plan.years2': '2 años',
  'premium.plan.years3': '3 años',
  'premium.plan.perMonth': 'equivale a {price} al mes',
  'premium.plan.save': 'Ahorras {price}',
  'premium.plan.popular': 'Más elegido',
  'premium.plan.soon': 'Disponible pronto',
  'premium.plan.soonNote': 'La compra y la cuenta DriWin se habilitan en la próxima versión.',
} as const;

export type MessageKey = keyof typeof es;
