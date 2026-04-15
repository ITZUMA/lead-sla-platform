-- Add lead_type to leads table (lead or opportunity)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_type TEXT DEFAULT 'opportunity';

-- Add lead_type filter and custom SLA override to alert_routes
ALTER TABLE alert_routes ADD COLUMN IF NOT EXISTS lead_type TEXT DEFAULT NULL;       -- 'lead', 'opportunity', or null (all)
ALTER TABLE alert_routes ADD COLUMN IF NOT EXISTS sla_override_minutes INTEGER DEFAULT NULL; -- Custom SLA in minutes (null = use default)
