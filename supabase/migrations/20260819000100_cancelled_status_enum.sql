-- Phase 2: add cancelled status (run alone first; commit before using the value).
alter type public.request_status add value if not exists 'cancelled';
