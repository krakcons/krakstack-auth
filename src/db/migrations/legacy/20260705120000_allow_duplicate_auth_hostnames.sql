DROP INDEX IF EXISTS "domains_hostname_uidx";

ALTER TABLE "domains" DROP CONSTRAINT IF EXISTS "domains_hostname_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "domains_hostname_rootHostname_uidx"
ON "domains" ("hostname", "root_hostname");
