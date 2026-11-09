-- ============================================================================
-- MIGRACIÓN 007 — ROLES CON MÍNIMO PRIVILEGIO
-- Motor: PostgreSQL 16 (driwin_catalog)
--
-- Antes de esta migración la API se conectaba con driwin_admin, el
-- administrador del servidor ("modo dios"). Desde ahora cada uso tiene su rol:
--
--   driwin_admin      DBA (administrador de Azure). Solo personas, para
--                     mantener el servidor. Nunca lo usa una aplicación.
--   driwin_owner      Dueño de las tablas. Sin inicio de sesión: el DBA lo usa
--                     con SET ROLE para aplicar migraciones (crear y modificar
--                     tablas), sin privilegios sobre el resto del servidor.
--   driwin_backup     Respaldos: solo lectura de todas las tablas.
--   driwin_api        La API (App Service). Lee el catálogo y escribe solo las
--                     tablas que administra. No puede crear ni borrar tablas,
--                     ni leer los usuarios sintéticos (tienen correos).
--   driwin_reporting  Reportes de gestión: solo vistas con totales, sin
--                     acceso a las tablas ni a datos personales.
--
-- Los usuarios finales NO tienen cuenta en la base de datos: usan la app,
-- que pasa por la API (validación, límite de peticiones y CORS).
--
-- CONTRASEÑAS: este archivo no contiene ninguna. Los roles con inicio de
-- sesión quedan sin contraseña (no pueden entrar) hasta que el DBA la asigna
-- en psql con:  \password driwin_api   (no queda en el historial ni en Git).
--
-- Para futuras migraciones: ejecutar  SET ROLE driwin_owner;  al inicio, para
-- que las tablas nuevas queden a nombre del dueño, y dar los GRANT a driwin_api
-- de forma explícita (no hay permisos automáticos para la API).
--
-- Base nueva: ejecutar init.sql y después esta migración.
-- Idempotente: puede ejecutarse varias veces con el mismo resultado.
-- ============================================================================
BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Roles
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'driwin_owner') THEN
    CREATE ROLE driwin_owner NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'driwin_api') THEN
    CREATE ROLE driwin_api LOGIN CONNECTION LIMIT 20;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'driwin_backup') THEN
    CREATE ROLE driwin_backup LOGIN CONNECTION LIMIT 2;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'driwin_reporting') THEN
    CREATE ROLE driwin_reporting LOGIN CONNECTION LIMIT 5;
  END IF;
END $$;

-- El DBA puede actuar como dueño (SET ROLE driwin_owner) para las migraciones.
GRANT driwin_owner TO CURRENT_USER;

-- ----------------------------------------------------------------------------
-- 2. Nadie entra ni crea objetos por defecto
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO driwin_owner, driwin_api, driwin_backup, driwin_reporting',
                 current_database());
END $$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO driwin_owner;
GRANT USAGE ON SCHEMA public TO driwin_api, driwin_backup, driwin_reporting;

-- ----------------------------------------------------------------------------
-- 3. Las tablas y vistas pasan a ser del dueño (no del administrador)
--    Las secuencias SERIAL cambian de dueño junto con su tabla.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  obj record;
BEGIN
  FOR obj IN
    SELECT c.relname, c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v')
      AND pg_get_userbyid(c.relowner) <> 'driwin_owner'
  LOOP
    IF obj.relkind = 'v' THEN
      EXECUTE format('ALTER VIEW public.%I OWNER TO driwin_owner', obj.relname);
    ELSE
      EXECUTE format('ALTER TABLE public.%I OWNER TO driwin_owner', obj.relname);
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 4. API: lee el catálogo y escribe solo lo que administra
-- ----------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM driwin_api;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM driwin_api;

GRANT SELECT ON
  user_profiles,
  hardware_components,
  driver_packages,
  recommended_apps,
  profile_apps,
  bloatware_rules,
  bloatware_profile_policy,
  subscription_tiers
TO driwin_api;

-- Catálogo que se administra por la API (POST/PUT/DELETE con clave de escritura).
GRANT INSERT, UPDATE, DELETE ON hardware_components, driver_packages, bloatware_rules TO driwin_api;
GRANT USAGE ON SEQUENCE
  hardware_components_component_id_seq,
  driver_packages_driver_id_seq,
  bloatware_rules_bloatware_id_seq
TO driwin_api;

-- synthetic_users: sin ningún permiso para la API (contiene correos).

-- ----------------------------------------------------------------------------
-- 5. Respaldos: solo lectura de todo, también de las tablas futuras
-- ----------------------------------------------------------------------------
GRANT SELECT ON ALL TABLES IN SCHEMA public TO driwin_backup;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO driwin_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE driwin_owner IN SCHEMA public GRANT SELECT ON TABLES TO driwin_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE driwin_owner IN SCHEMA public GRANT SELECT ON SEQUENCES TO driwin_backup;

-- ----------------------------------------------------------------------------
-- 6. Reportes: solo vistas con totales (sin nombres ni correos)
-- ----------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM driwin_reporting;

SET ROLE driwin_owner;

CREATE OR REPLACE VIEW v_resumen_planes AS
SELECT
  t.tier_name           AS plan,
  t.pricing_model       AS modelo_cobro,
  t.price_clp           AS precio_clp,
  COUNT(u.user_id)      AS usuarios,
  COALESCE(SUM(u.active_devices_count), 0) AS equipos_activos
FROM subscription_tiers t
LEFT JOIN synthetic_users u ON u.tier_id = t.tier_id
GROUP BY t.tier_id, t.tier_name, t.pricing_model, t.price_clp;

CREATE OR REPLACE VIEW v_catalogo_por_perfil AS
SELECT
  p.profile_name AS perfil,
  (SELECT COUNT(*) FROM driver_packages d WHERE d.profile_id = p.profile_id) AS drivers,
  (SELECT COUNT(*) FROM profile_apps pa WHERE pa.profile_id = p.profile_id)  AS apps
FROM user_profiles p;

RESET ROLE;

GRANT SELECT ON v_resumen_planes, v_catalogo_por_perfil TO driwin_reporting;
GRANT SELECT ON v_resumen_planes, v_catalogo_por_perfil TO driwin_backup;

COMMIT;
