-- Migration: fix_validar_acceso_usuario_rpc.sql
-- Solución al error 42804: Returned type character varying does not match expected type text in column 3.

CREATE OR REPLACE FUNCTION public.validar_acceso_usuario(p_usuario_id TEXT)
RETURNS TABLE (permitido BOOLEAN, mensaje TEXT, organizacion_nombre TEXT) AS $$
DECLARE
    v_usuario_activo BOOLEAN;
    v_org_activa BOOLEAN;
    v_org_pago VARCHAR;
    v_fecha_venc TIMESTAMPTZ;
    v_nombre_org VARCHAR;
BEGIN
    SELECT
        u.activo, o.activo, o.estado_pago, o.fecha_vencimiento, o.nombre
    INTO
        v_usuario_activo, v_org_activa, v_org_pago, v_fecha_venc, v_nombre_org
    FROM public.usuarios u
    JOIN public.organizaciones o ON u.organizacion_id = o.id
    WHERE u.id::text = p_usuario_id;

    IF v_usuario_activo IS NOT TRUE THEN
        RETURN QUERY SELECT FALSE, 'Su cuenta de usuario no está activa o requiere autorización.'::TEXT, NULL::TEXT;
        RETURN;
    END IF;

    IF v_org_activa IS NOT TRUE THEN
        RETURN QUERY SELECT FALSE, 'La organización se encuentra inactiva o suspendida.'::TEXT, v_nombre_org::TEXT;
        RETURN;
    END IF;

    IF v_org_pago = 'SUSPENDIDO' THEN
        RETURN QUERY SELECT FALSE, 'El plan de la organización se encuentra suspendido.'::TEXT, v_nombre_org::TEXT;
        RETURN;
    ELSIF v_fecha_venc IS NOT NULL AND v_fecha_venc < NOW() THEN
        RETURN QUERY SELECT FALSE, 'El periodo de prueba o suscripción ha vencido.'::TEXT, v_nombre_org::TEXT;
        RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, 'Acceso concedido.'::TEXT, v_nombre_org::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
