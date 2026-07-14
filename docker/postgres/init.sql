-- Runs once, automatically, on first container start (mounted into
-- /docker-entrypoint-initdb.d/). Enables PostGIS so spatial columns and
-- indexes are available before any schema/migrations exist.
-- Domain tables are intentionally NOT created here — see Sprint 04 Story 02/03.

CREATE EXTENSION IF NOT EXISTS postgis;
