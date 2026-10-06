-- Admin-only email delivery health for Settings. Returns counts only:
-- no recipients, addresses, or message content leave the outbox.

create or replace function public.notification_email_outbox_summary()
returns table (
  pending bigint,
  sending bigint,
  sent bigint,
  failed bigint,
  exhausted bigint,
  skipped bigint,
  last_sent_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Admin authorization required.' using errcode = '42501';
  end if;

  return query
  select
    count(*) filter (where o.status = 'pending'),
    count(*) filter (where o.status = 'sending'),
    count(*) filter (where o.status = 'sent'),
    count(*) filter (where o.status = 'failed'),
    count(*) filter (where o.status = 'exhausted'),
    count(*) filter (where o.status = 'skipped'),
    max(o.sent_at)
  from public.notification_email_outbox o
  where o.created_at >= now() - interval '7 days';
end;
$$;

revoke all on function public.notification_email_outbox_summary() from public, anon, authenticated;
grant execute on function public.notification_email_outbox_summary() to authenticated;
