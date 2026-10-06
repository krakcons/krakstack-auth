ALTER TABLE "domains" ADD COLUMN "managed" boolean DEFAULT true NOT NULL;

UPDATE "domains"
SET
  "managed" = false,
  "active" = true,
  "hostname_id" = regexp_replace("hostname_id", '^(external|local):', '')
WHERE "hostname_id" LIKE 'external:%' OR "hostname_id" LIKE 'local:%';
