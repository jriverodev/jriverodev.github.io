-- Migration: enable_rls_policies.sql
-- Habilita RLS y crea políticas para permitir lectura/escritura anónima y autenticada en Supabase

-- 1. Habilitar RLS en las tablas
ALTER TABLE IF EXISTS maestro_activos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS historial_mantenimiento ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas existentes para evitar duplicados
DROP POLICY IF EXISTS "Permitir lectura publica maestro_activos" ON maestro_activos;
DROP POLICY IF EXISTS "Permitir escritura publica maestro_activos" ON maestro_activos;
DROP POLICY IF EXISTS "Permitir lectura publica historial_mantenimiento" ON historial_mantenimiento;
DROP POLICY IF EXISTS "Permitir escritura publica historial_mantenimiento" ON historial_mantenimiento;

-- 3. Crear políticas para maestro_activos (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Permitir lectura publica maestro_activos"
  ON maestro_activos FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Permitir escritura publica maestro_activos"
  ON maestro_activos FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Crear políticas para historial_mantenimiento (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Permitir lectura publica historial_mantenimiento"
  ON historial_mantenimiento FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Permitir escritura publica historial_mantenimiento"
  ON historial_mantenimiento FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Políticas de Storage para el bucket ttocc-archivos (si existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
    EXECUTE '
      DROP POLICY IF EXISTS "Permitir acceso publico a ttocc-archivos" ON storage.objects;
      CREATE POLICY "Permitir acceso publico a ttocc-archivos"
        ON storage.objects FOR ALL
        TO anon, authenticated
        USING (bucket_id = ''ttocc-archivos'')
        WITH CHECK (bucket_id = ''ttocc-archivos'');
    ';
  END IF;
END $$;
