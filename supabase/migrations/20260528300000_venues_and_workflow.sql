-- Venues catalog (managed by GSO)

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venues_name_unique unique (name)
);

create trigger venues_updated_at
before update on public.venues
for each row execute function public.set_updated_at();

alter table public.venues enable row level security;

create policy venues_select_authenticated on public.venues
  for select to authenticated using (active or public.has_role(auth.uid(), 'gso') or public.has_role(auth.uid(), 'admin'));

create policy venues_gso_admin_write on public.venues
  for all to authenticated
  using (public.has_role(auth.uid(), 'gso') or public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'gso') or public.has_role(auth.uid(), 'admin'));

insert into public.venues (name)
values ('Gymnasium'), ('Devenecia'), ('Open Gymnasium')
on conflict (name) do nothing;

-- Link staff test accounts to CCSICT for org filtering (officer / adviser / dean)
update public.profiles p
set college_id = c.id
from public.colleges c
where c.code = 'CCSICT'
  and p.email in (
    'officer@eventlink.local',
    'adviser@eventlink.local',
    'dean@eventlink.local'
  );

update public.profiles p
set organization_id = o.id,
    college_id = o.college_id
from public.organizations o
where o.slug = 'ccsict-sbo'
  and p.email = 'officer@eventlink.local';
