const fs = require('fs');
const path = require('path');

// Regression guards for the locale files in ../ (store translations).
//
// These cover two bug classes that have actually shipped here:
//   1. A malformed locale file (e.g. a missing trailing comma) that breaks the
//      module at import time — see commit "Fix admin hydration and language
//      syntax".
//   2. Un-normalized translation keys (spaces / Title Case) creeping back in
//      after the camelCase normalization in "Normalize translation keys to
//      camelCase across app, rider, store".

const LANG_DIR = path.join(__dirname, '..');

const localeFiles = fs
  .readdirSync(LANG_DIR)
  .filter((file) => file.endsWith('.js') && file !== 'index.js');

/** Imports a locale module and returns its single exported translation object. */
const loadLocale = (file) => {
  const code = path.basename(file, '.js');
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const mod = require(path.join(LANG_DIR, file));
  return mod[code] ?? mod.default ?? Object.values(mod)[0];
};

describe('store translations', () => {
  it('discovers at least the English reference locale', () => {
    expect(localeFiles).toContain('en.js');
    expect(localeFiles.length).toBeGreaterThan(1);
  });

  it.each(localeFiles)('%s parses and exports a non-empty object', (file) => {
    const locale = loadLocale(file);
    expect(locale).not.toBeNull();
    expect(typeof locale).toBe('object');
    expect(Object.keys(locale).length).toBeGreaterThan(0);
  });

  it.each(localeFiles)('%s has no whitespace in any translation key', (file) => {
    const locale = loadLocale(file);
    const spacedKeys = Object.keys(locale).filter((key) => /\s/.test(key));
    expect(spacedKeys).toEqual([]);
  });
});
