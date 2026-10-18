-- Política aprobada: conservar solo la clave retirada, sin contenido de lectura.
BEGIN;
LOCK TABLE public.operacion_lectura IN ACCESS EXCLUSIVE MODE;
DO $migration$
DECLARE
    version_nueva BOOLEAN;
BEGIN
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
      AND table_name = 'operacion_lectura' AND column_name = 'retirada') INTO version_nueva;
    IF NOT version_nueva THEN
        IF (SELECT pg_get_constraintdef(oid) FROM pg_constraint
              WHERE conrelid = 'public.operacion_lectura'::regclass AND conname = 'ck_operacion_lectura_destino')
              IS DISTINCT FROM 'CHECK ((num_nonnulls(precinto_id, incidencia_id) = 1))'
           OR (SELECT pg_get_constraintdef(oid) FROM pg_constraint
              WHERE conrelid = 'public.operacion_lectura'::regclass AND conname = 'ck_operacion_lectura_solicitud')
              IS DISTINCT FROM 'CHECK ((jsonb_typeof(solicitud) = ''object''::text))' THEN
            RAISE EXCEPTION 'Definición previa incompatible con 004';
        END IF;
        ALTER TABLE public.operacion_lectura
            ADD COLUMN retirada BOOLEAN NOT NULL DEFAULT FALSE,
            ALTER COLUMN solicitud DROP NOT NULL,
            DROP CONSTRAINT ck_operacion_lectura_destino,
            DROP CONSTRAINT ck_operacion_lectura_solicitud;
        ALTER TABLE public.operacion_lectura
            ADD CONSTRAINT ck_operacion_lectura_destino CHECK (
                (retirada AND precinto_id IS NULL AND incidencia_id IS NULL AND solicitud IS NULL)
                OR (NOT retirada AND num_nonnulls(precinto_id, incidencia_id) = 1 AND solicitud IS NOT NULL)),
            ADD CONSTRAINT ck_operacion_lectura_solicitud CHECK (solicitud IS NULL OR jsonb_typeof(solicitud) = 'object');
    ELSE
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
             AND table_name = 'operacion_lectura' AND column_name = 'retirada' AND data_type = 'boolean'
             AND is_nullable = 'NO' AND column_default = 'false')
           OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
             AND table_name = 'operacion_lectura' AND column_name = 'solicitud' AND data_type = 'jsonb'
             AND is_nullable = 'YES' AND column_default IS NULL)
           OR (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.operacion_lectura'::regclass
             AND conname = 'ck_operacion_lectura_destino') IS DISTINCT FROM
             'CHECK (((retirada AND (precinto_id IS NULL) AND (incidencia_id IS NULL) AND (solicitud IS NULL)) OR ((NOT retirada) AND (num_nonnulls(precinto_id, incidencia_id) = 1) AND (solicitud IS NOT NULL))))'
           OR (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.operacion_lectura'::regclass
             AND conname = 'ck_operacion_lectura_solicitud') IS DISTINCT FROM
             'CHECK (((solicitud IS NULL) OR (jsonb_typeof(solicitud) = ''object''::text)))'
           OR EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.operacion_lectura'::regclass
             AND (NOT convalidated OR condeferrable)) THEN
            RAISE EXCEPTION 'Definición incompatible con 004';
        END IF;
        RAISE NOTICE 'Claves retiradas ya actualizadas; definición verificada';
    END IF;
    -- También verificar la protección de clave y las FK: no basta comprobar el nuevo flag.
    IF (SELECT array_agg(column_name || ':' || data_type || ':' || is_nullable || ':' || is_identity ORDER BY column_name)
          FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'operacion_lectura')
          IS DISTINCT FROM ARRAY['clave:uuid:NO:NO', 'entrega_id:integer:NO:NO', 'id:integer:NO:YES',
            'incidencia_id:integer:YES:NO', 'precinto_id:integer:YES:NO', 'retirada:boolean:NO:NO', 'solicitud:jsonb:YES:NO']
       OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'operacion_lectura'
          AND (is_generated <> 'NEVER' OR (column_name = 'id' AND identity_generation <> 'ALWAYS')
            OR (column_name <> 'retirada' AND column_default IS NOT NULL)))
       OR (SELECT array_agg(conname || ':' || pg_get_constraintdef(oid) ORDER BY conname) FROM pg_constraint
          WHERE conrelid = 'public.operacion_lectura'::regclass AND contype <> 'c') IS DISTINCT FROM ARRAY[
            'fk_operacion_lectura_entrega:FOREIGN KEY (entrega_id) REFERENCES entrega_farmacia_periodo(id) ON DELETE RESTRICT',
            'fk_operacion_lectura_incidencia:FOREIGN KEY (incidencia_id, entrega_id) REFERENCES incidencia(id, entrega_id) ON DELETE CASCADE',
            'fk_operacion_lectura_precinto:FOREIGN KEY (precinto_id, entrega_id) REFERENCES precinto(id, entrega_id) ON DELETE CASCADE',
            'pk_operacion_lectura:PRIMARY KEY (id)',
            'uq_operacion_lectura_clave:UNIQUE (entrega_id, clave)',
            'uq_operacion_lectura_incidencia:UNIQUE (incidencia_id)',
            'uq_operacion_lectura_precinto:UNIQUE (precinto_id)']
       OR (SELECT count(*) FROM pg_constraint WHERE conrelid = 'public.operacion_lectura'::regclass) <> 9
       OR EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.operacion_lectura'::regclass
          AND (NOT convalidated OR condeferrable)) THEN
        RAISE EXCEPTION 'Estructura o protección de clave incompatible con 004';
    END IF;
END;
$migration$;
COMMIT;
