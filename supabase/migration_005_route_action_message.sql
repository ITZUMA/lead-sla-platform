-- Add custom action message to alert routes
ALTER TABLE alert_routes ADD COLUMN IF NOT EXISTS action_message TEXT DEFAULT NULL;
