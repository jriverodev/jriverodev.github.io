-- Migration: fix_rls_infinite_recursion.sql
-- Solución al error 42P17: infinite recursion detected in policy for relation "usuarios"

-- 1. Crear función SECURITY DEFINER para obtener organizacion_id del usuario sin desencadenar recursión en RLS
CREATE OR REPLACE FUNCTION public.get_user_org_id(p_user_id text)
RETURNS uuid AS $$
DECLARE
    v_org_id uuid;
BEGIN
    SELECT organizacion_id INTO v_org_id
    FROM public.usuarios
    WHERE id::text = p_user_id
    LIMIT 1;

    RETURN v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Actualizar políticas de RLS utilizando get_user_org_id() y permitiendo acceso de respaldo si auth.uid() es NULL (modo anon / API cliente)
ALTER TABLE "public"."organizaciones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."usuarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."maestro_activos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."historial_mantenimiento" ENABLE ROW LEVEL SECURITY;

-- Política para Organizaciones
DROP POLICY IF EXISTS "Aislamiento Org en Organizaciones" ON "public"."organizaciones";
CREATE POLICY "Aislamiento Org en Organizaciones" ON "public"."organizaciones" FOR ALL USING (
    auth.uid() IS NULL OR id = public.get_user_org_id(auth.uid()::text)
);

-- Política para Roles
DROP POLICY IF EXISTS "Aislamiento Org en Roles" ON "public"."roles";
CREATE POLICY "Aislamiento Org en Roles" ON "public"."roles" FOR ALL USING (
    auth.uid() IS NULL OR organizacion_id = public.get_user_org_id(auth.uid()::text)
);

-- Política para Usuarios
DROP POLICY IF EXISTS "Aislamiento Org en Usuarios" ON "public"."usuarios";
CREATE POLICY "Aislamiento Org en Usuarios" ON "public"."usuarios" FOR ALL USING (
    auth.uid() IS NULL OR id::text = auth.uid()::text OR organizacion_id = public.get_user_org_id(auth.uid()::text)
);

-- Política para Maestro Activos
DROP POLICY IF EXISTS "Aislamiento Org en Maestro Activos" ON "public"."maestro_activos";
CREATE POLICY "Aislamiento Org en Maestro Activos" ON "public"."maestro_activos" FOR ALL USING (
    auth.uid() IS NULL OR organizacion_id = public.get_user_org_id(auth.uid()::text)
);

-- Política para Historial Mantenimiento
DROP POLICY IF EXISTS "Aislamiento Org en Historial" ON "public"."historial_mantenimiento";
CREATE POLICY "Aislamiento Org en Historial" ON "public"."historial_mantenimiento" FOR ALL USING (
    auth.uid() IS NULL OR organizacion_id = public.get_user_org_id(auth.uid()::text)
);
