import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error("Missing SUPABASE URL or SUPABASE_SERVICE_ROLE_KEY in .env.seed.");
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEFAULT_PASSWORD = process.env.TEST_USER_PASSWORD ?? "EventLinkTest123!";

const users = [
  { email: "projectth85@gmail.com", displayName: "Project TH", role: "student" },
  { email: "dquest366@gmail.com", displayName: "D Quest", role: "student" },
  { email: "hatdogmani81@gmail.com", displayName: "Hatdog Mani", role: "student" },
  { email: "saladtig20@gmail.com", displayName: "Salad Tig", role: "student" },
  { email: "dungeonq84@gmail.com", displayName: "Dungeon Q", role: "student" },
  {
    email: "aliahmarie.o.carino@isu.edu.ph",
    displayName: "Aliah Marie Cariño",
    role: "student",
    studentId: "23-0671",
    course: "BSIT",
    program: "Information Technology",
  },
];

async function findUserByEmail(targetEmail) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase()) ?? null;
}

for (const row of users) {
  let user = await findUserByEmail(row.email);
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: row.email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: row.displayName },
    });
    if (error) throw error;
    user = data.user;
    console.log(`created auth user: ${row.email}`);
  } else {
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: row.displayName },
    });
    if (error) throw error;
    console.log(`updated auth user: ${row.email}`);
  }

  if (row.studentId) {
    const { error: studentErr } = await supabase.from("students").upsert(
      {
        student_id: row.studentId,
        full_name: row.displayName,
        course: row.course ?? "",
        program: row.program ?? "",
        year_level: "",
        email: row.email,
        archived: false,
      },
      { onConflict: "student_id" },
    );
    if (studentErr) throw studentErr;
  }

  const { error: profileErr } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      display_name: row.displayName,
      email: row.email,
      student_id: row.studentId ?? null,
    },
    { onConflict: "id" },
  );
  if (profileErr) throw profileErr;

  const { error: roleErr } = await supabase.from("user_roles").upsert(
    { user_id: user.id, role: row.role },
    { onConflict: "user_id" },
  );
  if (roleErr) throw roleErr;
}

console.log("\nDone.");
console.log(`Password for these test users: ${DEFAULT_PASSWORD}`);
