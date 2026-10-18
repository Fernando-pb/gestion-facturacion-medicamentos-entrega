-- Referencia histórica: valor conservado al migrar, sin atribuirlo al catálogo original.
BEGIN;
LOCK TABLE public.precinto IN ACCESS EXCLUSIVE MODE;
DO $migration$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'precinto' AND column_name = 'precio_referencia') THEN
        ALTER TABLE public.precinto ADD COLUMN precio_referencia NUMERIC(12,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'precinto' AND column_name = 'precio_referencia'
          AND data_type = 'numeric' AND numeric_precision = 12 AND numeric_scale = 2
          AND column_default IS NULL AND is_generated = 'NEVER') THEN
        RAISE EXCEPTION 'precio_referencia incompatible con 005';
    END IF;
    -- Solo los valores ausentes: una repetición nunca sustituye una referencia ya conservada.
    UPDATE public.precinto SET precio_referencia = precio_aplicado WHERE precio_referencia IS NULL;
    IF EXISTS (SELECT 1 FROM public.precinto WHERE precio_referencia IS NULL OR precio_referencia < 0) THEN
        RAISE EXCEPTION 'Hay lecturas sin referencia válida; no activar correcciones';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.precinto'::regclass
        AND conname = 'ck_precinto_precio_referencia') THEN
        IF (SELECT pg_get_constraintdef(oid) FROM pg_constraint
            WHERE conrelid = 'public.precinto'::regclass AND conname = 'ck_precinto_precio_referencia')
            IS DISTINCT FROM 'CHECK ((precio_referencia >= (0)::numeric))' THEN
            RAISE EXCEPTION 'CHECK de precio_referencia incompatible con 005';
        END IF;
        ALTER TABLE public.precinto VALIDATE CONSTRAINT ck_precinto_precio_referencia;
    ELSE
        ALTER TABLE public.precinto ADD CONSTRAINT ck_precinto_precio_referencia CHECK (precio_referencia >= 0);
    END IF;
    ALTER TABLE public.precinto ALTER COLUMN precio_referencia SET NOT NULL;
END
$migration$;
COMMIT;
