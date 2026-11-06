'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

test('raw-export challenge is a 45-second ephemeral 256-bit code, digest-only in server state', () => {
  assert.match(server, /const OTP_TTL_MS = 45_000/);
  assert.match(server, /crypto\.randomBytes\(32\)\.toString\('hex'\)/);
  assert.match(server, /otpDigest/);
  assert.match(server, /expiresAt = Date\.now\(\) \+ OTP_TTL_MS/);
  assert.match(server, /\/api\/unmask\/otp\/cancel/);
  assert.match(server, /\/api\/unmask\/otp\/verify/);
  assert.doesNotMatch(server, /securityChallenges\.set\([^\n]*\botp\s*,/);
  assert.match(server, /Cache-Control': 'no-store'/);
  assert.match(app, /expiresInSeconds\)\|\|45/);
  assert.match(app, /\^\[A-F0-9\]\{64\}\$/);
  assert.match(app, /localStorage\.setItem\(APP_STATE_KEY/);
  assert.doesNotMatch(app, /localStorage\.setItem\([^\n]*(otp|rawOtpInput|approvalToken)/i);
});

test('screen-lock, biometric and passkey verification endpoints and browser hooks are removed', () => {
  assert.doesNotMatch(server, /\/api\/unmask\/device\/(options|register|verify)/);
  assert.doesNotMatch(server, /DEVICE_LOCK_FILE|writeDeviceCredentials|readDeviceCredentials|webauthn/i);
  assert.doesNotMatch(app, /PublicKeyCredential|navigator\.credentials|doDeviceLockVerification|showVerificationChoice/);
  assert.match(readme, /No device-lock, fingerprint, biometric or passkey flow is included/);
});

test('four workflow stages expose bottom Back/Next navigation and persistent stage restoration', () => {
  for (const id of ['workflowNav', 'workflowBack', 'workflowNext', 'workflowStepLabel', 'workflowNavHint', 'exportResultPage']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(app, /function updateWorkflowNavigation\(\)/);
  assert.match(app, /async function setWorkflowStage\(stage\)/);
  assert.match(app, /workflowStage,view:/);
  assert.match(app, /state\.workflowStage===1&&selectedFolder/);
  assert.match(app, /state\.workflowStage===3/);
});


test('regular export generates one canonical Tree.txt and packages that same file in ZIP', () => {
  assert.doesNotMatch(server, /Archive payload: DFOL_export\.zip/);
  assert.match(server, /outputTree\(outDir, new Set\(\['Tree\.txt', 'DFOL_export\.zip'\]\)\)/);
  assert.match(server, /runZip\(zipFile, outDir, \[\.\.\.zipItems, 'Tree\.txt'\]\)/);
  assert.ok(server.indexOf('await fsp.writeFile(treePath, `DFOL EXPORT TREE') < server.indexOf("await runZip(zipFile, outDir, [...zipItems, 'Tree.txt'])"));
});
