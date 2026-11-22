/*
 * Scoped reset — touches ONLY the 3 accounts needed to test the Sidi Mansour
 * flow (vendor, rider, customer). Never prints secrets to stdout except the
 * one shared password, which is only usable together with these 3 emails.
 *
 * Usage: node reset-sidimansour-test-accounts.js
 * (run from a directory where `require('dotenv').config()` can see
 *  enatega-multivendor-api/.env, or pass MONGO_URI/CLERK_SECRET_KEY inline)
 */
require('dotenv').config();
const mongoose = require('mongoose');

const NEW_PASSWORD = process.env.RESET_PASSWORD || 'SidiMansour2026!';

const TARGETS = [
  // owners.vendor@enatega.com est lié au compte Clerk test.store.claude@enatega-test.dev
  // (le même clerkId est aussi sur restaurants."Restaurant Sidi Mansour").
  { collection: 'owners', email: 'vendor@enatega.com', role: 'store (test.store.claude@enatega-test.dev)' },
  { collection: 'riders', email: 'rider.sidimansour@enatega.com', role: 'rider' },
  { collection: 'riders', email: 'rider.sfax@enatega-test.com', role: 'rider (backup)' },
  { collection: 'users', email: 'customer.sfax@enatega-test.com', role: 'customer' },
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

  const results = [];

  for (const target of TARGETS) {
    const doc = await db
      .collection(target.collection)
      .findOne({ email: target.email }, { projection: { email: 1, clerkId: 1 } });

    if (!doc) {
      results.push({ ...target, status: 'NOT_FOUND_IN_MONGO' });
      continue;
    }
    if (!doc.clerkId) {
      results.push({ ...target, status: 'NO_CLERK_LINK' });
      continue;
    }

    try {
      const res = await fetch(`https://api.clerk.com/v1/users/${doc.clerkId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${clerkSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: NEW_PASSWORD, skip_password_checks: true }),
      });

      if (res.ok) {
        results.push({ ...target, status: 'PASSWORD_SET' });
      } else {
        const body = await res.text();
        results.push({ ...target, status: `FAILED (${res.status}): ${body.slice(0, 200)}` });
      }
    } catch (err) {
      results.push({ ...target, status: `ERROR: ${err.message}` });
    }
  }

  console.log('New password for the 3 accounts below:', NEW_PASSWORD);
  console.table(results.map(({ collection, email, role, status }) => ({ collection, email, role, status })));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
