-- A confirmation arrives in the subscriber's browser, not the operator's, so an
-- open Subscribers page has no way to hear about it. This announces every write
-- on the table; the admin app holds a LISTEN and pushes the change to the page
-- over an event stream.
--
-- Statement-level rather than row-level: a broadcast that touches four hundred
-- rows should wake the console once, not four hundred times.
--
-- The trigger lives in the database rather than in the application so a change
-- made from psql, a migration, or a future service announces itself too.

CREATE OR REPLACE FUNCTION notify_subscribers_changed() RETURNS trigger AS $$
BEGIN
  -- No payload: the listener re-reads the list, and pg_notify caps payloads at
  -- 8000 bytes, which a diff could exceed.
  PERFORM pg_notify('subscribers_changed', '');
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS subscribers_changed ON "subscribers";
--> statement-breakpoint
CREATE TRIGGER subscribers_changed
AFTER INSERT OR UPDATE OR DELETE ON "subscribers"
FOR EACH STATEMENT EXECUTE FUNCTION notify_subscribers_changed();
