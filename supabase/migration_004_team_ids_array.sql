-- Convert team_id from integer to integer array on alert_routes
ALTER TABLE alert_routes ADD COLUMN IF NOT EXISTS team_ids INTEGER[] DEFAULT NULL;
-- Migrate existing data
UPDATE alert_routes SET team_ids = ARRAY[team_id] WHERE team_id IS NOT NULL AND team_ids IS NULL;
