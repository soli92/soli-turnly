-- Migration 0005: aggiungi tipi assenza MAT e ALT mancanti dal seed iniziale
-- Allinea absence_types con l'enum Zod (ferie/malattia/permesso/maternita-paternita/altro)

INSERT INTO "absence_types" ("name", "code", "paid_leave", "requires_approval")
VALUES
  ('Maternità/Paternità', 'MAT', true, true),
  ('Altro', 'ALT', false, true)
ON CONFLICT ("code") DO NOTHING;

-- down: DELETE FROM "absence_types" WHERE "code" IN ('MAT', 'ALT');
