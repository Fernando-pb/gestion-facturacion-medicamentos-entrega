-- Añade snapshots históricos de farmacia y motivos aprobados de incidencia.
-- Si faltan snapshots, la tabla debe estar vacía; no se rellenan desde FARMACIA.
BEGIN;

LOCK TABLE public.entrega_farmacia_periodo, public.incidencia IN ACCESS EXCLUSIVE MODE;

DO $migration$
DECLARE
    columnas_snapshot INTEGER;
    columnas_compatibles INTEGER;
    entregas_existentes BIGINT;
    definicion_motivo TEXT;
    motivo_validado BOOLEAN;
    definicion_anterior CONSTANT TEXT :=
        '(motivo = ANY (ARRAY[''MEDICAMENTO_DESCONOCIDO''::text, ''MEDICAMENTO_NO_AUTORIZADO''::text]))';
    definicion_objetivo CONSTANT TEXT :=
        '(motivo = ANY (ARRAY[''MEDICAMENTO_DESCONOCIDO''::text, ''MEDICAMENTO_NO_AUTORIZADO''::text, ''MEDICAMENTO_INACTIVO''::text, ''BAJA_COMERCIAL_RECHAZADA_USUARIO''::text]))';
BEGIN
    SELECT count(*)::INTEGER,
           count(*) FILTER (
               WHERE data_type = 'text'
                 AND is_nullable = 'NO'
                 AND column_default IS NULL
                 AND is_generated = 'NEVER'
           )::INTEGER
      INTO columnas_snapshot, columnas_compatibles
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'entrega_farmacia_periodo'
       AND column_name IN ('denominacion_farmacia', 'cif_nif_farmacia');

    IF columnas_snapshot = 0 THEN
        SELECT count(*) INTO entregas_existentes
          FROM public.entrega_farmacia_periodo;

        IF entregas_existentes <> 0 THEN
            RAISE EXCEPTION
                'Actualización cancelada: entrega_farmacia_periodo contiene % filas y no se rellenarán snapshots históricos.',
                entregas_existentes;
        END IF;

        ALTER TABLE public.entrega_farmacia_periodo
            ADD COLUMN denominacion_farmacia TEXT NOT NULL,
            ADD COLUMN cif_nif_farmacia TEXT NOT NULL;
    ELSIF columnas_snapshot <> 2 OR columnas_compatibles <> 2 THEN
        RAISE EXCEPTION
            'Actualización cancelada: las columnas snapshot existen parcialmente o con tipo, NULL o DEFAULT inesperado.';
    ELSE
        RAISE NOTICE 'Snapshots ya actualizados: TEXT NOT NULL sin DEFAULT; definición verificada.';
    END IF;

    SELECT pg_get_expr(conbin, conrelid), convalidated
      INTO definicion_motivo, motivo_validado
      FROM pg_constraint
     WHERE conrelid = 'public.incidencia'::regclass
       AND conname = 'ck_incidencia_motivo'
       AND contype = 'c';

    IF motivo_validado IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Actualización cancelada: ck_incidencia_motivo falta o no está validado.';
    END IF;

    IF definicion_motivo = definicion_anterior THEN
        ALTER TABLE public.incidencia
            DROP CONSTRAINT ck_incidencia_motivo;
        ALTER TABLE public.incidencia
            ADD CONSTRAINT ck_incidencia_motivo
            CHECK (motivo IN (
                'MEDICAMENTO_DESCONOCIDO',
                'MEDICAMENTO_NO_AUTORIZADO',
                'MEDICAMENTO_INACTIVO',
                'BAJA_COMERCIAL_RECHAZADA_USUARIO'
            ));
    ELSIF definicion_motivo IS DISTINCT FROM definicion_objetivo THEN
        RAISE EXCEPTION
            'Actualización cancelada: ck_incidencia_motivo falta o tiene una definición no reconocida: %',
            coalesce(definicion_motivo, '<ausente>');
    ELSE
        RAISE NOTICE 'Motivos ya actualizados: los cuatro valores aprobados; definición verificada.';
    END IF;
END;
$migration$;

COMMIT;
