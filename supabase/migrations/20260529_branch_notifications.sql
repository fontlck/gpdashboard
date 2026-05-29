-- Add notification fields to branches table
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS notification_email    text,
  ADD COLUMN IF NOT EXISTS line_notify_token     text;

COMMENT ON COLUMN branches.notification_email  IS 'Email address to receive report notifications (approved/paid)';
COMMENT ON COLUMN branches.line_notify_token   IS 'Line Notify token for report notifications';
