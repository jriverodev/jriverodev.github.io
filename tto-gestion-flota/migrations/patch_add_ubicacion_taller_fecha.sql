-- Migration: patch_add_ubicacion_taller_fecha.sql
-- Add ubicacion_taller_fecha column to maestro_activos if missing

ALTER TABLE IF EXISTS maestro_activos
  ADD COLUMN IF NOT EXISTS ubicacion_taller_fecha TIMESTAMP WITH TIME ZONE;

-- Optionally update existing rows with a default value if you want to backfill from historial_mantenimiento
-- Example (uncomment to run with care):
-- UPDATE maestro_activos m
-- SET ubicacion_taller_fecha = h.fecha_ingreso::timestamptz
-- FROM historial_mantenimiento h
-- WHERE m.id_unidad = h.unidad
-- ORDER BY h.fecha_ingreso DESC
-- LIMIT 1; -- Note: this is illustrative; adapt to your SQL dialect and needs
