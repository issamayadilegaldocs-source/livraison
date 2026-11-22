#!/usr/bin/env node
/**
 * sync-firebase-key-base64.js
 *
 * Reads FIREBASE_PRIVATE_KEY from a .env file and writes its base64-encoded
 * form into FIREBASE_PRIVATE_KEY_BASE64 in the same file.
 *
 * Mirrors what fcm.provider.ts does at runtime:
 *   - FIREBASE_PRIVATE_KEY may be wrapped in single/double quotes -> stripped
 *   - literal "\n" escapes are turned into real newlines so the decoded
 *     value is a valid PEM that firebase-admin's cert() accepts
 *
 * Usage:
 *   node tools/sync-firebase-key-base64.js [path/to/.env]
 *
 * Defaults to the .env next to this package (../.env from tools/).
 */
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.argv[2] || path.join(__dirname, '..', '.env'));

if (!fs.existsSync(envPath)) {
  console.error(`✗ .env file not found: ${envPath}`);
  process.exit(1);
}

const original = fs.readFileSync(envPath, 'utf8');
const lines = original.split('\n');

// Find the FIREBASE_PRIVATE_KEY line (ignore commented-out lines).
const keyLineIndex = lines.findIndex((l) => /^\s*FIREBASE_PRIVATE_KEY\s*=/.test(l));
if (keyLineIndex === -1) {
  console.error('✗ FIREBASE_PRIVATE_KEY not found in .env');
  process.exit(1);
}

// Everything after the first "=" is the raw value.
let rawValue = lines[keyLineIndex].slice(lines[keyLineIndex].indexOf('=') + 1).trim();

if (!rawValue) {
  console.error('✗ FIREBASE_PRIVATE_KEY is empty');
  process.exit(1);
}

// Strip a single pair of surrounding quotes (" or ') if present.
if (
  (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
  (rawValue.startsWith("'") && rawValue.endsWith("'"))
) {
  rawValue = rawValue.slice(1, -1);
}

// Turn literal "\n" escapes into real newlines -> valid PEM.
const pem = rawValue.replace(/\\n/g, '\n');

if (!pem.includes('BEGIN') || !pem.includes('PRIVATE KEY')) {
  console.error('✗ Value does not look like a PEM private key after unescaping.');
  process.exit(1);
}

const base64 = Buffer.from(pem, 'utf8').toString('base64');
const newLine = `FIREBASE_PRIVATE_KEY_BASE64=${base64}`;

// Replace an existing FIREBASE_PRIVATE_KEY_BASE64 line, or append after the key.
const base64LineIndex = lines.findIndex((l) =>
  /^\s*FIREBASE_PRIVATE_KEY_BASE64\s*=/.test(l),
);

if (base64LineIndex === -1) {
  lines.splice(keyLineIndex + 1, 0, newLine);
} else {
  lines[base64LineIndex] = newLine;
}

fs.writeFileSync(envPath, lines.join('\n'));

console.log(`✓ FIREBASE_PRIVATE_KEY_BASE64 written to ${envPath}`);
console.log(`  (${base64.length} base64 chars)`);
