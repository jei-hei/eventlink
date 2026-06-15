-- SSC (Supreme Student Council) is university-wide, not a CCSICT college org.
insert into public.colleges (name, code)
values ('University-wide', 'UNIV')
on conflict (code) do nothing;

update public.organizations o
set college_id = c.id
from public.colleges c
where c.code = 'UNIV'
  and o.slug = 'ssc';

-- Create SSC under UNIV if it only existed under a college and was not updated above.
insert into public.organizations (college_id, name, slug)
select c.id, 'SSC', 'ssc'
from public.colleges c
where c.code = 'UNIV'
  and not exists (select 1 from public.organizations where slug = 'ssc')
on conflict (college_id, name) do update set slug = excluded.slug;
