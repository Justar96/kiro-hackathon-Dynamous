-- Media attachment type enum
CREATE TYPE "public"."media_attachment_type" AS ENUM('file', 'youtube', 'link');--> statement-breakpoint

-- Media attachments table
CREATE TABLE IF NOT EXISTS "media_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"argument_id" text NOT NULL,
	"type" "media_attachment_type" NOT NULL,
	"url" text NOT NULL,
	"thumbnail_url" text,
	"title" text,
	"description" text,
	"mime_type" text,
	"file_size" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Reputation factors table
CREATE TABLE IF NOT EXISTS "reputation_factors" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"impact_score_total" real DEFAULT 0 NOT NULL,
	"prediction_accuracy" real DEFAULT 50 NOT NULL,
	"participation_count" integer DEFAULT 0 NOT NULL,
	"quality_score" real DEFAULT 0 NOT NULL,
	"last_active_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Reputation history table
CREATE TABLE IF NOT EXISTS "reputation_history" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"previous_score" real NOT NULL,
	"new_score" real NOT NULL,
	"change_amount" real NOT NULL,
	"reason" text NOT NULL,
	"debate_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Add unique constraint on user_id for reputation_factors
CREATE UNIQUE INDEX IF NOT EXISTS "reputation_factors_user_id_idx" ON "reputation_factors" ("user_id");--> statement-breakpoint

-- Add index for reputation_history queries by user
CREATE INDEX IF NOT EXISTS "reputation_history_user_id_created_idx" ON "reputation_history" ("user_id", "created_at");--> statement-breakpoint

-- Foreign key constraint for media_attachments -> arguments (CASCADE delete)
DO $ BEGIN
 ALTER TABLE "media_attachments" ADD CONSTRAINT "media_attachments_argument_id_arguments_id_fk" FOREIGN KEY ("argument_id") REFERENCES "public"."arguments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $;--> statement-breakpoint

-- Foreign key constraint for reputation_factors -> users
DO $ BEGIN
 ALTER TABLE "reputation_factors" ADD CONSTRAINT "reputation_factors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $;--> statement-breakpoint

-- Foreign key constraint for reputation_history -> users
DO $ BEGIN
 ALTER TABLE "reputation_history" ADD CONSTRAINT "reputation_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $;--> statement-breakpoint

-- Foreign key constraint for reputation_history -> debates (optional)
DO $ BEGIN
 ALTER TABLE "reputation_history" ADD CONSTRAINT "reputation_history_debate_id_debates_id_fk" FOREIGN KEY ("debate_id") REFERENCES "public"."debates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $;
