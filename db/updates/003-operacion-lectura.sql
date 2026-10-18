-- Protección persistente por entrega/UUID sin rellenar lecturas anteriores.
BEGIN;
LOCK TABLE public.entrega_farmacia_periodo, public.precinto, public.incidencia IN ACCESS EXCLUSIVE MODE;

DO $migration$
DECLARE
    tabla TEXT;
    nombre TEXT;
    definicion TEXT;
BEGIN
    FOREACH tabla IN ARRAY ARRAY['precinto', 'incidencia'] LOOP
        nombre := 'uq_' || tabla || '_id_entrega';
        SELECT pg_get_constraintdef(oid) INTO definicion FROM pg_constraint
          WHERE conrelid = format('public.%I', tabla)::regclass AND conname = nombre;
        IF definicion IS NULL THEN
            EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE (id, entrega_id)', tabla, nombre);
        ELSIF definicion <> 'UNIQUE (id, entrega_id)' THEN
            RAISE EXCEPTION 'Definición incompatible: %', nombre;
        END IF;
    END LOOP;

    IF to_regclass('public.operacion_lectura') IS NULL THEN
        CREATE TABLE public.operacion_lectura (
            id INTEGER GENERATED ALWAYS AS IDENTITY,
            entrega_id INTEGER NOT NULL,
            clave UUID NOT NULL,
            solicitud JSONB NOT NULL,
            precinto_id INTEGER,
            incidencia_id INTEGER,
            CONSTRAINT pk_operacion_lectura PRIMARY KEY (id),
            CONSTRAINT uq_operacion_lectura_clave UNIQUE (entrega_id, clave),
            CONSTRAINT uq_operacion_lectura_precinto UNIQUE (precinto_id),
            CONSTRAINT uq_operacion_lectura_incidencia UNIQUE (incidencia_id),
            CONSTRAINT ck_operacion_lectura_destino CHECK (num_nonnulls(precinto_id, incidencia_id) = 1),
            CONSTRAINT ck_operacion_lectura_solicitud CHECK (jsonb_typeof(solicitud) = 'object'),
            CONSTRAINT fk_operacion_lectura_entrega FOREIGN KEY (entrega_id)
                REFERENCES public.entrega_farmacia_periodo (id) ON DELETE RESTRICT,
            CONSTRAINT fk_operacion_lectura_precinto FOREIGN KEY (precinto_id, entrega_id)
                REFERENCES public.precinto (id, entrega_id) ON DELETE CASCADE,
            CONSTRAINT fk_operacion_lectura_incidencia FOREIGN KEY (incidencia_id, entrega_id)
                REFERENCES public.incidencia (id, entrega_id) ON DELETE CASCADE
        );
    ELSE
        LOCK TABLE public.operacion_lectura IN ACCESS EXCLUSIVE MODE;
        IF (SELECT array_agg(column_name || ':' || data_type || ':' || is_nullable || ':' || is_identity
                     ORDER BY ordinal_position)
              FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'operacion_lectura')
            IS DISTINCT FROM ARRAY['id:integer:NO:YES', 'entrega_id:integer:NO:NO', 'clave:uuid:NO:NO',
                'solicitud:jsonb:NO:NO', 'precinto_id:integer:YES:NO', 'incidencia_id:integer:YES:NO']
            OR EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'operacion_lectura'
                  AND (column_default IS NOT NULL OR is_generated <> 'NEVER'
                    OR (column_name = 'id' AND identity_generation <> 'ALWAYS'))) THEN
            RAISE EXCEPTION 'Columnas incompatibles de operacion_lectura';
        END IF;
        IF (SELECT array_agg(conname || ':' || pg_get_constraintdef(oid) ORDER BY conname)
              FROM pg_constraint WHERE conrelid = 'public.operacion_lectura'::regclass)
           IS DISTINCT FROM ARRAY[
             'ck_operacion_lectura_destino:CHECK ((num_nonnulls(precinto_id, incidencia_id) = 1))',
             'ck_operacion_lectura_solicitud:CHECK ((jsonb_typeof(solicitud) = ''object''::text))',
             'fk_operacion_lectura_entrega:FOREIGN KEY (entrega_id) REFERENCES entrega_farmacia_periodo(id) ON DELETE RESTRICT',
             'fk_operacion_lectura_incidencia:FOREIGN KEY (incidencia_id, entrega_id) REFERENCES incidencia(id, entrega_id) ON DELETE CASCADE',
             'fk_operacion_lectura_precinto:FOREIGN KEY (precinto_id, entrega_id) REFERENCES precinto(id, entrega_id) ON DELETE CASCADE',
             'pk_operacion_lectura:PRIMARY KEY (id)',
             'uq_operacion_lectura_clave:UNIQUE (entrega_id, clave)',
             'uq_operacion_lectura_incidencia:UNIQUE (incidencia_id)',
             'uq_operacion_lectura_precinto:UNIQUE (precinto_id)']
           OR EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.operacion_lectura'::regclass
             AND (NOT convalidated OR condeferrable)) THEN
            RAISE EXCEPTION 'Restricciones incompatibles de operacion_lectura';
        END IF;
        RAISE NOTICE 'operacion_lectura ya actualizada; definición verificada';
    END IF;
END;
$migration$;
COMMIT;
