'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  FILTER_PACK_VERSION,
  classifyGeneratedDirectory,
  classifyGeneratedFile,
  filterCatalogSummary
} = require('../generated_filters');

test('catalog exposes a version and broad filter coverage', () => {
  const summary = filterCatalogSummary();
  assert.equal(summary.version, FILTER_PACK_VERSION);
  assert.ok(summary.directoryNameRules >= 400, `expected broad exact directory list, got ${summary.directoryNameRules}`);
  assert.ok(summary.pathDirectoryRules >= 15);
  assert.ok(summary.fileRegexRules >= 15);
  assert.ok(summary.categories.includes('CACHE'));
  assert.ok(summary.categories.includes('DEPENDENCY'));
  assert.ok(summary.categories.includes('BUILD'));
});

test('common language/framework cache and build directories are identified', () => {
  const cases = [
    ['__pycache__', 'CACHE'], ['.pytest_cache', 'CACHE'], ['.mypy_cache', 'CACHE'],
    ['node_modules', 'DEPENDENCY'], ['vendor', 'DEPENDENCY'], ['Pods', 'DEPENDENCY'],
    ['.gradle', 'CACHE'], ['dist', 'BUILD'], ['target', 'BUILD'], ['DerivedData', 'BUILD'],
    ['.next', 'BUILD'], ['.svelte-kit', 'BUILD'], ['.terraform', 'CACHE'],
    ['wandb', 'ML / DATA'], ['.git', 'VCS META'], ['.vs', 'IDE']
  ];
  for (const [name, kind] of cases) {
    const result = classifyGeneratedDirectory(name, name);
    assert.ok(result, `${name} should be classified`);
    assert.equal(result.kind, kind, `${name} classification`);
  }
});

test('path-aware dependency and platform build rules are identified', () => {
  assert.equal(classifyGeneratedDirectory('caches', '.gradle/caches').kind, 'CACHE');
  assert.equal(classifyGeneratedDirectory('registry', '.cargo/registry').kind, 'DEPENDENCY');
  assert.equal(classifyGeneratedDirectory('repository', '.m2/repository').kind, 'DEPENDENCY');
  assert.equal(classifyGeneratedDirectory('Pods', 'ios/Pods').kind, 'DEPENDENCY');
  assert.equal(classifyGeneratedDirectory('build', 'android/build').kind, 'BUILD');
});

test('generated file patterns catch compiled, temp, logs, coverage, and generated source', () => {
  const cases = [
    ['__init__.cpython-314.pyc', 'CACHE'], ['.DS_Store', 'OS'], ['Thumbs.db', 'OS'],
    ['.eslintcache', 'CACHE'], ['vite.config.ts.timestamp-123', 'GENERATED'],
    ['coverage.xml', 'TEST'], ['npm-debug.log', 'GENERATED'], ['app.g.cs', 'GENERATED'],
    ['object.o', 'BUILD'], ['temp.swp', 'GENERATED'], ['bundle.min.js', 'BUILD']
  ];
  for (const [name, kind] of cases) {
    const result = classifyGeneratedFile(name, name);
    assert.ok(result, `${name} should be classified`);
    assert.equal(result.kind, kind, `${name} classification`);
  }
});

test('path-aware file filters recognize IDE and tool-local generated state', () => {
  assert.equal(classifyGeneratedFile('workspace.xml', '.idea/workspace.xml').kind, 'IDE');
  assert.equal(classifyGeneratedFile('install-state.gz', '.yarn/install-state.gz').kind, 'CACHE');
  assert.equal(classifyGeneratedFile('local.properties', 'android/local.properties').kind, 'IDE');
  assert.equal(classifyGeneratedFile('x.tfstate', '.terraform/x.tfstate').kind, 'CACHE');
});

test('ordinary source files and important config files are not generated filters', () => {
  for (const name of ['app.py', 'README.md', 'package.json', 'package-lock.json', 'requirements.txt', '.env', 'main.ts', 'routes.py']) {
    assert.equal(classifyGeneratedFile(name, name), null, `${name} should not be filtered as generated`);
  }
  for (const name of ['src', 'source', 'assets', 'templates', 'config']) {
    assert.equal(classifyGeneratedDirectory(name, name), null, `${name} should not be filtered as generated`);
  }
});
