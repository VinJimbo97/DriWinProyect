-- ============================================================================
-- MIGRACIÓN 011 — QUITAR EL ÍNDICE REDUNDANTE idx_hardware_lookup
-- Motor: PostgreSQL 16+ (driwin_catalog). Requiere 007 (roles).
--
-- Hallazgo del QA del Hito 3 (EXPLAIN ANALYZE, docs/qa/explain/):
--   * idx_hardware_lookup (ven_id, dev_id) repite el COMIENZO del índice que ya
--     crea la restricción uq_hardware_signature (ven_id, dev_id, subsys_id).
--     PostgreSQL usa ese prefijo para las mismas búsquedas.
--   * Experimento con 100.000 componentes: al quitarlo, las 2 consultas de la
--     API que buscan por (ven_id, dev_id) pasan a usar uq_hardware_signature con
--     el mismo tiempo (≈ 0,05–0,09 ms).
--   * Costo de mantenerlo: ~3 MB por cada 100.000 componentes y una escritura
--     extra en cada INSERT/UPDATE del catálogo, sin acelerar ninguna consulta.
--
-- Seguro de aplicar en caliente: la tabla es pequeña (el bloqueo dura
-- milisegundos) y la API no nombra el índice en ninguna consulta.
--
-- Idempotente: puede ejecutarse varias veces con el mismo resultado.
-- ============================================================================
BEGIN;

SET ROLE driwin_owner;

DROP INDEX IF EXISTS idx_hardware_lookup;

RESET ROLE;

COMMIT;
