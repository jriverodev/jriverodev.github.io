-- Migration: create_mantenimientos_table.sql
-- Create a simple mantenimientos table for TTOCC

CREATE TABLE IF NOT EXISTS mantenimientos (
  id TEXT PRIMARY KEY,
  id_unidad TEXT,
  marca TEXT,
  flota TEXT,
  nombre_taller TEXT,
  observaciones TEXT,
  foto_antes_url TEXT,
  foto_despues_url TEXT,
  datos JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index on updated_at for efficient sync queries
CREATE INDEX IF NOT EXISTS idx_mantenimientos_updated_at ON mantenimientos (updated_at);