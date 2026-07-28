ALTER TABLE "organization" ADD COLUMN "parent_id" text;--> statement-breakpoint
CREATE INDEX "organization_parentId_idx" ON "organization" ("parent_id");--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_parent_id_organization_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "organization"("id") ON DELETE SET NULL;