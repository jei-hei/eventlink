-- GSO equipment catalog (for event request checkboxes later)
insert into public.equipment (name, quantity_available, active)
values
  ('Plastic chairs', 200, true),
  ('Folding tables', 40, true),
  ('Sound system (portable)', 4, true),
  ('Projector', 6, true),
  ('Extension cords (set)', 20, true),
  ('Podium', 3, true)
on conflict do nothing;
