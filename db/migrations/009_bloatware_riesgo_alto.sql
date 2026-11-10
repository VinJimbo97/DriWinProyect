-- ============================================================================
-- MIGRACIÓN 009 — BLOATWARE DE RIESGO ALTO (FUNCIÓN PREMIUM)
-- Motor: PostgreSQL 16+ (driwin_catalog). Requiere 004 y 007.
--
-- Apps de la Microsoft Store que Windows trae y que SÍ se pueden quitar, pero
-- que mucha gente usa sin saberlo (Fotos, Recortes, Calculadora...). Por eso:
--   * Son de riesgo ALTO: nunca vienen marcadas (OPCIONAL) y cada perfil
--     protege (oculta) las que necesita.
--   * En la app sólo se desbloquean con DriWin Premium, y antes de quitarlas
--     DriWin crea un punto de restauración de Windows.
--   * Igual que las demás: sólo para el usuario actual y se reinstalan desde
--     la Microsoft Store.
--
-- Fuera a propósito (nunca se ofrecen): Microsoft Store, Instalador de
-- aplicación (winget, lo usa DriWin), Edge, WebView2, Defender y Windows Update.
--
-- Idempotente: puede ejecutarse varias veces con el mismo resultado.
-- ============================================================================
BEGIN;

SET ROLE driwin_owner;

INSERT INTO bloatware_rules
  (app_display_name, package_signature, package_names, detection_powershell_cmd,
   removal_powershell_cmd, risk_level, description, help_text)
SELECT v.name, v.signature, v.packages,
       'Get-AppxPackage -Name ' || array_to_string(v.packages, ', ') || ' | Select-Object Name, Version, PackageFullName',
       'Get-AppxPackage -Name ' || array_to_string(v.packages, ', ') || ' | Remove-AppxPackage',
       'ALTO', v.description, v.help
FROM (VALUES
  ('Inicio de sesión de Xbox en juegos', '*XboxIdentityProvider* / *Xbox.TCUI*',
   ARRAY['Microsoft.XboxIdentityProvider', 'Microsoft.Xbox.TCUI'],
   'Permite que los juegos inicien sesión con tu cuenta Xbox.',
   'Muchos juegos de PC (Forza, Minecraft, Halo, Game Pass) usan esto para iniciar sesión y guardar tu progreso en la nube. Si lo quitas, esos juegos pueden dejar de abrir o no guardar logros. Solo quítalo si no juegas nada de Microsoft o Xbox.'),
  ('Fotos', '*Windows.Photos*',
   ARRAY['Microsoft.Windows.Photos'],
   'Visor de imágenes por defecto de Windows.',
   'Es la app que abre tus fotos al hacer doble clic. Si la quitas, tus fotos NO se borran, pero Windows te pedirá elegir otro programa para abrirlas (por ejemplo IrfanView o el navegador).'),
  ('Cámara', '*WindowsCamera*',
   ARRAY['Microsoft.WindowsCamera'],
   'App para tomar fotos y videos con la cámara web.',
   'Sirve para usar la cámara web fuera de Zoom, Teams o Meet. Quitarla no afecta a esas apps de videollamada, que usan la cámara directamente. Si solo usas la cámara en videollamadas, puedes quitarla.'),
  ('Recortes (captura de pantalla)', '*ScreenSketch*',
   ARRAY['Microsoft.ScreenSketch'],
   'Herramienta de capturas de pantalla (Win + Shift + S).',
   'Es la herramienta que se abre con Win + Shift + S o con la tecla Imprimir pantalla. Si la quitas, ese atajo deja de funcionar y necesitarás otro programa de capturas (por ejemplo ShareX o Greenshot).'),
  ('Paint', '*Microsoft.Paint*',
   ARRAY['Microsoft.Paint'],
   'Editor de imágenes simple de Windows.',
   'Es el Paint clásico para recortar, pintar o pegar imágenes. Si usas otro editor (Krita, GIMP, Photoshop) probablemente no lo necesitas.'),
  ('Calculadora', '*WindowsCalculator*',
   ARRAY['Microsoft.WindowsCalculator'],
   'Calculadora de Windows.',
   'Es la calculadora que se abre desde el menú Inicio o con la tecla de calculadora del teclado. Si la quitas, esa tecla deja de funcionar. Casi todos la usan alguna vez: quítala solo si tienes otra.'),
  ('Bloc de notas', '*WindowsNotepad*',
   ARRAY['Microsoft.WindowsNotepad'],
   'Editor de texto simple por defecto de Windows.',
   'Abre los archivos .txt y muchos archivos de configuración. Si lo quitas, Windows te pedirá otro programa para abrirlos (por ejemplo Notepad++ o VS Code).'),
  ('Terminal de Windows', '*WindowsTerminal*',
   ARRAY['Microsoft.WindowsTerminal'],
   'Consola moderna para PowerShell y CMD.',
   'En Windows 11 es la ventana donde se abren PowerShell y CMD. Si la quitas, se usará la consola clásica, que también funciona. Si programas, déjala.'),
  ('Notas rápidas (Sticky Notes)', '*MicrosoftStickyNotes*',
   ARRAY['Microsoft.MicrosoftStickyNotes'],
   'Notas adhesivas en el escritorio.',
   'Son las notas amarillas del escritorio. Si las usas, tus notas se guardan en tu cuenta Microsoft; si inicias sesión sin cuenta Microsoft, quitar la app puede borrarlas. Revisa que no tengas notas importantes.'),
  ('Widgets (noticias, clima)', '*Client.WebExperience*',
   ARRAY['MicrosoftWindows.Client.WebExperience'],
   'Panel de Widgets de la barra de tareas.',
   'Es el panel de noticias, clima y bolsa que aparece al pasar el mouse por la esquina de la barra de tareas. Consume memoria e internet en segundo plano. Si lo quitas, el clima de la barra de tareas desaparece.')
) AS v(name, signature, packages, description, help)
ON CONFLICT (package_signature) DO UPDATE SET
  app_display_name         = EXCLUDED.app_display_name,
  package_names            = EXCLUDED.package_names,
  detection_powershell_cmd = EXCLUDED.detection_powershell_cmd,
  removal_powershell_cmd   = EXCLUDED.removal_powershell_cmd,
  risk_level               = EXCLUDED.risk_level,
  description              = EXCLUDED.description,
  help_text                = EXCLUDED.help_text;

-- Política por perfil (O = OPCIONAL, P = PROTEGIDO). Ninguna viene marcada.
INSERT INTO bloatware_profile_policy (bloatware_id, profile_id, policy)
SELECT r.bloatware_id, p.profile_id,
       CASE x.code WHEN 'O' THEN 'OPCIONAL' ELSE 'PROTEGIDO' END
FROM (VALUES
  --  package_signature                          Gamer Developer Creator Office
  ('*XboxIdentityProvider* / *Xbox.TCUI*',        'P', 'O', 'O', 'O'),
  ('*Windows.Photos*',                            'O', 'O', 'P', 'O'),
  ('*WindowsCamera*',                             'O', 'O', 'O', 'P'),
  ('*ScreenSketch*',                              'O', 'P', 'P', 'P'),
  ('*Microsoft.Paint*',                           'O', 'O', 'P', 'O'),
  ('*WindowsCalculator*',                         'O', 'O', 'O', 'P'),
  ('*WindowsNotepad*',                            'O', 'P', 'O', 'O'),
  ('*WindowsTerminal*',                           'O', 'P', 'O', 'O'),
  ('*MicrosoftStickyNotes*',                      'O', 'O', 'O', 'P'),
  ('*Client.WebExperience*',                      'O', 'O', 'O', 'O')
) AS v(signature, gamer, developer, creator, office)
CROSS JOIN LATERAL (VALUES
  ('Gamer', v.gamer), ('Developer', v.developer), ('Creator', v.creator), ('Office', v.office)
) AS x(profile_name, code)
INNER JOIN bloatware_rules r ON r.package_signature = v.signature
INNER JOIN user_profiles p   ON p.profile_name      = x.profile_name
ON CONFLICT (bloatware_id, profile_id) DO UPDATE SET policy = EXCLUDED.policy;

RESET ROLE;

COMMIT;
