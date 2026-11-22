/**
 * One-off: grant ADMIN to the given Clerk users by
 *   1. setting Clerk `publicMetadata.role = 'ADMIN'` (what RolesGuard checks), and
 *   2. upserting a matching ADMIN owner document keyed by clerkId.
 * Usage: node tools/add-admin-owner.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { createClerkClient } = require('@clerk/backend');

const ROLE = 'ADMIN';
const CLERK_IDS = [
  'user_3F1zG2fTfc6ON0EQKzDvHsWZeRh',
  'user_3F02y85HO3w7LAHCxDmdU9JWAD3',
  'user_32NYG7qXcXlJpUfTz5uHLzduixA',
  'user_3F6JERBgW7bf5OvyLc7zWiXFhpt',
];

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI missing from .env');
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error('CLERK_SECRET_KEY missing from .env');

  const clerk = createClerkClient({ secretKey });
  await mongoose.connect(uri);
  const owners = mongoose.connection.collection('owners');

  for (const clerkId of CLERK_IDS) {
    // 1. Clerk role — merge into existing publicMetadata so we don't clobber it.
    const existing = await clerk.users.getUser(clerkId);
    await clerk.users.updateUserMetadata(clerkId, {
      publicMetadata: { ...existing.publicMetadata, role: ROLE },
    });
    console.log(`Clerk role set to ${ROLE} for ${clerkId}`);

    // Resolve the primary email from Clerk (OwnerProfile.email is non-nullable).
    const email = (
      existing.emailAddresses.find(
        (e) => e.id === existing.primaryEmailAddressId,
      )?.emailAddress ?? existing.emailAddresses[0]?.emailAddress
    )?.toLowerCase();
    if (!email) throw new Error(`No email found on Clerk user ${clerkId}`);

    // 2. Owner document.
    const now = new Date();
    const res = await owners.findOneAndUpdate(
      { clerkId },
      {
        $set: {
          clerkId,
          email,
          userType: ROLE,
          isActive: true,
          updatedAt: now,
        },
        $setOnInsert: {
          permissions: [],
          restaurants: [],
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    console.log('Owner upserted:', JSON.stringify(res.value ?? res, null, 2));
  }

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
