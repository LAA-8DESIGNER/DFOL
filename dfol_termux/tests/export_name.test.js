
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');

test('export name is not persisted or restored from old browser state', () => {
  assert.doesNotMatch(app, /exportFolderName:\$\('exportFolderName'\)\?\.value\|\|''/);
  assert.match(app, /\$\('exportFolderName'\)\.value='';/);
  assert.match(app, /fresh name; prior export names must never be restored/);
});

test('export name check API and server-side duplicate guard exist', () => {
  assert.match(server, /\/api\/check-export-name/);
  assert.match(server, /async function checkExportFolderName/);
  assert.match(server, /already exists in \$\{OUTPUT_ROOT\}/);
  assert.doesNotMatch(server, /outDir = path\.join\(OUTPUT_ROOT, `\$\{folderName\}_\$\{suffix\+\+\}`\)/);
});

test('export form explains available and duplicate names and disables export until verified', () => {
  assert.match(html, /id="exportNameAvailability"/);
  assert.match(app, /Already exists — choose a new name/);
  assert.match(app, /Available —/);
  assert.match(app, /const nameReady=exportNameStatusState==='available'/);
});
