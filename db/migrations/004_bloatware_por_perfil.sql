-- ============================================================================
-- MIGRACIÓN 004 — LIMPIEZA DE BLOATWARE REAL Y POR PERFIL
-- Motor: PostgreSQL 16 (driwin_catalog)
--
-- 1) bloatware_rules gana:
--      package_names : nombres EXACTOS de los paquetes de Microsoft Store
--                      (Get-AppxPackage -Name). La app de escritorio sólo
--                      elimina nombres que además estén en su propia lista
--                      permitida (electron/bloatwarePolicy.ts): la API nunca
--                      envía comandos para ejecutar.
--      help_text     : explicación en lenguaje simple para el botón "?".
-- 2) bloatware_profile_policy: qué hace cada perfil con cada regla
--      SUGERIDO  → aparece marcada
--      OPCIONAL  → aparece sin marcar
--      PROTEGIDO → no aparece (ese perfil la usa)
-- 3) Catálogo de 20 reglas de riesgo BAJO y MEDIO. Sólo apps de la Tienda,
--    quitadas para el usuario actual: todas se reinstalan desde la Store.
--
-- Aplicar ANTES de publicar la versión de server-api que lee estas columnas.
-- Idempotente: puede ejecutarse varias veces con el mismo resultado.
-- ============================================================================
BEGIN;

ALTER TABLE bloatware_rules ADD COLUMN IF NOT EXISTS package_names TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE bloatware_rules ADD COLUMN IF NOT EXISTS help_text TEXT NOT NULL DEFAULT '';

-- Nombre de paquete: letras, números, punto, guion, guion bajo y comodín *.
-- Sin comillas, espacios ni ; → no se puede inyectar nada en PowerShell.
ALTER TABLE bloatware_rules DROP CONSTRAINT IF EXISTS ck_bloatware_package_names;
ALTER TABLE bloatware_rules ADD CONSTRAINT ck_bloatware_package_names
  CHECK (array_to_string(package_names, ',') ~ '^([A-Za-z0-9][A-Za-z0-9._*-]{1,99}(,|$))*$');

CREATE TABLE IF NOT EXISTS bloatware_profile_policy (
    bloatware_id INT NOT NULL,
    profile_id INT NOT NULL,
    policy VARCHAR(10) NOT NULL,
    CONSTRAINT pk_bloatware_profile_policy PRIMARY KEY (bloatware_id, profile_id),
    CONSTRAINT ck_bloatware_policy CHECK (policy IN ('SUGERIDO', 'OPCIONAL', 'PROTEGIDO')),
    CONSTRAINT fk_bpp_rule
        FOREIGN KEY (bloatware_id) REFERENCES bloatware_rules(bloatware_id) ON DELETE CASCADE,
    CONSTRAINT fk_bpp_profile
        FOREIGN KEY (profile_id) REFERENCES user_profiles(profile_id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- Catálogo. Los comandos de detección/eliminación se derivan de package_names
-- (se guardan como documentación; la app de escritorio no los ejecuta).
-- ----------------------------------------------------------------------------
INSERT INTO bloatware_rules
  (app_display_name, package_signature, package_names, detection_powershell_cmd,
   removal_powershell_cmd, risk_level, description, help_text)
SELECT v.name, v.signature, v.packages,
       'Get-AppxPackage -Name ' || array_to_string(v.packages, ', ') || ' | Select-Object Name, Version, PackageFullName',
       'Get-AppxPackage -Name ' || array_to_string(v.packages, ', ') || ' | Remove-AppxPackage',
       v.risk, v.description, v.help
FROM (VALUES
  -- ===================== RIESGO BAJO =====================
  ('Microsoft Bing News & Weather', '*BingNews* / *BingWeather*',
   ARRAY['Microsoft.BingNews', 'Microsoft.BingWeather'], 'BAJO',
   'Apps de noticias y clima que se actualizan en segundo plano.',
   'Son las apps "Noticias" y "El tiempo" que trae Windows. Se conectan a internet en segundo plano para actualizar titulares y pronósticos. Si las quitas, el clima de la barra de tareas puede seguir apareciendo (es parte de Widgets) y siempre puedes verlo en el navegador.'),
  ('Microsoft Solitaire Collection & Casual Games', '*MicrosoftSolitaireCollection*',
   ARRAY['Microsoft.MicrosoftSolitaireCollection'], 'BAJO',
   'Juegos de cartas preinstalados con publicidad.',
   'Es la colección de Solitario, Spider y FreeCell que viene con Windows. Muestra anuncios y ocupa espacio. Quitarlo no afecta a ningún otro juego ni programa.'),
  ('Juegos promocionados (Candy Crush y similares)', 'king.com.*',
   ARRAY['king.com.*'], 'BAJO',
   'Juegos que Windows instala como publicidad.',
   'Windows instala por su cuenta algunos juegos como Candy Crush o Bubble Witch para promocionarlos. Si nunca los abriste, solo ocupan espacio en el menú Inicio. Quitarlos borra también tu progreso en esos juegos.'),
  ('Obtener ayuda y Consejos', '*GetHelp* / *Getstarted*',
   ARRAY['Microsoft.GetHelp', 'Microsoft.Getstarted'], 'BAJO',
   'Apps de tutoriales y asistencia de Microsoft.',
   '"Obtener ayuda" abre un chat de soporte de Microsoft y "Consejos" muestra tutoriales de Windows. Si no las usas, se pueden quitar: la ayuda sigue disponible en support.microsoft.com.'),
  ('Centro de opiniones', '*WindowsFeedbackHub*',
   ARRAY['Microsoft.WindowsFeedbackHub'], 'BAJO',
   'App para enviar comentarios a Microsoft.',
   'Sirve para enviar sugerencias o reportar errores a Microsoft. Quitarla no cambia cómo funciona Windows ni deja de enviar los datos de diagnóstico (eso se configura aparte).'),
  ('Mapas de Windows', '*WindowsMaps*',
   ARRAY['Microsoft.WindowsMaps'], 'BAJO',
   'App de mapas que descarga datos en segundo plano.',
   'Es la app de mapas de Microsoft. Puede descargar y actualizar mapas sin que lo notes. La mayoría usa Google Maps en el navegador; quitarla no afecta la ubicación de otras apps.'),
  ('Películas y TV', '*ZuneVideo*',
   ARRAY['Microsoft.ZuneVideo'], 'BAJO',
   'Reproductor y tienda de películas de Microsoft.',
   'Es el reproductor de video "Películas y TV". Si lo quitas, tus videos se abrirán con otro reproductor (por ejemplo VLC o el Reproductor multimedia). Las películas compradas en la tienda de Microsoft dejarán de verse aquí.'),
  ('Contactos y Skype', '*People* / *SkypeApp*',
   ARRAY['Microsoft.People', 'Microsoft.SkypeApp'], 'BAJO',
   'Agenda de contactos y Skype preinstalado.',
   '"Contactos" es una agenda que casi nadie usa y Skype es la app de videollamadas que Microsoft ya reemplazó por Teams. Si usas Skype para trabajar, desmárcalo.'),
  ('Visor 3D y Mixed Reality', '*Microsoft3DViewer* / *MixedReality.Portal*',
   ARRAY['Microsoft.Microsoft3DViewer', 'Microsoft.MixedReality.Portal'], 'BAJO',
   'Visor de modelos 3D y portal para lentes de realidad virtual.',
   'El Visor 3D abre modelos en 3D y el Portal de realidad mixta sirve para lentes de realidad virtual de Windows. Si no tienes lentes ni trabajas con modelos 3D, no los necesitas. (Vienen en Windows 10.)'),
  ('Clipchamp', '*Clipchamp*',
   ARRAY['Clipchamp.Clipchamp'], 'BAJO',
   'Editor de video básico de Microsoft.',
   'Clipchamp es un editor de video sencillo que trae Windows 11. Si editas video con otro programa (DaVinci, Premiere) o no editas, puedes quitarlo.'),
  ('Dev Home', '*Windows.DevHome*',
   ARRAY['Microsoft.Windows.DevHome'], 'BAJO',
   'Panel para programadores que Microsoft ya dejó de desarrollar.',
   'Dev Home es un panel para organizar proyectos de programación. Microsoft anunció que lo dejará de lado. Si no programas, no lo necesitas.'),
  -- ===================== RIESGO MEDIO =====================
  ('Xbox app y Game Bar', '*XboxGamingOverlay*',
   ARRAY['Microsoft.XboxGamingOverlay', 'Microsoft.GamingApp', 'Microsoft.XboxApp'], 'MEDIO',
   'App de Xbox y la barra de juegos (Win+G).',
   'La app de Xbox sirve para Game Pass y la Game Bar (Win+G) para grabar pantalla y ver el rendimiento al jugar. Si la quitas dejarán de funcionar Win+G, las grabaciones de Xbox y los juegos de Game Pass para PC. No afecta a Steam ni Epic Games.'),
  ('Copilot', '*Microsoft.Copilot*',
   ARRAY['Microsoft.Copilot'], 'MEDIO',
   'Asistente de inteligencia artificial de Microsoft.',
   'Copilot es el asistente con IA de Microsoft. Si no lo usas, quitarlo libera el botón y la app. Siempre puedes usarlo desde copilot.microsoft.com o reinstalarlo desde la Microsoft Store.'),
  ('Teams (personal)', '*MicrosoftTeams* / *MSTeams*',
   ARRAY['MicrosoftTeams', 'MSTeams'], 'MEDIO',
   'Chat y videollamadas de Microsoft Teams.',
   'Teams es la app de chat y videollamadas de Microsoft. Si tu colegio o trabajo lo usa para clases o reuniones, desmárcalo. Si no, se puede quitar y reinstalar cuando lo necesites.'),
  ('Outlook nuevo y Microsoft To Do', '*OutlookForWindows* / *Todos*',
   ARRAY['Microsoft.OutlookForWindows', 'Microsoft.Todos'], 'MEDIO',
   'Correo Outlook y lista de tareas To Do.',
   'Es el nuevo Outlook (correo y calendario) y la app de tareas To Do. Si revisas tu correo aquí o tienes tareas guardadas, desmárcalo. Tus correos y tareas viven en tu cuenta Microsoft, así que no se pierden al quitar las apps.'),
  ('App Microsoft 365 (Office)', '*MicrosoftOfficeHub*',
   ARRAY['Microsoft.MicrosoftOfficeHub'], 'MEDIO',
   'Acceso directo a Office que promociona la suscripción.',
   'Esta app es solo un acceso directo que promociona Microsoft 365. Quitarla NO desinstala Word, Excel ni PowerPoint si los tienes instalados.'),
  ('Vincular teléfono (Phone Link)', '*YourPhone*',
   ARRAY['Microsoft.YourPhone'], 'MEDIO',
   'Conecta tu celular para ver mensajes y fotos en el PC.',
   'Phone Link conecta tu celular para ver notificaciones, mensajes y fotos en el computador. Si nunca lo configuraste, puedes quitarlo. Si lo usas a diario, desmárcalo.'),
  ('Power Automate', '*PowerAutomateDesktop*',
   ARRAY['Microsoft.PowerAutomateDesktop'], 'MEDIO',
   'Herramienta para automatizar tareas repetitivas.',
   'Power Automate permite crear "robots" que repiten tareas en el PC (copiar datos, abrir programas). Si no creaste ninguna automatización, puedes quitarlo.'),
  ('Asistencia rápida (Quick Assist)', '*QuickAssist*',
   ARRAY['MicrosoftCorporationII.QuickAssist'], 'MEDIO',
   'Permite que alguien te ayude conectándose a tu PC.',
   'Asistencia rápida permite que un técnico o familiar vea y controle tu pantalla para ayudarte. Si nadie te da soporte remoto, puedes quitarla; si tu empresa la usa, desmárcala.'),
  ('Reproductor multimedia', '*ZuneMusic*',
   ARRAY['Microsoft.ZuneMusic'], 'MEDIO',
   'Reproductor de música y video por defecto de Windows.',
   'Es el reproductor que abre tu música y videos por defecto. Si lo quitas, necesitarás otro reproductor (por ejemplo VLC). Tus archivos de música no se borran.')
) AS v(name, signature, packages, risk, description, help)
ON CONFLICT (package_signature) DO UPDATE SET
  app_display_name         = EXCLUDED.app_display_name,
  package_names            = EXCLUDED.package_names,
  detection_powershell_cmd = EXCLUDED.detection_powershell_cmd,
  removal_powershell_cmd   = EXCLUDED.removal_powershell_cmd,
  risk_level               = EXCLUDED.risk_level,
  description              = EXCLUDED.description,
  help_text                = EXCLUDED.help_text;

-- ----------------------------------------------------------------------------
-- Política por perfil (S = SUGERIDO, O = OPCIONAL, P = PROTEGIDO)
-- ----------------------------------------------------------------------------
INSERT INTO bloatware_profile_policy (bloatware_id, profile_id, policy)
SELECT r.bloatware_id, p.profile_id,
       CASE x.code WHEN 'S' THEN 'SUGERIDO' WHEN 'O' THEN 'OPCIONAL' ELSE 'PROTEGIDO' END
FROM (VALUES
  --  package_signature                                   Gamer Developer Creator Office
  ('*BingNews* / *BingWeather*',                          'S', 'S', 'S', 'S'),
  ('*MicrosoftSolitaireCollection*',                      'S', 'S', 'S', 'S'),
  ('king.com.*',                                          'S', 'S', 'S', 'S'),
  ('*GetHelp* / *Getstarted*',                            'S', 'S', 'S', 'S'),
  ('*WindowsFeedbackHub*',                                'S', 'S', 'S', 'S'),
  ('*WindowsMaps*',                                       'S', 'S', 'S', 'S'),
  ('*ZuneVideo*',                                         'S', 'S', 'O', 'S'),
  ('*People* / *SkypeApp*',                               'S', 'S', 'S', 'O'),
  ('*Microsoft3DViewer* / *MixedReality.Portal*',         'S', 'S', 'O', 'S'),
  ('*Clipchamp*',                                         'S', 'S', 'P', 'S'),
  ('*Windows.DevHome*',                                   'S', 'P', 'S', 'S'),
  ('*XboxGamingOverlay*',                                 'P', 'O', 'O', 'S'),
  ('*Microsoft.Copilot*',                                 'O', 'O', 'O', 'O'),
  ('*MicrosoftTeams* / *MSTeams*',                        'S', 'O', 'S', 'P'),
  ('*OutlookForWindows* / *Todos*',                       'O', 'O', 'O', 'P'),
  ('*MicrosoftOfficeHub*',                                'S', 'O', 'O', 'P'),
  ('*YourPhone*',                                         'O', 'O', 'O', 'O'),
  ('*PowerAutomateDesktop*',                              'S', 'P', 'S', 'O'),
  ('*QuickAssist*',                                       'O', 'O', 'O', 'P'),
  ('*ZuneMusic*',                                         'O', 'O', 'P', 'O')
) AS v(signature, gamer, developer, creator, office)
CROSS JOIN LATERAL (VALUES
  ('Gamer', v.gamer), ('Developer', v.developer), ('Creator', v.creator), ('Office', v.office)
) AS x(profile_name, code)
INNER JOIN bloatware_rules r ON r.package_signature = v.signature
INNER JOIN user_profiles p   ON p.profile_name      = x.profile_name
ON CONFLICT (bloatware_id, profile_id) DO UPDATE SET policy = EXCLUDED.policy;

COMMIT;
