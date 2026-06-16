CREATE TABLE "project" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"logo" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "project_slug_uidx" ON "project" USING btree ("slug");
--> statement-breakpoint
ALTER TABLE "oauth_client" ADD COLUMN "project_id" text;
--> statement-breakpoint
INSERT INTO "project" ("id", "name", "slug", "logo", "data", "created_at", "updated_at")
SELECT
	'project_' || "id",
	COALESCE(NULLIF("name", ''), "client_id"),
	"client_id",
	"icon",
	COALESCE("metadata", '{}'::jsonb),
	COALESCE("created_at", now()),
	COALESCE("updated_at", now())
FROM "oauth_client"
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
UPDATE "oauth_client"
SET "project_id" = 'project_' || "id",
	"metadata" = '{}'::jsonb
WHERE EXISTS (
	SELECT 1 FROM "project" WHERE "project"."id" = 'project_' || "oauth_client"."id"
);
--> statement-breakpoint
ALTER TABLE "oauth_client" ADD CONSTRAINT "oauth_client_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "oauthClient_projectId_idx" ON "oauth_client" USING btree ("project_id");
