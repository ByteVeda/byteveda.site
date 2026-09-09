-- Replaces 0004. Live updates now come from the application: the confirm and
-- unsubscribe endpoints announce the change on an in-process bus that the
-- admin console's event stream reads from.
--
-- 0004 is left in place rather than edited — it has already run, and a migration
-- that changes after it has been applied is a migration nobody can trust.

DROP TRIGGER IF EXISTS subscribers_changed ON "subscribers";
--> statement-breakpoint
DROP FUNCTION IF EXISTS notify_subscribers_changed();
