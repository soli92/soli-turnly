-- G-004/G-005: aggiungi phone e contract_type alla tabella users
-- up
ALTER TABLE "users" ADD COLUMN "phone" varchar(20);
ALTER TABLE "users" ADD COLUMN "contract_type" varchar(50);

-- down
-- ALTER TABLE "users" DROP COLUMN "contract_type";
-- ALTER TABLE "users" DROP COLUMN "phone";
