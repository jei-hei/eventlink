-- Campus venues owned by GSO. Names are unique, so a second push does not duplicate them.

insert into public.venues (name, responsible_office, availability, status, active)
values
  ('Amphitheater', 'gso', 'available', 'active', true),
  ('Grand Stand', 'gso', 'available', 'active', true),
  ('Open Gym', 'gso', 'available', 'active', true),
  ('Climate Building', 'gso', 'available', 'active', true),
  ('De Venecia', 'gso', 'available', 'active', true),
  ('Multipurpose Building Hall', 'gso', 'available', 'active', true)
on conflict (name) do nothing;
