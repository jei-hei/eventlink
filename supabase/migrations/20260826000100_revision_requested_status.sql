-- Phase 3a: Revision Requested status enum value.
-- Run this FIRST in a separate query (and let it commit) before 20260826000200.

alter type public.request_status add value if not exists 'revision_requested';
