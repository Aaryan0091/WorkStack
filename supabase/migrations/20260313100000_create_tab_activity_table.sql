-- Create tab_activity table for tracking user browsing activity
-- This table stores individual browsing sessions per tab, URL, and domain
CREATE TABLE IF NOT EXISTS tab_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  domain TEXT,
  duration_seconds INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  tracking_session_id TEXT,
  tab_id TEXT
);

-- Enable Row Level Security (RLS)
ALTER TABLE tab_activity ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: Users can only access their own activity
CREATE POLICY "Users can manage own tab activity" ON tab_activity
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (true);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS tab_activity_user_id_idx ON tab_activity(user_id);
CREATE INDEX IF NOT EXISTS tab_activity_domain_idx ON tab_activity(domain);
CREATE INDEX IF NOT EXISTS tab_activity_started_at_idx ON tab_activity(started_at DESC);
CREATE INDEX IF NOT EXISTS tab_activity_session_idx ON tab_activity(tracking_session_id, tab_id);
