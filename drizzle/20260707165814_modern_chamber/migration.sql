CREATE TABLE "project_organization" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_user" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "projectOrganization_projectId_organizationId_uidx" ON "project_organization" ("project_id","organization_id");--> statement-breakpoint
CREATE INDEX "projectOrganization_projectId_idx" ON "project_organization" ("project_id");--> statement-breakpoint
CREATE INDEX "projectOrganization_organizationId_idx" ON "project_organization" ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projectUser_projectId_userId_uidx" ON "project_user" ("project_id","user_id");--> statement-breakpoint
CREATE INDEX "projectUser_projectId_idx" ON "project_user" ("project_id");--> statement-breakpoint
CREATE INDEX "projectUser_userId_idx" ON "project_user" ("user_id");--> statement-breakpoint
ALTER TABLE "project_organization" ADD CONSTRAINT "project_organization_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_organization" ADD CONSTRAINT "project_organization_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_user" ADD CONSTRAINT "project_user_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_user" ADD CONSTRAINT "project_user_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;