import { createClient } from "@supabase/supabase-js";

const [emailArg, roleArg] = process.argv.slice(2);
const email = emailArg?.trim().toLowerCase();
const role = roleArg?.trim().toLowerCase();
const allowedRoles = new Set(["admin", "founder", "closer", "setter", "csm", "coach", "student"]);

if (!email || !role || !allowedRoles.has(role)) {
  console.error("Usage: npm run roles:grant -- <email> <admin|founder|closer|setter|csm|coach|student>");
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secretKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: users, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (usersError) throw new Error(usersError.message);

const user = users.users.find((candidate) => candidate.email?.toLowerCase() === email);
if (!user) {
  throw new Error(`No Supabase user exists for ${email}. Have that person sign up and confirm their email first.`);
}

const { error } = await supabase
  .from("user_roles")
  .upsert({ user_id: user.id, role }, { onConflict: "user_id,role", ignoreDuplicates: true });
if (error) throw new Error(error.message);

console.log(`Granted ${role} to ${email}.`);
