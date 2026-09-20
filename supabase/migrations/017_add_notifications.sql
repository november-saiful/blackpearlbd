-- Notifications table for in-app notifications
-- Users see only their own; admins can insert for any user.

CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'booking_confirmed',
    'booking_approved',
    'booking_rejected',
    'booking_processing',
    'package_approved',
    'package_rejected',
    'package_processing',
    'pearls_earned',
    'welcome'
  )),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role inserts notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
