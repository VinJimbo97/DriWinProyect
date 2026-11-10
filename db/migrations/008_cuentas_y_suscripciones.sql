-- ============================================================================
-- MIGRACIÓN 008 — CUENTAS DRIWIN Y SUSCRIPCIONES PREMIUM
-- Motor: PostgreSQL 16+ (driwin_catalog). Requiere la migración 007 (roles).
--
-- Modelo de negocio: DriWin Premium es SOLO suscripción, de 1, 2 o 3 años,
-- para hasta 3 equipos. La versión gratis no necesita cuenta; la cuenta se
-- crea al comprar Premium.
--
-- Datos personales (Ley 21.719) — se guarda lo mínimo:
--   * Correo: cifrado con AES-256-GCM (email_encrypted) + una huella HMAC-SHA256
--     (email_lookup) para buscar la cuenta sin descifrar. La clave vive en el
--     App Service (DATA_ENCRYPTION_KEY), nunca en la base ni en el código.
--   * Contraseña: solo su hash con scrypt (lento a propósito, con sal propia).
--   * Equipos: solo la huella SHA-256 de un identificador aleatorio que genera
--     la app. Sin nombre del PC, sin IP, sin datos del hardware.
--   * Sesiones: solo la huella SHA-256 del token.
--   * Soporte: el mensaje se guarda cifrado.
--   * "Borrar mis datos" elimina la cuenta, sus equipos, sesiones y consultas.
--     Las suscripciones quedan anónimas (account_id = NULL) como registro de
--     venta, sin ningún dato de la persona.
--
-- Idempotente: puede ejecutarse varias veces con el mismo resultado.
-- ============================================================================
BEGIN;

SET ROLE driwin_owner;

-- ----------------------------------------------------------------------------
-- 1. Planes: solo suscripción de 1, 2 o 3 años, hasta 3 equipos
-- ----------------------------------------------------------------------------
ALTER TABLE subscription_tiers ADD COLUMN IF NOT EXISTS duration_months INT;

INSERT INTO subscription_tiers
  (tier_name, target_persona, pricing_model, price_clp, max_devices, device_scope, description, duration_months)
VALUES
  ('DriWin Premium 1 año',  'Usuario final', 'Suscripción', 29990, 3, 'Hasta 3 equipos',
   'Instalar todo, limpieza de riesgo alto con respaldo, chequeo de salud y soporte técnico durante 12 meses.', 12),
  ('DriWin Premium 2 años', 'Usuario final', 'Suscripción', 57990, 3, 'Hasta 3 equipos',
   'Todas las funciones Premium durante 24 meses (ahorra $1.990 frente a renovar cada año).', 24),
  ('DriWin Premium 3 años', 'Usuario final', 'Suscripción', 84990, 3, 'Hasta 3 equipos',
   'Todas las funciones Premium durante 36 meses (ahorra $4.980 frente a renovar cada año).', 36)
ON CONFLICT (tier_name) DO UPDATE SET
  target_persona  = EXCLUDED.target_persona,
  pricing_model   = EXCLUDED.pricing_model,
  price_clp       = EXCLUDED.price_clp,
  max_devices     = EXCLUDED.max_devices,
  device_scope    = EXCLUDED.device_scope,
  description     = EXCLUDED.description,
  duration_months = EXCLUDED.duration_months;

-- Los usuarios sintéticos de los planes antiguos pasan a los nuevos (repartidos
-- por id) y con un máximo de 3 equipos.
UPDATE synthetic_users u
SET tier_id = t.tier_id,
    active_devices_count = LEAST(u.active_devices_count, 3)
FROM subscription_tiers t
WHERE u.tier_id IN (SELECT tier_id FROM subscription_tiers WHERE duration_months IS NULL)
  AND t.duration_months = 12 * (1 + (u.user_id % 3));

DELETE FROM subscription_tiers WHERE duration_months IS NULL;

ALTER TABLE subscription_tiers ALTER COLUMN duration_months SET NOT NULL;
ALTER TABLE subscription_tiers DROP CONSTRAINT IF EXISTS ck_tier_duration;
ALTER TABLE subscription_tiers ADD CONSTRAINT ck_tier_duration CHECK (duration_months IN (12, 24, 36));
CREATE UNIQUE INDEX IF NOT EXISTS ux_tier_duration ON subscription_tiers (duration_months);

-- ----------------------------------------------------------------------------
-- 2. Cuentas
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
    account_id      SERIAL PRIMARY KEY,
    email_lookup    BYTEA NOT NULL UNIQUE,      -- HMAC-SHA256 del correo normalizado
    email_encrypted BYTEA NOT NULL,             -- AES-256-GCM (iv + tag + texto cifrado)
    password_hash   TEXT NOT NULL,              -- scrypt$N$r$p$sal$hash
    failed_logins   INT NOT NULL DEFAULT 0,
    locked_until    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_account_lookup_len CHECK (octet_length(email_lookup) = 32),
    CONSTRAINT ck_account_failed CHECK (failed_logins >= 0)
);

-- Equipos donde se usa la cuenta (máximo 3, lo controla la API dentro de una transacción).
CREATE TABLE IF NOT EXISTS account_devices (
    device_id     SERIAL PRIMARY KEY,
    account_id    INT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    device_hash   BYTEA NOT NULL,               -- SHA-256 del identificador aleatorio del equipo
    registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ux_account_device UNIQUE (account_id, device_hash),
    CONSTRAINT ck_device_hash_len CHECK (octet_length(device_hash) = 32)
);

-- Sesiones de la app (token opaco; solo se guarda su huella).
CREATE TABLE IF NOT EXISTS account_sessions (
    session_id  SERIAL PRIMARY KEY,
    account_id  INT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    token_hash  BYTEA NOT NULL UNIQUE,
    device_hash BYTEA NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    CONSTRAINT ck_session_expiry CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS idx_sessions_account ON account_sessions (account_id);

-- Suscripciones compradas (pago simulado en esta versión).
CREATE TABLE IF NOT EXISTS subscriptions (
    subscription_id   SERIAL PRIMARY KEY,
    account_id        INT REFERENCES accounts(account_id) ON DELETE SET NULL,
    tier_id           INT NOT NULL REFERENCES subscription_tiers(tier_id) ON DELETE RESTRICT,
    starts_at         TIMESTAMPTZ NOT NULL,
    ends_at           TIMESTAMPTZ NOT NULL,
    price_paid_clp    NUMERIC(12,2) NOT NULL,
    payment_reference VARCHAR(40) NOT NULL UNIQUE,  -- 'SIM-...' = pago simulado
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_subscription_dates CHECK (ends_at > starts_at),
    CONSTRAINT ck_subscription_price CHECK (price_paid_clp >= 0)
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_account ON subscriptions (account_id, ends_at DESC);

-- Consultas al soporte técnico (función Premium).
CREATE TABLE IF NOT EXISTS support_tickets (
    ticket_id         SERIAL PRIMARY KEY,
    account_id        INT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    subject           VARCHAR(120) NOT NULL,
    message_encrypted BYTEA NOT NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'ABIERTA',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_ticket_status CHECK (status IN ('ABIERTA', 'RESPONDIDA', 'CERRADA'))
);
CREATE INDEX IF NOT EXISTS idx_tickets_account ON support_tickets (account_id);

RESET ROLE;

-- ----------------------------------------------------------------------------
-- 3. Permisos explícitos de la API (mínimo necesario)
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON accounts, account_devices, account_sessions TO driwin_api;
GRANT SELECT, INSERT ON subscriptions, support_tickets TO driwin_api;
GRANT USAGE ON SEQUENCE
  accounts_account_id_seq,
  account_devices_device_id_seq,
  account_sessions_session_id_seq,
  subscriptions_subscription_id_seq,
  support_tickets_ticket_id_seq
TO driwin_api;

-- Respaldos: las tablas nuevas ya quedan legibles por los permisos automáticos
-- de la 007; se repite por si la base no tenía esos permisos al crearlas.
GRANT SELECT ON accounts, account_devices, account_sessions, subscriptions, support_tickets TO driwin_backup;

-- Reportes: ventas por plan, sin datos de las personas.
SET ROLE driwin_owner;
CREATE OR REPLACE VIEW v_ventas_por_plan AS
SELECT
  t.tier_name                         AS plan,
  COUNT(s.subscription_id)            AS ventas,
  COALESCE(SUM(s.price_paid_clp), 0)  AS ingresos_clp,
  COUNT(*) FILTER (WHERE s.ends_at > now()) AS activas
FROM subscription_tiers t
LEFT JOIN subscriptions s ON s.tier_id = t.tier_id
GROUP BY t.tier_id, t.tier_name;
RESET ROLE;
GRANT SELECT ON v_ventas_por_plan TO driwin_reporting, driwin_backup;

COMMIT;
