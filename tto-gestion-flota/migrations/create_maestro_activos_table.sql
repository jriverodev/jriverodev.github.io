-- Migration: create_maestro_activos_table.sql
-- Create Maestro_Activos table to store fleet master data

CREATE TABLE IF NOT EXISTS maestro_activos (
  id_unidad TEXT PRIMARY KEY,
  placa TEXT,
  vin TEXT,
  marca TEXT,
  modelo TEXT,
  anio INTEGER,
  color TEXT,
  tipo_vehiculo TEXT,
  tipo_flota TEXT,
  estatus_final TEXT,
  situacion_actual TEXT,
  gerencia TEXT,
  responsable_usuario TEXT,
  cargo_usuario TEXT,
  ubicacion_taller TEXT,
  ubicacion_taller_fecha TIMESTAMP WITH TIME ZONE,
  documento_url TEXT,
  documento_nombre TEXT,
  metadata JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for efficient sync and lookups
CREATE INDEX IF NOT EXISTS idx_maestro_activos_updated_at ON maestro_activos (updated_at);
CREATE INDEX IF NOT EXISTS idx_maestro_activos_placa ON maestro_activos (placa);
CREATE INDEX IF NOT EXISTS idx_maestro_activos_gerencia ON maestro_activos (gerencia);
