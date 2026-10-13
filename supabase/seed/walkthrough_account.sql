-- Create the single walkthrough login. Safe to run again.
-- A new account gets a one-time password in the result table.
-- An existing account keeps its password and is only marked as the walkthrough login.

create temp table if not exists walkthrough_account_result (
  email text,
  temp_password text,
  result text
);

truncate walkthrough_account_result;

do $$
declare
  v_email text := 'walkthrough@eventlink.local';
  v_user_id uuid;
  v_password text;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = v_email;

  v_password := null;

  if v_user_id is null then
    v_user_id := gen_random_uuid();
    v_password := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change,
      email_change_token_new,
      email_change_token_current
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      extensions.crypt(v_password, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', 'Walkthrough'),
      now(),
      now(),
      '',
      '',
      '',
      '',
      ''
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      v_user_id::text,
      now(),
      now(),
      now()
    );
  end if;

  insert into public.profiles (id, display_name, email, is_walkthrough)
  values (v_user_id, 'Walkthrough', v_email, true)
  on conflict (id) do update
  set is_walkthrough = true,
      display_name = case
        when nullif(trim(public.profiles.display_name), '') is null then 'Walkthrough'
        else public.profiles.display_name
      end;

  insert into walkthrough_account_result (email, temp_password, result)
  values (
    v_email,
    coalesce(v_password, 'existing password kept'),
    case when v_password is null then 'updated' else 'created' end
  );
end;
$$;

select email, temp_password, result
from walkthrough_account_result
order by email;
