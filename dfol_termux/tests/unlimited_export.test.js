 'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const readme = fs.readFileSync(path.join(root, '..', 'README.md'), 'utf8');
const docs = fs.readFileSync(path.join(root, '..', 'DFOL_COMPLETE_DOCUMENTATION.txt'), 'utf8');

test('DFOL no longer defines file-count, file-size, request-body, tree-count or tree-depth caps', () => {
  assert.doesNotMatch(server, /MAX_FILES|MAX_FILE_BYTES|MAX_BODY|MAX_TREE_NODES|MAX_TREE_DEPTH/);
  assert.doesNotMatch(server, /Safety limit reached \(/);
  assert.doesNotMatch(server, /File exceeds 2 MiB scan limit/);
  assert.doesNotMatch(server, /Request body too large/);
});

test('large-export disclaimer is shown before export and while export runs', () => {
  assert.match(app, /EXPORT_PERFORMANCE_WARNING/);
  assert.match(app, /showExportPerformanceNotice/);
  assert.match(app, /setExportPerformanceNotice\(true\)/);
  assert.match(html, /id="exportPerformanceNotice"/);
  assert.match(readme, /no application-level file-count or file-size ceiling/i);
  assert.match(docs, /VERSION 8\.0 — NO FIXED FILE COUNT\/SIZE CAPS/);
});

test('tree helpers use iterative traversal rather than node/depth cutoffs', () => {
  assert.match(server, /const stack = \[\{ dir:target, node:rootNode, inheritedMatch:rootMatch \}\]/);
  assert.match(server, /function renderTreeText\(rootNode\)/);
  assert.match(server, /function renderTreeText\(rootNode\)/);
  assert.match(server, /const stack = \[\{type:'node',node:rootNode,prefix:'',last:true,root:true\}\]/);
  assert.doesNotMatch(server, /node\.truncated = true/);
});
