-- Run this in your Supabase SQL Editor to create the tables

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  odoo_lead_id INTEGER UNIQUE NOT NULL,
  lead_name TEXT NOT NULL,
  partner_name TEXT DEFAULT '',
  salesperson TEXT DEFAULT '',
  salesperson_email TEXT DEFAULT '',
  stage TEXT NOT NULL,
  stage_entered_at TIMESTAMPTZ NOT NULL,
  sla_status TEXT DEFAULT 'ok' CHECK (sla_status IN ('ok', 'warning', 'breached')),
  sla_breached_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  alert_type TEXT DEFAULT 'sla_breach',
  message TEXT NOT NULL,
  sent_to TEXT NOT NULL,
  google_chat_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings table (single row)
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_chat_webhook_url TEXT DEFAULT '',
  sla_rules JSONB DEFAULT '{}',
  alert_recipients JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings row
INSERT INTO settings (google_chat_webhook_url, sla_rules, alert_recipients)
VALUES ('', '{}', '{}')
ON CONFLICT DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_sla_status ON leads(sla_status);
CREATE INDEX IF NOT EXISTS idx_leads_is_active ON leads(is_active);
CREATE INDEX IF NOT EXISTS idx_leads_odoo_id ON leads(odoo_lead_id);
CREATE INDEX IF NOT EXISTS idx_alerts_lead_id ON alerts(lead_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
