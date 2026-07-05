ALTER TABLE "domains" DROP CONSTRAINT IF EXISTS "domains_hostname_key";--> statement-breakpoint
ALTER TABLE "domains" DROP CONSTRAINT IF EXISTS "domains_hostname_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "domains_hostname_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "domains_hostname_rootHostname_uidx" ON "domains" ("hostname", "root_hostname");
