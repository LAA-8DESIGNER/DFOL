'use strict';

/*
 * DFOL Generated / Cache / Build Artifact Filter Pack
 * Version: 2026.10.17
 *
 * This is a broad, offline, cross-ecosystem heuristic catalog. It is inspired by
 * public ignore conventions maintained by github/gitignore for languages,
 * build tools, operating systems, IDEs, test runners, and frameworks.
 *
 * Important: no universal list can recognize every custom generator. These are
 * candidates, not proof that a file is disposable. DFOL's global toggle lets a
 * user include candidates for scanning, and an individually unticked generated
 * item can be preserved unchanged as a raw ZIP override.
 */

const FILTER_PACK_VERSION = '2026.10.17';

const DIRECTORY_GROUPS = [
  {
    kind: 'CACHE',
    reason: 'Common cache, interpreter cache, or temporary working directory.',
    names: [
      'cache','caches','cached','cache_data','cache_files','cache-files','cache-data',
      '.cache','.pytest_cache','.mypy_cache','.ruff_cache','.pyright','.pytype',
      '.hypothesis','.nox','.tox','.uv-cache','.pdm-cache','.pip-cache','.pytest',
      '__pycache__','__pypackages__','.ipynb_checkpoints','.ipython','ipython-profile',
      '.nyc_output','.mocha-cache','.jest','.vitest','.karma','.sass-cache','.less-cache',
      '.parcel-cache','.vite','.vite-temp','.rollup.cache','.webpack','.cache-loader',
      '.turbo','.eslintcache','.stylelintcache','.svelte-kit/cache','.next/cache',
      '.nuxt/cache','.angular/cache','.astro/cache','.docusaurus/cache','.gatsby-cache',
      '.gradle','.kotlin','.m2','.ivy2','.bloop','.metals','.pub-cache','.pub',
      '.dart_tool','.swiftpm','.build','.cxx','.externalnativebuild',
      '.xcodebuild','.deriveddatacache','.godot','.import','.godot/imported',
      '.terraform','.terragrunt-cache','.pulumi','.serverless','.firebase','.vercel',
      '.netlify','.wrangler','.amplify','.aws-sam','.dynamodb','.docker-cache',
      '.dvc-cache','.metaflow','.snakemake','.nextflow','.huggingface','.keras','.torch',
      '.julia','.conda','.r-cache','.rdata-cache','.rproj.user','.coverage-cache',
      '.localhistory','.history','.vscode-test','.fleet-cache','.zed-cache',
      '.tmp','.temp','.temporary','tmp','temp','temporary','tempfiles','temporary_files',
      'cache_dir','cachedir','cache-directory','download-cache','http-cache','webpack-cache',
      'query-cache','response-cache','thumbnail-cache','thumb-cache','thumbs-cache',
      '.thumbnail-cache','.thumbnails','.thumbs','__cache__','__cache','__caches__',
      '.fseventsd','.spotlight-v100','.documentrevisions-v100','.temporaryitems',
      '.trashes','.trash','.trash-1000','$recycle.bin','system volume information',
      'lost+found','__macosx','temporary items','network trash folder'
    ],
    regex: [
      /^\.cache[-_.].+/i, /^.+[-_.]cache$/i, /^cache[-_.].+/i,
      /^pythonenv[^/]*$/i, /^\.python-env[^/]*$/i, /^\.virtualenv[^/]*$/i,
      /^\.ruff_cache(?:_.*)?$/i, /^\.pytest_cache(?:_.*)?$/i,
      /^\.mypy_cache(?:_.*)?$/i, /^\.ipynb_checkpoints(?:_.*)?$/i,
      /^\.vite(?:-.*)?$/i, /^\.parcel-cache(?:-.*)?$/i
    ]
  },
  {
    kind: 'DEPENDENCY',
    reason: 'Installed, vendored, downloaded, or tool-managed dependency directory.',
    names: [
      'node_modules','bower_components','jspm_packages','web_modules','vendor',
      'vendor_modules','_vendor','third_party','third-party','thirdparty','deps',
      'dependencies','packages_cache','site-packages','dist-packages','eggs','.eggs',
      'pip-wheel-metadata','wheels','wheelhouse','.venv','venv','env','virtualenv',
      '.virtualenv','python-env','python_env','pythonenv','conda-env','conda_env',
      '.conda-env','poetry-venv','pypoetry-venv','bower_components','jspm_packages',
      '.pnpm-store','.npm','.bun','.pub-cache','.pub','.pnp','.pnp.loader.mjs',
      'pods','carthage','checkouts','frameworks_cache','gradle-wrapper-dists',
      'repository_cache','go-mod-cache','gopath/pkg/mod','cargo-registry','cargo-git',
      'renv/library','packrat/lib','r-library','r_libs','r-libs','site-packages-cache',
      'nuget-packages','packages-cache','composer-cache','pear-cache','gem-cache',
      'bundle-cache','vendor/bundle','vendor/cache','bower_cache','bower-cache',
      'pip-cache','pip_cache','uv-cache','uv_cache','maven-repository','m2-repository',
      'ivy-cache','ivy_cache','sbt-cache','sbt_cache','cabal-store','stack-work'
    ],
    regex: [
      /^pythonenv[^/]*$/i, /^venv[-_.].*$/i, /^env[-_.]venv$/i,
      /^vendor[-_.]cache$/i, /^.*-site-packages$/i, /^.*-dist-packages$/i
    ]
  },
  {
    kind: 'BUILD',
    reason: 'Build, compilation, packaging, publishing, or generated output directory.',
    names: [
      'build','builds','dist','target','out','bin','obj','bld','_build','.build',
      'build_output','build-output','build-artifacts','build_artifacts','artifacts',
      '.artifacts','publish','published','release','releases','debug','Debug','Release',
      'Generated_Code','Generated Files','generated','generated_files','generated-files',
      '__generated__','.generated','.gen','gen','autogenerated','auto-generated',
      'auto_generated','codegen','code-gen','code_gen','generated-code','generated_code',
      'genfiles','generated-sources','generated_sources','generated-resources',
      'generated_resources','staticfiles','site','_site','site-packages-output',
      'storybook-static','storybook-out','coverage','coverage_html','htmlcov','reports',
      'test-results','test_results','TestResults','allure-results','allure-report',
      'playwright-report','benchmarkdotnet.artifacts','testoutput','test-output',
      'test_output','surefire-reports','failsafe-reports','junit-results','junit-reports',
      'doc-build','docs-build','api-docs','apidocs','doc-api','compiled','compiled-output',
      'intermediates','transforms','outputs','captures','ephemeral','DerivedData',
      'DerivedDataCache','Binaries','Intermediate','Saved','Temp','Logs','Obj',
      'Builds','AppPackages','BundleArtifacts','GeneratedArtifacts','Generated_Code',
      'ClientBin','publish-output','publish_output','deployment','deploy-output',
      'deployment-artifacts','lambda-build','lambda-builds','layer-build','package-output',
      'packaged','packages-output','release-build','debug-build','cmake-build-debug',
      'cmake-build-release','meson-private','meson-logs','autom4te.cache','CMakeFiles',
      'bazel-out','bazel-bin','bazel-testlogs','buck-out','pants.d','pants-out',
      'gradle-build','cargo-target','rust-target','go-build','go-cache','npm-cache',
      'pip-build','wheel-build','sphinx-build','doctrees','.doctrees','_static-build',
      'vuepress-dist','docusaurus-build','gatsby-public','nuxt-dist','next-build',
      'angular-build','svelte-build','astro-build','vite-build','parcel-build',
      'webpack-build','rollup-build','browser-build','web-build','frontend-build',
      'backend-build','function-build','functions-build','serverless-build'
    ],
    regex: [
      /^cmake-build-.+$/i, /^build[-_.](?:debug|release|prod|production|dev|debugging)$/i,
      /^(?:debug|release|prod|production|staging)[-_ ]?(?:x64|x86|arm64|arm|win32)$/i,
      /^.+\.egg-info$/i, /^.+\.dist-info$/i, /^.+\.egg$/i,
      /^.+\.app$/i, /^.+\.framework$/i, /^.+\.dSYM$/i,
      /^generated(?:[-_. ].*)?$/i, /^autogenerated(?:[-_. ].*)?$/i,
      /^codegen(?:[-_. ].*)?$/i, /^.+-generated$/i, /^.+_generated$/i
    ]
  },
  {
    kind: 'TEST',
    reason: 'Test runner, coverage, benchmark, or automated QA output.',
    names: [
      'coverage','coverage-reports','coverage_reports','htmlcov','.nyc_output',
      'test-results','test_results','TestResults','test-reports','test_reports',
      'playwright-report','playwright-results','cypress/videos','cypress/screenshots',
      'allure-results','allure-report','junit','junit-results','junit-reports',
      'surefire-reports','failsafe-reports','nosetests','test-output','test_output',
      'benchmark-results','benchmark_results','benchmarks-output','performance-results',
      'test-artifacts','test_artifacts','pytest-cache','jest-cache','vitest-cache',
      'karma-cache','mocha-cache','robot-results','robot-reports','robot-output',
      'behave-results','cucumber-reports','cucumber-results','spec-results','reports'
    ],
    regex: [
      /^coverage[-_.].*$/i, /^test[-_.](?:results|reports|output|artifacts|logs)$/i,
      /^(?:jest|vitest|karma|mocha)[-_]cache$/i, /^allure[-_](?:results|report)$/i
    ]
  },
  {
    kind: 'ML / DATA',
    reason: 'Machine-learning run logs, model/checkpoint caches, or experiment artifacts.',
    names: [
      'wandb','mlruns','lightning_logs','tensorboard','runs','ray_results','ray_tmp',
      'spark-warehouse','checkpoints','checkpoint','checkpoints_tmp','model_cache',
      'models_cache','dataset_cache','datasets_cache','transformers_cache','hf_cache',
      'huggingface_cache','eval_results','eval-results','training_logs','training-logs',
      'experiment_logs','experiment-logs','experiment_runs','experiment-runs',
      'model_outputs','model-outputs','prediction_outputs','prediction-outputs',
      'inference_cache','inference-cache','feature_cache','feature-cache','dvc-cache',
      '.metaflow','metaflow','snakemake-logs','nextflow-work','nextflow-cache',
      'prefect-storage','airflow-logs','mlflow-artifacts','keras-cache','torch-cache',
      'transformers-cache','datasets-cache','huggingface-datasets','__rdata__'
    ],
    regex: [
      /^lightning_logs(?:_.*)?$/i, /^mlruns(?:_.*)?$/i, /^wandb(?:_.*)?$/i,
      /^(?:training|inference|prediction|experiment)[-_](?:logs|runs|outputs|cache)$/i
    ]
  },
  {
    kind: 'IDE',
    reason: 'IDE-generated workspace state, index, local history, or temporary metadata.',
    names: [
      '.vs','.history','.localhistory','.vscode-test','.fleet-cache','.metadata',
      '.settings','.idea-caches','.idea-system','.replit_cache','history','local history',
      'workspaceStorage','workspace-storage','Backups','backup-history','LocalHistory',
      'local-history','Index','Indexes','index-cache','indexes-cache','symbol-cache',
      'language-server-cache','language_server_cache','server-cache','server_cache',
      '.pydevproject-cache','ipch','$tf','_resharper','resharper-cache','resharper'
    ],
    regex: [
      /^\.idea[-_.](?:system|cache|caches|workspace)$/i,
      /^\.history(?:[-_.].*)?$/i, /^\.localhistory(?:[-_.].*)?$/i,
      /^_resharper.*$/i, /^\.resharper.*$/i, /^\.vs(?:[-_.].*)?$/i
    ]
  },
  {
    kind: 'VCS META',
    reason: 'Version-control internals rather than project source files.',
    names: ['.git','.svn','.hg','.bzr','.fossil-settings','.pijul','.darcs'],
    regex: []
  }
];

// These path patterns cover generated areas that share a parent folder with
// useful project configuration or source files (for example .idea/workspace.xml).
const PATH_DIRECTORY_RULES = [
  { re: /(?:^|\/)\.yarn\/(?:cache|unplugged)(?:\/|$)/i, kind:'DEPENDENCY', reason:'Yarn package cache/unplugged dependencies.' },
  { re: /(?:^|\/)\.cargo\/(?:registry|git)(?:\/|$)/i, kind:'DEPENDENCY', reason:'Downloaded Rust crate registry or Git checkout cache.' },
  { re: /(?:^|\/)\.m2\/repository(?:\/|$)/i, kind:'DEPENDENCY', reason:'Downloaded Maven repository dependencies.' },
  { re: /(?:^|\/)\.ivy2\/cache(?:\/|$)/i, kind:'DEPENDENCY', reason:'Downloaded Ivy dependency cache.' },
  { re: /(?:^|\/)\.gradle\/(?:caches|wrapper\/dists)(?:\/|$)/i, kind:'CACHE', reason:'Gradle build cache or wrapper distribution.' },
  { re: /(?:^|\/)\.idea\/(?:caches|system|shelf|workspaceStorage)(?:\/|$)/i, kind:'IDE', reason:'JetBrains IDE workspace/cache state.' },
  { re: /(?:^|\/)\.idea\/(?:workspace\.xml|tasks\.xml|usage\.statistics\.xml|contentModel\.xml|dataSources\.ids|dynamic\.xml)$/i, kind:'IDE', reason:'JetBrains IDE user-specific or generated workspace metadata.' },
  { re: /(?:^|\/)\.vscode\/(?:\.history|\.ropeproject|\.browse\.c_cpp\.db|ipch)(?:\/|$)/i, kind:'IDE', reason:'VS Code extension/cache workspace data.' },
  { re: /(?:^|\/)\.vscode\/(?:settings\.json|launch\.json|tasks\.json|extensions\.json)$/i, kind:'IDE', reason:'Editor-local workspace configuration; review before excluding if it is shared project configuration.' , lowConfidence:true},
  { re: /(?:^|\/)(?:ios|macos)\/Flutter\/ephemeral(?:\/|$)/i, kind:'BUILD', reason:'Flutter-generated ephemeral platform files.' },
  { re: /(?:^|\/)ios\/Pods(?:\/|$)/i, kind:'DEPENDENCY', reason:'CocoaPods installed dependencies.' },
  { re: /(?:^|\/)android\/(?:\.gradle|\.cxx|\.externalNativeBuild|build)(?:\/|$)/i, kind:'BUILD', reason:'Android/Gradle generated build output.' },
  { re: /(?:^|\/)(?:docs?|documentation)\/(?:_build|\.doctrees|site)(?:\/|$)/i, kind:'BUILD', reason:'Generated documentation build output.' },
  { re: /(?:^|\/)\.dvc\/cache(?:\/|$)/i, kind:'CACHE', reason:'DVC content-addressed data cache.' },
  { re: /(?:^|\/)renv\/library(?:\/|$)/i, kind:'DEPENDENCY', reason:'R renv project library.' },
  { re: /(?:^|\/)packrat\/lib(?:\/|$)/i, kind:'DEPENDENCY', reason:'R Packrat installed package library.' },
  { re: /(?:^|\/)\.terraform\.d(?:\/|$)/i, kind:'CACHE', reason:'Terraform plugin/cache data.' },
  { re: /(?:^|\/)(?:\.next|\.nuxt|\.svelte-kit|\.angular|\.astro|\.docusaurus|\.gatsby-cache|\.parcel-cache|\.turbo|\.serverless|\.firebase|\.vercel|\.netlify|\.wrangler|\.amplify|\.aws-sam)(?:\/|$)/i, kind:'BUILD', reason:'Framework/deployment-generated output or cache.' },
  { re: /(?:^|\/)(?:cmake-build-[^/]+|CMakeFiles|meson-private|meson-logs|autom4te\.cache|bazel-out|bazel-bin|bazel-testlogs|buck-out|pants\.d)(?:\/|$)/i, kind:'BUILD', reason:'Native build-system intermediates.' }
];

const EXACT_GENERATED_FILES = new Map([
  ['.ds_store', {kind:'OS', reason:'macOS Finder metadata.'}],
  ['thumbs.db', {kind:'OS', reason:'Windows thumbnail cache.'}],
  ['ehthumbs.db', {kind:'OS', reason:'Windows thumbnail cache.'}],
  ['ehthumbs_vista.db', {kind:'OS', reason:'Windows thumbnail cache.'}],
  ['desktop.ini', {kind:'OS', reason:'Windows folder metadata.'}],
  ['.directory', {kind:'OS', reason:'Desktop-environment folder metadata.'}],
  ['.localized', {kind:'OS', reason:'macOS folder localization metadata.'}],
  ['.eslintcache', {kind:'CACHE', reason:'ESLint incremental cache.'}],
  ['.stylelintcache', {kind:'CACHE', reason:'Stylelint incremental cache.'}],
  ['.tsbuildinfo', {kind:'CACHE', reason:'TypeScript incremental build cache.'}],
  ['.node_repl_history', {kind:'CACHE', reason:'Node.js REPL history.'}],
  ['.yarn-integrity', {kind:'CACHE', reason:'Yarn install integrity metadata.'}],
  ['.flutter-plugins', {kind:'GENERATED', reason:'Flutter plugin registration metadata.'}],
  ['.flutter-plugins-dependencies', {kind:'GENERATED', reason:'Flutter plugin dependency metadata.'}],
  ['generatedpluginregistrant.java', {kind:'GENERATED', reason:'Generated Flutter/Android plugin registration source.'}],
  ['generatedpluginregistrant.swift', {kind:'GENERATED', reason:'Generated Flutter/iOS plugin registration source.'}],
  ['generatedpluginregistrant.h', {kind:'GENERATED', reason:'Generated Flutter platform registration header.'}],
  ['generatedpluginregistrant.cc', {kind:'GENERATED', reason:'Generated Flutter platform registration source.'}],
  ['generated_plugins.cmake', {kind:'GENERATED', reason:'Generated Flutter CMake plugin list.'}],
  ['compile_commands.json', {kind:'BUILD', reason:'Generated C/C++ compilation database.'}],
  ['coverage.xml', {kind:'TEST', reason:'Code-coverage report.'}],
  ['coverage.json', {kind:'TEST', reason:'Code-coverage report.'}],
  ['coverage.info', {kind:'TEST', reason:'LCOV coverage report.'}],
  ['lcov.info', {kind:'TEST', reason:'LCOV coverage report.'}],
  ['nosetests.xml', {kind:'TEST', reason:'Test-runner result report.'}],
  ['pytestdebug.log', {kind:'TEST', reason:'Pytest diagnostic log.'}],
  ['gradletasknamecache', {kind:'CACHE', reason:'Gradle task-name cache.'}],
  ['.gradletasknamecache', {kind:'CACHE', reason:'Gradle task-name cache.'}],
  ['pip-wheel-metadata', {kind:'GENERATED', reason:'Python packaging-generated metadata.'}],
  ['.python-version-cache', {kind:'CACHE', reason:'Python tooling cache marker.'}]
]);

const FILE_RULES = [
  { kind:'CACHE', reason:'Compiled Python bytecode or interpreter extension.', re:/\.(?:py[co]|pyd)$/i },
  { kind:'BUILD', reason:'Compiled object, library, executable, or platform build artifact.', re:/\.(?:class|o|obj|a|lib|so(?:\.\d+)*|dylib|dll|exe|ilk|idb|iobj|ipdb|pdb|pch|sbr|tlb|tli|tlh|aps|ncb|opensdf|sdf|vc\.db|opendb|binlog|appx|appxbundle|msi|msix|msm|msp|cab|wasm|dSYM|framework)$/i },
  { kind:'BUILD', reason:'Generated package/archive output that is not plain source text.', re:/\.(?:war|ear|nar|tgz|tar\.gz|tar\.bz2|tar\.xz|7z|rar)$/i },
  { kind:'BUILD', reason:'Generated source map or minified production asset.', re:/\.(?:min\.js|min\.css|js\.map|css\.map)$/i },
  { kind:'GENERATED', reason:'Temporary, editor swap, backup, or autosave file.', re:/(?:\.tmp|\.temp|\.swp|\.swo|\.swn|\.bak|\.backup|\.bkp|\.old|\.orig|\.rej|\.autosave|~)$/i },
  { kind:'CACHE', reason:'Application/tool cache file.', re:/\.(?:cache|cachefile)$/i },
  { kind:'GENERATED', reason:'Build/test/tool log or trace output.', re:/\.(?:log|trace|prof|profile|stackdump|pid|pid\.lock)$/i },
  { kind:'TEST', reason:'Test coverage or test-run output artifact.', re:/\.(?:lcov|coverprofile|cov|coverage|trx|coveragexml)$/i },
  { kind:'BUILD', reason:'Generated build-system metadata or incremental state.', re:/\.(?:tsbuildinfo|ilk|rsp|tlog|sbr|idb|iobj|ipch|cachefile)$/i },
  { kind:'OS', reason:'OS-specific temporary metadata files.', re:/^\._.+$/i },
  { kind:'OS', reason:'Office/LibreOffice lock/owner file.', re:/^(?:~\$.*|\.~lock\..*#)$/i },
  { kind:'CACHE', reason:'Numbered package-manager debug log.', re:/^(?:npm|yarn|pnpm|lerna)-debug\.log(?:\.\d+)?$/i },
  { kind:'CACHE', reason:'Python/package-manager/debug cache metadata.', re:/^(?:pip|uv|poetry|pdm|pytest|tox|nox|mypy|ruff|pyright|webpack|vite|parcel|rollup|eslint|stylelint)[-_].*(?:cache|debug|log).*$/i },
  { kind:'GENERATED', reason:'Generated code file (common protocol, GraphQL, Flutter, or serializer suffix).', re:/(?:\.freezed\.dart|\.mocks\.dart|\.gr\.dart|\.g\.dart|\.g\.\w+\.dart|\.pb\.go|_grpc\.pb\.go|\.pb\.js|\.pb\.ts|_pb2\.py|_pb2_grpc\.py|\.generated\.(?:js|ts|tsx|jsx|dart|cs|java|kt|py|go|rs)|\.designer\.cs|\.g\.cs|\.g\.i\.cs|\.assemblyinfo\.cs|\.assemblyattributes\.cs)$/i },
  { kind:'GENERATED', reason:'Timestamped Vite/Vue configuration produced during build.', re:/^(?:vite|vitest|vue|nuxt|webpack|rollup)\.config\.[cm]?[jt]s\.timestamp-.*$/i },
  { kind:'GENERATED', reason:'Python compiled/generated cache output filename.', re:/^(?:hs_err_pid\d+|replay_pid\d+|core\.\d+|npm-debug\.log\.\d+)$/i },
  { kind:'GENERATED', reason:'Machine-specific editor or test output file.', re:/^(?:\.coverage(?:\..*)?|coverage[-_.].*\.(?:json|xml|info|txt)|test-results?[-_.].*\.(?:xml|json|txt)|junit[-_.].*\.xml)$/i },
  { kind:'GENERATED', reason:'Go/native build or test artifact.', re:/^(?:[^/]+\.test|coverage\..*|profile\.cov|test\.out|build\.out)$/i },
  { kind:'GENERATED', reason:'Operating-system crash or temporary report.', re:/^(?:mono_crash\..*|.*\.stackdump|gmon\.out|core(?:\.\d+)?)$/i }
];

// Path-specific file rules prevent excluding whole IDE/config directories.
const PATH_FILE_RULES = [
  { re: /(?:^|\/)\.idea\/(?:workspace\.xml|tasks\.xml|usage\.statistics\.xml|contentModel\.xml|dynamic\.xml|dataSources\.ids)$/i, kind:'IDE', reason:'JetBrains user workspace state.' },
  { re: /(?:^|\/)\.yarn\/install-state\.gz$/i, kind:'CACHE', reason:'Yarn install-state cache.' },
  { re: /(?:^|\/)\.pnp\.(?:cjs|js|loader\.mjs)$/i, kind:'DEPENDENCY', reason:'Yarn Plug’n’Play generated dependency loader.' },
  { re: /(?:^|\/)android\/local\.properties$/i, kind:'IDE', reason:'Machine-local Android SDK path configuration.' },
  { re: /(?:^|\/)\.Rproj\.user(?:\/|$)/i, kind:'IDE', reason:'RStudio local project state.' },
  { re: /(?:^|\/)\.terraform\/.*\.(?:tfstate|tfstate\.backup)$/i, kind:'CACHE', reason:'Terraform local state/backup (may contain secrets; inspect carefully).' }
];

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '').replace(/\/{2,}/g, '/');
}
function normalizedName(value) { return String(value || '').replace(/\\/g, '/').split('/').pop().toLowerCase(); }
function matchesGroup(name, relativePath, groups) {
  const low = normalizedName(name);
  const rel = normalizePath(relativePath).toLowerCase();
  for (const group of groups) {
    if (group.names.some(n => n.toLowerCase() === low)) return { kind:group.kind, reason:group.reason, confidence:'high', ruleId:`dir:${group.kind.toLowerCase()}:${low}` };
    if (group.regex.some(re => re.test(low))) return { kind:group.kind, reason:group.reason, confidence:'medium', ruleId:`dir-regex:${group.kind.toLowerCase()}` };
  }
  for (const rule of PATH_DIRECTORY_RULES) {
    if (rule.re.test(rel)) return { kind:rule.kind, reason:rule.reason, confidence:'high', ruleId:`path-dir:${rule.kind.toLowerCase()}` };
  }
  return null;
}
function classifyGeneratedDirectory(name, relativePath = '') {
  return matchesGroup(name, relativePath, DIRECTORY_GROUPS);
}
function classifyGeneratedFile(name, relativePath = '') {
  const low = normalizedName(name);
  const rel = normalizePath(relativePath);
  const pathLow = rel.toLowerCase();
  // Directory-path rules apply to nested files too, without needing to match a filename.
  for (const rule of PATH_DIRECTORY_RULES) {
    const m = rule.re.exec(pathLow);
    if (m) return { kind:rule.kind, reason:rule.reason, confidence:'high', ruleId:`path-dir:${rule.kind.toLowerCase()}` };
  }
  for (const rule of PATH_FILE_RULES) {
    if (rule.re.test(pathLow)) return { kind:rule.kind, reason:rule.reason, confidence:rule.lowConfidence?'low':'high', ruleId:`path-file:${rule.kind.toLowerCase()}` };
  }
  const exact = EXACT_GENERATED_FILES.get(low);
  if (exact) return { ...exact, confidence:'high', ruleId:`file-exact:${low}` };
  for (const rule of FILE_RULES) {
    if (rule.re.test(low)) return { kind:rule.kind, reason:rule.reason, confidence:'medium', ruleId:`file-re:${rule.kind.toLowerCase()}` };
  }
  return null;
}
function kindForUi(classification) {
  return classification && classification.kind ? classification.kind : null;
}
function filterCatalogSummary() {
  const exactDirectoryNames = DIRECTORY_GROUPS.reduce((n,g)=>n+g.names.length,0);
  const directoryRegexCount = DIRECTORY_GROUPS.reduce((n,g)=>n+g.regex.length,0);
  return {
    version:FILTER_PACK_VERSION,
    directoryGroups:DIRECTORY_GROUPS.length,
    directoryNameRules:exactDirectoryNames,
    directoryRegexRules:directoryRegexCount,
    pathDirectoryRules:PATH_DIRECTORY_RULES.length,
    exactFileRules:EXACT_GENERATED_FILES.size,
    fileRegexRules:FILE_RULES.length,
    pathFileRules:PATH_FILE_RULES.length,
    categories:[...new Set(DIRECTORY_GROUPS.map(g=>g.kind).concat(FILE_RULES.map(r=>r.kind)))].sort(),
    disclaimer:'Heuristic cross-ecosystem catalog, not an exhaustive universal standard. Review candidates because valid source/data can be named like build/cache folders.'
  };
}

module.exports = {
  FILTER_PACK_VERSION,
  classifyGeneratedDirectory,
  classifyGeneratedFile,
  kindForUi,
  filterCatalogSummary
};
