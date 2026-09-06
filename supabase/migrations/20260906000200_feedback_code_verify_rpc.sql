-- Protect feedback access code hash; calendar read for infirmary/nstp is covered by
-- existing authenticated select on event_requests. Hash must not appear in public API docs.

revoke all on function public.check_venue_availability(text, date, date, uuid, time, time) from public;
grant execute on function public.check_venue_availability(text, date, date, uuid, time, time) to authenticated;

-- Prefer verifying access codes via RPC so clients need not SELECT the hash column.
create or replace function public.verify_feedback_access_code(
  p_feed_post_id uuid,
  p_code_hash text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.student_feed_posts p
    where p.id = p_feed_post_id
      and p.require_feedback_access_code = true
      and p.feedback_access_code_hash is not null
      and p.feedback_access_code_hash = p_code_hash
  );
$$;

grant execute on function public.verify_feedback_access_code(uuid, text) to authenticated;

comment on function public.verify_feedback_access_code(uuid, text) is
  'Compares submitted access-code hash without exposing stored hash to clients.';
