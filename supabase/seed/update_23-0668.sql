-- Run once in Supabase SQL Editor to update registry row 23-0668
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
values (
  '23-0668',
  'J-A Miguel',
  'CCSICT',
  'BSIT',
  '',
  'mja0935@gmail.com',
  (select id from public.colleges where code = 'CCSICT'),
  false
)
on conflict (student_id) do update set
  full_name = excluded.full_name,
  course = excluded.course,
  program = excluded.program,
  email = excluded.email,
  college_id = excluded.college_id,
  archived = false,
  updated_at = now();

-- Repair profile for mja0935@gmail.com if auth exists but public.profiles is missing
insert into public.profiles (id, display_name, email, student_id)
select
  u.id,
  'J-A Miguel',
  u.email,
  '23-0668'
from auth.users u
where lower(u.email) = lower('mja0935@gmail.com')
on conflict (id) do update set
  display_name = excluded.display_name,
  email = excluded.email,
  student_id = excluded.student_id,
  updated_at = now();

-- Ensure student role (change in user_roles if you use staff login instead)
insert into public.user_roles (user_id, role)
select u.id, 'student'::public.app_role
from auth.users u
where lower(u.email) = lower('mja0935@gmail.com')
on conflict (user_id) do nothing;
