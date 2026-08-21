-- Migration: create_historial_mantenimiento_table.sql
-- Create Historial_Mantenimiento table to store workshop / maintenance records

CREATE TABLE IF NOT EXISTS historial_mantenimiento (
  id TEXT PRIMARY KEY,
  id_unidad TEXT,
  tipo_flota TEXT,
  nombre_taller TEXT,
  taller_ext TEXT,
  estatus TEXT,
  observaciones TEXT,
  marca TEXT,
  modelo TEXT,
  color TEXT,
  anio INTEGER,
  vin TEXT,
  tipo_vehiculo TEXT,
  avance INTEGER,
  foto_antes TEXT,
  foto_despues TEXT,
  fecha_ingreso TIMESTAMP WITH TIME ZONE,
  fecha_salida TIMESTAMP WITH TIME ZONE,
  gerencia TEXT,
  usuario TEXT,
  cargo_usuario TEXT,
  tareas JSONB,
  modificado_por TEXT,
  metadata JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_historial_updated_at ON historial_mantenimiento (updated_at);
CREATE INDEX IF NOT EXISTS idx_historial_id_unidad ON historial_mantenimiento (id_unidad);
CREATE INDEX IF NOT EXISTS idx_historial_fecha_ingreso ON historial_mantenimiento (fecha_ingreso);

-- Optional: GIN index for fast JSONB queries on tareas
CREATE INDEX IF NOT EXISTS idx_historial_tareas_gin ON historial_mantenimiento USING GIN (tareas);
