CREATE SCHEMA "neon_auth";
--> statement-breakpoint
CREATE TYPE "public"."debate_status" AS ENUM('active', 'concluded');--> statement-breakpoint
CREATE TYPE "public"."direction" AS ENUM('support', 'oppose');--> statement-breakpoint
CREATE TYPE "public"."reaction_type" AS ENUM('agree', 'strong_reasoning');--> statement-breakpoint
CREATE TYPE "public"."round_type" AS ENUM('opening', 'rebuttal', 'closing');--> statement-breakpoint
CREATE TYPE "public"."side" AS ENUM('support', 'oppose');--> statement-breakpoint
CREATE TYPE "public"."stance_type" AS ENUM('pre', 'post');--> statement-breakpoint
CREATE TYPE "public"."turn" AS ENUM('support', 'oppose');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "arguments" (
	"id" text PRIMARY KEY NOT NULL,
	"round_id" text NOT NULL,
	"debater_id" text NOT NULL,
	"side" "side" NOT NULL,
	"content" text NOT NULL,
	"impact_score" real DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"debate_id" text NOT NULL,
	"user_id" text NOT NULL,
	"parent_id" text,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "debates" (
	"id" text PRIMARY KEY NOT NULL,
	"resolution" text NOT NULL,
	"status" "debate_status" DEFAULT 'active' NOT NULL,
	"current_round" integer DEFAULT 1 NOT NULL,
	"current_turn" "turn" DEFAULT 'support' NOT NULL,
	"support_debater_id" text NOT NULL,
	"oppose_debater_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"concluded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "market_data_points" (
	"id" text PRIMARY KEY NOT NULL,
	"debate_id" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"support_price" real NOT NULL,
	"vote_count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "neon_auth"."user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"emailVerified" boolean,
	"image" text,
	"createdAt" timestamp,
	"updatedAt" timestamp,
	"role" text,
	"banned" boolean,
	"banReason" text,
	"banExpires" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reactions" (
	"id" text PRIMARY KEY NOT NULL,
	"argument_id" text NOT NULL,
	"voter_id" text NOT NULL,
	"type" "reaction_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rounds" (
	"id" text PRIMARY KEY NOT NULL,
	"debate_id" text NOT NULL,
	"round_number" integer NOT NULL,
	"round_type" "round_type" NOT NULL,
	"support_argument_id" text,
	"oppose_argument_id" text,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stance_spikes" (
	"id" text PRIMARY KEY NOT NULL,
	"debate_id" text NOT NULL,
	"argument_id" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"delta_amount" real NOT NULL,
	"direction" "direction" NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stances" (
	"id" text PRIMARY KEY NOT NULL,
	"debate_id" text NOT NULL,
	"voter_id" text NOT NULL,
	"type" "stance_type" NOT NULL,
	"support_value" integer NOT NULL,
	"confidence" integer NOT NULL,
	"last_argument_seen" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"auth_user_id" uuid,
	"username" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text,
	"reputation_score" real DEFAULT 100 NOT NULL,
	"prediction_accuracy" real DEFAULT 50 NOT NULL,
	"debates_participated" integer DEFAULT 0 NOT NULL,
	"sandbox_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "arguments" ADD CONSTRAINT "arguments_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "arguments" ADD CONSTRAINT "arguments_debater_id_users_id_fk" FOREIGN KEY ("debater_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comments" ADD CONSTRAINT "comments_debate_id_debates_id_fk" FOREIGN KEY ("debate_id") REFERENCES "public"."debates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "debates" ADD CONSTRAINT "debates_support_debater_id_users_id_fk" FOREIGN KEY ("support_debater_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "debates" ADD CONSTRAINT "debates_oppose_debater_id_users_id_fk" FOREIGN KEY ("oppose_debater_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "market_data_points" ADD CONSTRAINT "market_data_points_debate_id_debates_id_fk" FOREIGN KEY ("debate_id") REFERENCES "public"."debates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reactions" ADD CONSTRAINT "reactions_argument_id_arguments_id_fk" FOREIGN KEY ("argument_id") REFERENCES "public"."arguments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reactions" ADD CONSTRAINT "reactions_voter_id_users_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rounds" ADD CONSTRAINT "rounds_debate_id_debates_id_fk" FOREIGN KEY ("debate_id") REFERENCES "public"."debates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stance_spikes" ADD CONSTRAINT "stance_spikes_debate_id_debates_id_fk" FOREIGN KEY ("debate_id") REFERENCES "public"."debates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stance_spikes" ADD CONSTRAINT "stance_spikes_argument_id_arguments_id_fk" FOREIGN KEY ("argument_id") REFERENCES "public"."arguments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stances" ADD CONSTRAINT "stances_debate_id_debates_id_fk" FOREIGN KEY ("debate_id") REFERENCES "public"."debates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stances" ADD CONSTRAINT "stances_voter_id_users_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_auth_user_id_user_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "neon_auth"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
