DROP INDEX IF EXISTS "project_slug_uidx";
--> statement-breakpoint
ALTER TABLE "project" DROP COLUMN IF EXISTS "slug";
