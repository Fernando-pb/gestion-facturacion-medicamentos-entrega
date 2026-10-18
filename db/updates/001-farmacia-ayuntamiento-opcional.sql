-- Compatibilidad con farmacias sin Ayuntamiento. No modifica filas ni elimina la FK.
-- Aplicar a cada base existente antes de usar la versión compatible de la aplicación.
BEGIN;

ALTER TABLE farmacia ALTER COLUMN ayuntamiento_id DROP NOT NULL;

COMMIT;
