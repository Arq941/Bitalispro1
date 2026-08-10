-- =============================================================================
-- FUNCIONES Y TRIGGERS DE SUPABASE / POSTGRESQL PARA CÁLCULO DE MOROSIDAD
-- Motor Financiero de Cobranza Bitalis Pro
-- =============================================================================

-- 1. FUNCIÓN RPC PARA RECALCULAR MOROSIDAD Y APLICAR CASCADA DE PAGOS POR VENTA
CREATE OR REPLACE FUNCTION calcular_morosidad_venta(
    p_venta_id INT,
    p_fecha_actual DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    venta_id INT,
    saldo_pendiente DECIMAL(10,2),
    dias_atraso INT,
    estado_morosidad VARCHAR(10),
    cuota_vencida_mas_antigua_fecha DATE,
    proxima_cuota_vencimiento DATE
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_monto_total_pagos DECIMAL(10,2) := 0.00;
    v_pozo DECIMAL(10,2) := 0.00;
    v_cuota RECORD;
    v_monto_falta DECIMAL(10,2);
    v_abono_aplicar DECIMAL(10,2);
    v_cuota_vencida_fecha DATE := NULL;
    v_dias_atraso INT := 0;
    v_estado_mora VARCHAR(10) := 'VERDE';
    v_saldo_total DECIMAL(10,2) := 0.00;
    v_proxima_fecha DATE := NULL;
BEGIN
    -- A) Calcular total pagado para la venta
    SELECT COALESCE(SUM(monto_recibido), 0.00)
    INTO v_monto_total_pagos
    FROM pagos
    WHERE pagos.venta_id = p_venta_id;

    v_pozo := v_monto_total_pagos;

    -- B) Reiniciar montos pagados de las cuotas
    UPDATE cuotas
    SET monto_pagado = 0.00,
        estado = 'pendiente'
    WHERE cuotas.venta_id = p_venta_id;

    -- C) Distribuir pagos en cascada cronológica por numero_cuota
    FOR v_cuota IN 
        SELECT id, monto_cuota, fecha_vencimiento
        FROM cuotas
        WHERE cuotas.venta_id = p_venta_id
        ORDER BY numero_cuota ASC
    LOOP
        IF v_pozo > 0 THEN
            v_monto_falta := v_cuota.monto_cuota;
            v_abono_aplicar := LEAST(v_pozo, v_monto_falta);

            UPDATE cuotas
            SET monto_pagado = v_abono_aplicar,
                estado = CASE
                    WHEN v_abono_aplicar >= v_cuota.monto_cuota THEN 'pagado'
                    WHEN v_abono_aplicar > 0 THEN CASE WHEN v_cuota.fecha_vencimiento < p_fecha_actual THEN 'vencido' ELSE 'parcial' END
                    ELSE CASE WHEN v_cuota.fecha_vencimiento < p_fecha_actual THEN 'vencido' ELSE 'pendiente' END
                END
            WHERE id = v_cuota.id;

            v_pozo := v_pozo - v_abono_aplicar;
        ELSE
            -- Si no queda pozo, evaluar si está vencida o pendiente
            UPDATE cuotas
            SET estado = CASE 
                WHEN fecha_vencimiento < p_fecha_actual THEN 'vencido'
                ELSE 'pendiente'
            END
            WHERE id = v_cuota.id;
        END IF;
    END LOOP;

    -- D) Identificar la cuota vencida sin cubrir más antigua
    SELECT fecha_vencimiento
    INTO v_cuota_vencida_fecha
    FROM cuotas
    WHERE cuotas.venta_id = p_venta_id
      AND fecha_vencimiento < p_fecha_actual
      AND monto_pagado < monto_cuota
    ORDER BY numero_cuota ASC, fecha_vencimiento ASC
    LIMIT 1;

    -- E) Calcular días de atraso si existe cuota vencida sin cubrir
    IF v_cuota_vencida_fecha IS NOT NULL THEN
        v_dias_atraso := p_fecha_actual - v_cuota_vencida_fecha;
    ELSE
        v_dias_atraso := 0;
    END IF;

    -- F) Determinar semáforo de morosidad
    IF v_dias_atraso >= 15 THEN
        v_estado_mora := 'ROJO';
    ELSIF v_dias_atraso >= 1 THEN
        v_estado_mora := 'AMARILLO';
    ELSE
        v_estado_mora := 'VERDE';
    END IF;

    -- G) Saldo pendiente total y próxima cuota pendiente
    SELECT COALESCE(SUM(monto_cuota - monto_pagado), 0.00)
    INTO v_saldo_total
    FROM cuotas
    WHERE cuotas.venta_id = p_venta_id;

    SELECT fecha_vencimiento
    INTO v_proxima_fecha
    FROM cuotas
    WHERE cuotas.venta_id = p_venta_id
      AND monto_pagado < monto_cuota
    ORDER BY numero_cuota ASC
    LIMIT 1;

    -- H) Actualizar cliente y venta vinculados
    UPDATE ventas
    SET saldo_pendiente = v_saldo_total
    WHERE id = p_venta_id;

    UPDATE clientes
    SET estado_morosidad = v_estado_mora::ENUM('VERDE','AMARILLO','ROJO')
    WHERE id = (SELECT cliente_id FROM ventas WHERE id = p_venta_id);

    -- Retornar resumen del cálculo
    RETURN QUERY
    SELECT 
        p_venta_id,
        v_saldo_total,
        v_dias_atraso,
        v_estado_mora,
        v_cuota_vencida_fecha,
        v_proxima_fecha;
END;
$$;
