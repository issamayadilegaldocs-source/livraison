const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is required');
  await mongoose.connect(uri);
  const result = await mongoose.connection
    .collection('riders')
    .updateMany({ location: { $exists: true } }, { $unset: { location: '' } });
  process.stdout.write(`Removed persisted location from ${result.modifiedCount} rider(s).\n`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
