-- One-time: invalidate all existing sessions so everyone must sign in again
-- after this deploy. The refresh endpoint checks the DB, so clearing this table
-- logs out all current sessions on the next page load.
DELETE FROM "RefreshToken";
