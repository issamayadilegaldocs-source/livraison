/*
 * Resets the Clerk password for the seeded rider and customer accounts and
 * reports only success/failure per email — never prints secrets to stdout.
 *
 * Usage: node scripts/reset-rider-customer-clerk-passwords.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const NEW_PASSWORD = process.env.RESET_PASSWORD || 'Enatega2026!';

const RIDER_EMAILS = [
  'issam.ayadi.ext@gmail.com',
  'rider.sfax@enatega-test.com',
  'rider.demo@enatega-test.com',
];

const CUSTOMER_EMAILS = [
  'issam.ayadi.ext@gmail.com',
  'customer.sfax@enatega-test.com',
];

async function resetGroup(db, collectionName, emails, results) {
  const docs = await db
    .collection(collectionName)
    .find({ email: { $in: emails } }, { projection: { email: 1, clerkId: 1 } })
    .toArray();

  for (const email of emails) {
    const doc = docs.find((d) => d.email === email);
    if (!doc) {
      results.push({ collection: collectionName, email, status: 'NOT_FOUND_IN_MONGO' });
      continue;
    }
    if (!doc.clerkId) {
      results.push({ collection: collectionName, email, status: 'NO_CLERK_LINK' });
      continue;
    }

    const res = await fetch(`https://api.clerk.com/v1/users/${doc.clerkId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: NEW_PASSWORD, skip_password_checks: true }),
    });

    if (res.ok) {
      results.push({ collection: collectionName, email, status: 'PASSWORD_SET' });
    } else {
      const body = await res.text();
      results.push({ collection: collectionName, email, status: `FAILED (${res.status}): ${body.slice(0, 200)}` });
    }
  }
}

async function main() {
  if (!process.env.CLERK_SECRET_KEY) {
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
  await resetGroup(db, 'riders', RIDER_EMAILS, results);
  await resetGroup(db, 'users', CUSTOMER_EMAILS, results);

  console.log('New password for all accounts below:', NEW_PASSWORD);
  console.table(results);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
