-- Migration: idx_maestro_activos_anio.sql
-- Create index on maestro_activos(anio) to speed up year-based queries

CREATE INDEX IF NOT EXISTS idx_maestro_activos_anio ON maestro_activos (anio);
