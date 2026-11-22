/*
 * Creates a single new Clerk CUSTOMER account (email + password) and links it
 * to a Mongo `users` document by email, creating the document if needed.
 *
 * Usage: node scripts/create-customer-account.js <email> <password> [name]
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const [, , emailArg, passwordArg, nameArg] = process.argv;
  if (!emailArg || !passwordArg) {
    console.error('Usage: node scripts/create-customer-account.js <email> <password> [name]');
    process.exit(1);
  }
  const email = emailArg.toLowerCase().trim();
  const name = nameArg || 'Test Customer';

  if (!process.env.CLERK_SECRET_KEY) {
    console.error('CLERK_SECRET_KEY missing from environment.');
    process.exit(1);
  }
  const mongoUri = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI || process.env.DB_URL;
  if (!mongoUri) {
    console.error('Mongo connection string missing from environment.');
    process.exit(1);
  }

  const parts = name.trim().split(/\s+/).filter(Boolean);

  const res = await fetch('https://api.clerk.com/v1/users', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email_address: [email],
      password: passwordArg,
      skip_password_checks: true,
      first_name: parts[0] || undefined,
      last_name: parts.slice(1).join(' ') || undefined,
      public_metadata: { role: 'CUSTOMER' },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Clerk createUser failed (${res.status}): ${body.slice(0, 500)}`);
    process.exit(1);
  }

  const clerkUser = await res.json();
  console.log(`Clerk account created: ${clerkUser.id}`);

  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  await db.collection('users').updateOne(
    { email },
    {
      $set: { email, name, clerkId: clerkUser.id, userType: 'default', isActive: true },
    },
    { upsert: true },
  );

  console.log(`Mongo user document linked for ${email}.`);
  console.log('Login credentials:');
  console.log(`  email:    ${email}`);
  console.log(`  password: ${passwordArg}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
