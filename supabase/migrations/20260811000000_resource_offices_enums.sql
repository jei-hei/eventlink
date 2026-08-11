-- Phase 1a: Add enum values only.
-- PostgreSQL requires new enum values to be committed before they can be used
-- in policies, inserts, or other statements. Run this file FIRST, then run
-- 20260811000100_resource_offices_phase1.sql.

alter type public.app_role add value if not exists 'it_infrastructure';
alter type public.app_role add value if not exists 'sports_office';
alter type public.workflow_step add value if not exists 'resource_offices';
