/**
 * Removes legacy provider credentials from the singleton configurations document.
 *
 * Usage: npm run cleanup:configuration-secrets
 */
require('dotenv').config();
const mongoose = require('mongoose');

const REMOVED_FIELDS = [
  'email',
  'emailName',
  'password',
  'enableEmail',
  'formEmail',
  'clientId',
  'clientSecret',
  'sandbox',
  'publishableKey',
  'secretKey',
  'twilioAccountSid',
  'twilioAuthToken',
  'twilioPhoneNumber',
  'twilioWhatsAppNumber',
  'twilioEnabled',
  'sendGridApiKey',
  'sendGridEnabled',
  'sendGridEmail',
  'sendGridEmailName',
  'sendGridPassword',
  'dashboardSentryUrl',
  'webSentryUrl',
  'apiSentryUrl',
  'customerAppSentryUrl',
  'restaurantAppSentryUrl',
  'riderAppSentryUrl',
  'googleApiKey',
  'googleMapLibraries',
  'googleColor',
  'cloudinaryUploadUrl',
  'cloudinaryApiKey',
  'webAmplitudeApiKey',
  'appAmplitudeApiKey',
  'webClientID',
  'androidClientID',
  'iOSClientID',
  'expoClientID',
  'firebaseKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'msgSenderId',
  'appId',
  'measurementId',
  'vapidKey',
  'scalewayEmailApiKey',
  'scalewayEmailProjectId',
  'scalewayEmailSendingDomain',
  'scalewayEmailFromName',
  'scalewayEmailEnabled',
  'scalewaySmsApiKey',
  'scalewaySmsProjectId',
  'scalewaySmsServiceId',
  'scalewaySmsDefaultSender',
  'scalewaySmsEnabled',
  'fcmServerKey',
  'fcmDatabaseUrl',
  'fcmEnabled',
];

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI missing from .env');

  await mongoose.connect(uri);
  const configurations = mongoose.connection.collection('configurations');
  const unset = Object.fromEntries(REMOVED_FIELDS.map((field) => [field, '']));
  const result = await configurations.updateMany({}, { $unset: unset });

  console.log(
    `Removed legacy configuration secrets from ${result.modifiedCount} configuration document(s).`,
  );
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
