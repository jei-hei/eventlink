-- EventLink demo seed: colleges, organizations, student registry
-- Run in Supabase SQL Editor AFTER migrations/20260527120000_eventlink_initial.sql

-- Colleges
insert into public.colleges (name, code)
values
  ('College of Computing, Communications, and Information Technology', 'CCSICT'),
  ('College of Engineering', 'COE'),
  ('College of Business', 'COB')
on conflict (code) do nothing;

-- Organizations (one per college example)
insert into public.organizations (college_id, name, slug)
select c.id, 'Student Board Organization', 'ccsict-sbo'
from public.colleges c
where c.code = 'CCSICT'
on conflict (college_id, name) do nothing;

insert into public.organizations (college_id, name, slug)
select c.id, 'Engineering Student Council', 'coe-esc'
from public.colleges c
where c.code = 'COE'
on conflict (college_id, name) do nothing;

-- Master student registry (YY-XXXX must match signup exactly)
insert into public.students (
  student_id,
  full_name,
  course,
  program,
  year_level,
  email,
  college_id,
  archived
)
values
  (
    '23-0668',
    'J-A Miguel',
    'BSIT',
    'Information Technology',
    '3',
    'mja0935@gmail.com',
    (select id from public.colleges where code = 'CCSICT'),
    false
  ),
  (
    '23-0669',
    'Maria Santos',
    'BSIT',
    'Information Technology',
    '3',
    'maria.santos@isu.edu.ph',
    (select id from public.colleges where code = 'CCSICT'),
    false
  ),
  (
    '24-0101',
    'Pedro Reyes',
    'BSCS',
    'Computer Science',
    '2',
    'pedro.reyes@gmail.com',
    (select id from public.colleges where code = 'CCSICT'),
    false
  ),
  (
    '22-0142',
    'Ana Lopez',
    'BSIT',
    'Information Technology',
    '4',
    'ana.lopez@isu.edu.ph',
    (select id from public.colleges where code = 'CCSICT'),
    false
  )
on conflict (student_id) do update set
  full_name = excluded.full_name,
  course = excluded.course,
  program = excluded.program,
  year_level = excluded.year_level,
  email = excluded.email,
  college_id = excluded.college_id,
  archived = excluded.archived,
  updated_at = now();

-- Optional: verify
-- select student_id, full_name, email from public.students order by student_id;
