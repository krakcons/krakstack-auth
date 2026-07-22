ALTER TABLE "organization" ADD COLUMN "user_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_userId_uidx" ON "organization" ("user_id");--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;