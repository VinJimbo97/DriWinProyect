-- ============================================================================
-- MIGRACIÓN 006 — INSTALACIÓN DE APPS CON WINGET
-- Motor: PostgreSQL 16 (driwin_catalog)
--
-- Las apps ya no se descargan desde nuestro Blob: la app de escritorio le pide
-- a winget (el instalador oficial de Windows) que las instale desde el sitio
-- del fabricante, con la huella que publica el repositorio de winget.
--   * winget_id    → identificador exacto en el repositorio "winget".
--   * official_url → para apps que no están en winget: se abre su página oficial.
-- Cada app debe tener al menos una de las dos.
--
-- La app de escritorio sólo acepta los identificadores y páginas de su lista
-- permitida (electron/appPolicy.ts), aunque la API diga otra cosa.
--
-- Aplicar ANTES de publicar la versión de server-api que lee estas columnas.
-- Idempotente: puede ejecutarse varias veces con el mismo resultado.
-- ============================================================================
BEGIN;

ALTER TABLE recommended_apps ADD COLUMN IF NOT EXISTS winget_id VARCHAR(100);
ALTER TABLE recommended_apps ADD COLUMN IF NOT EXISTS official_url TEXT;

UPDATE recommended_apps a
SET winget_id = v.winget_id, official_url = v.official_url
FROM (VALUES
  ('Steam',                'Valve.Steam',                       NULL),
  ('Epic Games Launcher',  'EpicGames.EpicGamesLauncher',       NULL),
  ('Discord',              'Discord.Discord',                   NULL),
  ('G-Helper',             'seerge.g-helper',                   NULL),
  ('Opera GX',             'Opera.OperaGX',                     NULL),
  ('Krita',                'KDE.Krita',                         NULL),
  ('Blender',              'BlenderFoundation.Blender',         NULL),
  ('Clip Studio Paint',    'Celsys.ClipStudioPaint',            NULL),
  ('MakeHuman',            NULL, 'https://static.makehumancommunity.org/makehuman.html'),
  ('DaVinci Resolve',      NULL, 'https://www.blackmagicdesign.com/products/davinciresolve'),
  ('Visual Studio Code',   'Microsoft.VisualStudioCode',        NULL),
  ('Git for Windows',      'Git.Git',                           NULL),
  ('Docker Desktop',       'Docker.DockerDesktop',              NULL),
  ('Postman',              'Postman.Postman',                   NULL),
  ('Node.js LTS',          'OpenJS.NodeJS.LTS',                 NULL),
  ('LibreOffice',          'TheDocumentFoundation.LibreOffice', NULL),
  ('7-Zip',                '7zip.7zip',                         NULL),
  ('Adobe Acrobat Reader', 'Adobe.Acrobat.Reader.64-bit',       NULL),
  ('VLC Media Player',     'VideoLAN.VLC',                      NULL),
  ('SumatraPDF',           'SumatraPDF.SumatraPDF',             NULL)
) AS v(app_name, winget_id, official_url)
WHERE a.app_name = v.app_name;

ALTER TABLE recommended_apps DROP CONSTRAINT IF EXISTS chk_app_winget_id;
ALTER TABLE recommended_apps ADD CONSTRAINT chk_app_winget_id
  CHECK (winget_id IS NULL OR winget_id ~ '^[A-Za-z0-9][A-Za-z0-9.+_-]{1,99}$');

ALTER TABLE recommended_apps DROP CONSTRAINT IF EXISTS chk_app_official_url;
ALTER TABLE recommended_apps ADD CONSTRAINT chk_app_official_url
  CHECK (official_url IS NULL OR official_url ~ '^https://[^\s]+$');

ALTER TABLE recommended_apps DROP CONSTRAINT IF EXISTS chk_app_install_source;
ALTER TABLE recommended_apps ADD CONSTRAINT chk_app_install_source
  CHECK (winget_id IS NOT NULL OR official_url IS NOT NULL);

COMMIT;
