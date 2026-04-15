-- Add team_id to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS team_id INTEGER DEFAULT NULL;

-- Alert routing rules: map conditions to Google Chat webhooks
CREATE TABLE IF NOT EXISTS alert_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                          -- e.g. "New Leads - Urgent"
  webhook_url TEXT NOT NULL,                   -- Google Chat webhook URL
  stage TEXT DEFAULT NULL,                     -- Filter by SLA stage (null = all stages)
  team_id INTEGER DEFAULT NULL,                -- Filter by sales team ID (null = all teams)
  alert_level TEXT DEFAULT NULL,               -- Filter by alert level: highest, critical, high, medium (null = all)
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_routes_active ON alert_routes(is_active);

CREATE TRIGGER alert_routes_updated_at
  BEFORE UPDATE ON alert_routes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
