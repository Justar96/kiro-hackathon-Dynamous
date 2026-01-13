CREATE TYPE "public"."steelman_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "steelmans" (
	"id" text PRIMARY KEY NOT NULL,
	"debate_id" text NOT NULL,
	"round_number" integer NOT NULL,
	"author_id" text NOT NULL,
	"target_argument_id" text NOT NULL,
	"content" text NOT NULL,
	"status" "steelman_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "steelmans" ADD CONSTRAINT "steelmans_debate_id_debates_id_fk" FOREIGN KEY ("debate_id") REFERENCES "public"."debates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "steelmans" ADD CONSTRAINT "steelmans_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "steelmans" ADD CONSTRAINT "steelmans_target_argument_id_arguments_id_fk" FOREIGN KEY ("target_argument_id") REFERENCES "public"."arguments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
