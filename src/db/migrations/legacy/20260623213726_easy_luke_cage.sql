CREATE TABLE "domains" (
	"id" text PRIMARY KEY,
	"hostname" text NOT NULL UNIQUE,
	"root_hostname" text NOT NULL,
	"project_id" text,
	"organization_id" text,
	"hostname_id" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "domains_hostname_uidx" ON "domains" ("hostname");--> statement-breakpoint
CREATE INDEX "domains_projectId_idx" ON "domains" ("project_id");--> statement-breakpoint
CREATE INDEX "domains_organizationId_idx" ON "domains" ("organization_id");--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE SET NULL;--> statement-breakpoint
