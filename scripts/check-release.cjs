const fs = require('node:fs');
const required = [
  'EXPO_PUBLIC_EAS_PROJECT_ID',
  'EXPO_PUBLIC_SUPPORT_EMAIL',
  'EXPO_PUBLIC_PRIVACY_URL',
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Publisher release configuration missing: ${missing.join(', ')}`);
  process.exitCode = 1;
} else
  console.log(
    'Publisher configuration is present. Native device and store checks remain required.',
  );
const config = JSON.parse(fs.readFileSync('app.json', 'utf8'));
if (!config.expo.ios.bundleIdentifier || !config.expo.android.package) {
  console.error('App identifiers are required.');
  process.exitCode = 1;
}
console.log('The local app and native composer require no backend credentials.');
