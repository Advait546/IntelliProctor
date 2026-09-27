// Creates (or updates the password of) an admin/exam-setter account.
//
// Usage:
//   npm run seed:admin -- "Dr. Sharma" admin@example.com "StrongPass123!"
//
// There's no admin sign-up UI (see BACKEND_SETUP.md's "out of scope" notes),
// so this script is the only way to create the first admin login.

import bcrypt from 'bcryptjs';
import { supabase } from '../src/config/supabaseClient.js';

async function main() {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password) {
    console.error('Usage: npm run seed:admin -- "<name>" "<email>" "<password>"');
    process.exit(1);
  }

  const password_hash = await bcrypt.hash(password, 10);
  const normalizedEmail = email.toLowerCase();

  const { data: existing, error: findError } = await supabase
    .from('admins')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();
  if (findError) throw findError;

  if (existing) {
    const { error: updateError } = await supabase
      .from('admins')
      .update({ name, password_hash })
      .eq('id', existing.id);
    if (updateError) throw updateError;
    console.log(`Updated existing admin ${normalizedEmail} (id ${existing.id}).`);
  } else {
    const { data: created, error: createError } = await supabase
      .from('admins')
      .insert({ name, email: normalizedEmail, password_hash })
      .select('id')
      .single();
    if (createError) throw createError;
    console.log(`Created admin ${normalizedEmail} (id ${created.id}).`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
