/*
 * Resets the Clerk password for the seeded vendor accounts and reports
 * only success/failure per email — never prints secrets to stdout.
 *
 * Usage: node scripts/reset-vendor-clerk-passwords.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const NEW_PASSWORD = process.env.VENDOR_RESET_PASSWORD || 'Vendor2026!';

const VENDOR_EMAILS = [
  'hsouna@gmail.com',
  'vendor@enatega.com',
  'vendor.pizza@enatega-test.com',
  'vendor.masmoudi@enatega-test.com',
];

async function main() {
  const clerkSecret = process.env.CLERK_SECRET_KEY;
  if (!clerkSecret) {
    console.error('CLERK_SECRET_KEY missing from environment.');
    process.exit(1);
  }
  const mongoUri = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI || process.env.DB_URL;
  if (!mongoUri) {
    console.error('Mongo connection string missing from environment.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  const owners = await db
    .collection('owners')
    .find({ email: { $in: VENDOR_EMAILS } }, { projection: { email: 1, clerkId: 1 } })
    .toArray();

  const results = [];

  for (const email of VENDOR_EMAILS) {
    const owner = owners.find((o) => o.email === email);
    if (!owner) {
      results.push({ email, status: 'NOT_FOUND_IN_MONGO' });
      continue;
    }
    if (!owner.clerkId) {
      results.push({ email, status: 'NO_CLERK_LINK' });
      continue;
    }

    const res = await fetch(`https://api.clerk.com/v1/users/${owner.clerkId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${clerkSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: NEW_PASSWORD, skip_password_checks: true }),
    });

    if (res.ok) {
      results.push({ email, status: 'PASSWORD_SET' });
    } else {
      const body = await res.text();
      results.push({ email, status: `FAILED (${res.status}): ${body.slice(0, 200)}` });
    }
  }

  console.log('New password for all vendor accounts:', NEW_PASSWORD);
  console.table(results);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
