// Generates native projects in an isolated temporary checkout; never changes this project's ios/android.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arrive-native-config-'));
for (const item of [
  'app.json',
  'app.config.ts',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'assets',
  'src',
  'plugins',
  'modules',
]) {
  const source = path.join(root, item);
  if (fs.existsSync(source)) fs.cpSync(source, path.join(dir, item), { recursive: true });
}
fs.symlinkSync(path.join(root, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
console.log(`Checking generated native configuration in ${dir}`);
const result = spawnSync(
  process.execPath,
  [path.join(root, 'node_modules/expo/bin/cli'), 'prebuild', '--platform', 'ios', '--no-install'],
  { cwd: dir, env: { ...process.env, CI: '1' }, stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
if (result.status === 0) {
  const assert = require('node:assert/strict');
  const ios = path.join(dir, 'ios', 'Arrive');
  assert.ok(
    fs.readFileSync(path.join(ios, 'Info.plist'), 'utf8').includes('ExpoWidgetsAppGroupIdentifier'),
  );
  assert.ok(
    fs.readFileSync(path.join(ios, 'Info.plist'), 'utf8').includes('NSSupportsLiveActivities'),
  );
  assert.ok(
    fs.readFileSync(path.join(ios, 'Arrive.entitlements'), 'utf8').includes('aps-environment'),
  );
  const groceryIcon = path.join(
    dir,
    'ios',
    'ExpoWidgetsTarget',
    'ArriveWidgetAssets.xcassets',
    'ArrivePresetGrocery.imageset',
    'Contents.json',
  );
  assert.ok(fs.readFileSync(groceryIcon, 'utf8').includes('template-rendering-intent'));
  console.log('Verified App Group, Live Activities, APNs, and matching preset icons.');
}
