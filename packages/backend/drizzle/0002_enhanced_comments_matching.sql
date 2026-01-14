-- Comment reaction type enum
CREATE TYPE "public"."comment_reaction_type" AS ENUM('support', 'oppose');--> statement-breakpoint

-- Notification type enum
CREATE TYPE "public"."notification_type" AS ENUM('opponent_joined', 'debate_started', 'your_turn');--> statement-breakpoint

-- Comment reactions table
CREATE TABLE IF NOT EXISTS "comment_reactions" (
	"id" text PRIMARY KEY NOT NULL,
	"comment_id" text NOT NULL,
	"user_id" text NOT NULL,
	"type" "comment_reaction_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Notifications table
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"message" text NOT NULL,
	"debate_id" text,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Add soft delete column to comments table
ALTER TABLE "comments" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint

-- Add unique index on (commentId, userId, type) for comment_reactions
CREATE UNIQUE INDEX IF NOT EXISTS "comment_reactions_comment_user_type_idx" ON "comment_reactions" ("comment_id", "user_id", "type");--> statement-breakpoint

-- Add index on (userId, read, createdAt) for notifications
CREATE INDEX IF NOT EXISTS "notifications_user_read_created_idx" ON "notifications" ("user_id", "read", "created_at");--> statement-breakpoint

-- Foreign key constraints for comment_reactions
DO $$ BEGIN
 ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- Foreign key constraints for notifications
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_debate_id_debates_id_fk" FOREIGN KEY ("debate_id") REFERENCES "public"."debates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
