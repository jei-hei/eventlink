-- University-wide college for SSC (Supreme Student Council — not a CCSICT org)
insert into public.colleges (name, code)
values ('University-wide', 'UNIV')
on conflict (code) do nothing;

insert into public.organizations (college_id, name, slug)
select c.id, 'SSC', 'ssc'
from public.colleges c
where c.code = 'UNIV'
on conflict (college_id, name) do update set slug = excluded.slug;
