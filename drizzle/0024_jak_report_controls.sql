ALTER TABLE "jak_code_reports" ADD COLUMN IF NOT EXISTS "js" text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE "jak_code_reports" ADD COLUMN IF NOT EXISTS "fonts" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "jak_code_reports" ADD COLUMN IF NOT EXISTS "reading_text" text NOT NULL DEFAULT '';
--> statement-breakpoint
-- Preserve existing publish/archive/restore capabilities, including individual
-- denials. New permanent deletion is intentionally not granted automatically.
INSERT INTO role_permissions (role_id, permission_key)
SELECT role_id, replace(permission_key, 'story.', 'jak.')
FROM role_permissions
WHERE permission_key IN ('story.publish', 'story.archive', 'story.restore')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO user_permissions (user_id, permission_key, effect)
SELECT user_id, replace(permission_key, 'story.', 'jak.'), effect
FROM user_permissions
WHERE permission_key IN ('story.publish', 'story.archive', 'story.restore')
ON CONFLICT DO NOTHING;
