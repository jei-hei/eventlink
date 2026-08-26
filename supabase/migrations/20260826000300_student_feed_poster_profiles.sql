-- Allow Student Feed to resolve the real poster profile (name, avatar, org, college).

-- Poster profiles for anyone who has published a feed post (anon student feed + authenticated).
drop policy if exists profiles_select_feed_authors on public.profiles;
create policy profiles_select_feed_authors on public.profiles
  for select
  using (
    exists (
      select 1
      from public.student_feed_posts sfp
      where sfp.submitted_by = profiles.id
    )
  );

-- College names nested under poster profiles on the public feed.
drop policy if exists colleges_select_public on public.colleges;
create policy colleges_select_public on public.colleges
  for select using (true);

-- Optional FK so PostgREST can embed profiles via submitted_by when desired.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'student_feed_posts_submitted_by_profiles_fkey'
  ) then
    alter table public.student_feed_posts
      add constraint student_feed_posts_submitted_by_profiles_fkey
      foreign key (submitted_by) references public.profiles (id)
      on delete cascade;
  end if;
exception
  when others then
    -- Skip if orphaned submitted_by rows block the FK; app still loads profiles by id.
    raise notice 'student_feed_posts_submitted_by_profiles_fkey not added: %', sqlerrm;
end $$;
