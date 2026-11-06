'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const readme = fs.readFileSync(path.join(root, '..', 'README.md'), 'utf8');

test('About the Designer exposes the supplied direct profile, social and email links', () => {
  assert.match(html, /id="aboutDesignerBtn"/);
  assert.match(html, /id="aboutDesignerModal"/);
  assert.match(html, /https:\/\/github\.com\/LAA-8DESIGNER/);
  assert.match(html, /https:\/\/youtube\.com\/@laa8_designer\?si=kLPtgy1XvOfegnrV/);
  assert.match(html, /https:\/\/www\.instagram\.com\/praka\.shh0001\?exln=MWgyN3F3Mnl1YXNiZw==/);
  assert.match(html, /mailto:prakashh93168@gmail\.com/);
  assert.match(html, /PRAKASHH/);
  assert.match(html, /Dump Folder — Poore Folder Ka Dump/);
});

test('About modal does not reset the workflow and static profile images are served locally without cache', () => {
  assert.match(app, /function openAboutDesigner\(\)/);
  assert.match(app, /function closeAboutDesigner\(\)/);
  assert.match(app, /localStorage\.setItem\(APP_STATE_KEY/);
  assert.match(app, /state\.workflowStage===3/);
  assert.match(server, /\/assets\/prakashh-profile\.jpg/);
  assert.match(server, /\/assets\/prakashh-signature\.png/);
  assert.match(server, /Cache-Control': 'no-store'/);
});

test('Quick-start and permissive reuse terms are documented', () => {
  assert.match(readme, /git clone https:\/\/github\.com\/LAA-8DESIGNER\/DFOL\.git/);
  assert.match(readme, /Attribution is optional, not required/);
  assert.match(readme, /localStorage/);
});
