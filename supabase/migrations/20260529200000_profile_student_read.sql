-- Let signed-in users read their linked registry row (for profile + signup display).
drop policy if exists students_select_own on public.students;

create policy students_select_own on public.students
  for select to authenticated
  using (
    student_id = (
      select p.student_id
      from public.profiles p
      where p.id = auth.uid()
    )
  );

-- Signup step 2: include college (stored in students.course) and program code.
-- Must drop first: PostgreSQL cannot change OUT/return row type with CREATE OR REPLACE.
drop function if exists public.get_student_registry_row(text);

create function public.get_student_registry_row(p_student_id text)
returns table (
  student_id text,
  full_name text,
  email text,
  college text,
  program text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.student_id, s.full_name, s.email, s.course, s.program
  from public.students s
  where upper(trim(s.student_id)) = upper(trim(p_student_id))
    and not s.archived
  limit 1;
$$;

grant execute on function public.get_student_registry_row(text) to anon, authenticated;
