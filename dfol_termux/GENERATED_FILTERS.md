# DFOL Generated / Cache Filter Catalog — v7.0 release

The complete executable catalog is in `generated_filters.js`. This document gives operators an index of its intended scope.

## Categories

- **CACHE** — interpreter, compiler, package-manager, framework, download, incremental, and temporary caches.
- **DEPENDENCY** — installed/downloaded/vendored packages and language/runtime dependency trees.
- **BUILD** — compiled outputs, framework build folders, static-site generation, native/mobile compilation, packaging, publish/deployment artifacts.
- **TEST** — test-runner results, coverage reports, test output, snapshots and benchmarking artifacts.
- **ML / DATA** — experiment tracking, run logs, tensorboard/lightning outputs, checkpoints, MLflow/Ray/Snakemake/Nextflow/DVC related working outputs.
- **IDE** — workspace indexes, local history, caches, build/debug state and machine-specific editor files.
- **VCS META** — Git, Mercurial, Subversion, Bazaar and related repository internals.
- **OS** — Finder/Explorer sidecars, thumbnail stores, trash metadata and OS-generated directory state.
- **GENERATED** — code-generation outputs, temporary files, tool logs and compiler-generated source files.

## Representative coverage

**Python / notebooks:** `__pycache__`, `.pyc`, `.pyo`, `.pytest_cache`, `.mypy_cache`, `.ruff_cache`, `.pyright`, `.pytype`, `.hypothesis`, `.tox`, `.nox`, `.venv`, `venv`, `env`, `.ipynb_checkpoints`, `.eggs`, `*.egg-info`, `pip-wheel-metadata`, `htmlcov`.

**JavaScript / TypeScript / web:** `node_modules`, `bower_components`, `jspm_packages`, `web_modules`, `.npm`, `.pnpm-store`, `.yarn/cache`, `.yarn/unplugged`, `.pnp.*`, `.eslintcache`, `.stylelintcache`, `*.tsbuildinfo`, `.parcel-cache`, `.vite`, `.turbo`, `.next`, `.nuxt`, `.svelte-kit`, `.angular`, `.astro`, `.docusaurus`, `.gatsby-cache`, `.serverless`, `.firebase`, `.vercel`, `.netlify`, `.wrangler`, `coverage`, `dist`, `build`, minified bundle/map patterns.

**Java / Kotlin / JVM / Android:** `.gradle`, `.gradle/caches`, `.gradle/wrapper/dists`, `.m2/repository`, `.ivy2/cache`, `.sbt`, `.bloop`, `.metals`, `target`, `out`, `build`, `intermediates`, `transforms`, `outputs`, `.cxx`, `.externalNativeBuild`, generated registration files and compiled artifacts.

**Rust / Go / native / C/C++:** `target`, `.cargo/registry`, `.cargo/git`, `vendor`, `CMakeFiles`, `cmake-build-*`, `meson-private`, `meson-logs`, `autom4te.cache`, `bazel-out`, `bazel-bin`, `bazel-testlogs`, `buck-out`, object files, native libraries, compile databases, `*.test`, coverage/profile output.

**.NET / Visual Studio / IDEs:** `bin`, `obj`, `.vs`, `Debug`, `Release`, `artifacts`, `publish`, `TestResults`, `BenchmarkDotNet.Artifacts`, `*.pdb`, `*.ilk`, `*.iobj`, `*.ipdb`, `*.pch`, IDE cache/workspace files, local history and generated `.g.cs` / `.designer.cs` patterns.

**Flutter / Dart / Apple mobile / game engines:** `.dart_tool`, `.pub`, `.pub-cache`, `.flutter-plugins`, `build`, `Pods`, `Carthage`, `DerivedData`, `.build`, `.swiftpm`, `Flutter/ephemeral`, `.godot`, `.import`, `Binaries`, `Intermediate`, `Saved`, `Temp`, `Logs`.

**R / data science / ML / automation:** `.Rproj.user`, `renv/library`, `packrat/lib`, `.julia`, `wandb`, `mlruns`, `lightning_logs`, `tensorboard`, `runs`, `ray_results`, `ray_tmp`, `spark-warehouse`, `checkpoints`, `.dvc/cache`, `.metaflow`, `.snakemake`, `.nextflow`, model/dataset/transformer cache-name patterns.

**Tests / docs / OS:** `coverage`, `htmlcov`, `.nyc_output`, `playwright-report`, `allure-results`, `allure-report`, `surefire-reports`, `failsafe-reports`, `site`, `_site`, `_build`, `.doctrees`, `__MACOSX`, `.DS_Store`, `Thumbs.db`, `desktop.ini`, `ehthumbs*.db`, `._*`, swap/backup files, temporary files and tool logs.

## Behavior and safety

- Global **Include cache & generated files OFF** means matching directories/files are skipped by the scanner's traversal, not just hidden in the UI.
- Global toggle **ON** allows detected candidates through the usual text/binary/size and safety rules. It does not turn binary/unknown files into text or bypass sensitive filename exclusions.
- When the global toggle is ON, unticking an individually tagged item marks it as an explicit raw ZIP override: that path skips scanning/redaction and can be copied byte-for-byte if folder-copy or ZIP output is enabled.
- Normal source exclusions remain separate. DFOL does not delete source files.
- `dump` is only protected when it is DFOL's real output path (`/storage/emulated/0/dump`), not merely because a project folder is named `dump`.
- This is a broad heuristic filter pack, not a mathematical guarantee or a literally complete list of all tools in existence. The catalog includes generic names such as `logs`, `env`, `bin`, `out`, `site`, `vendor`, and `generated`; these are useful cross-ecosystem conventions but can also be meaningful source/data folders. New versions and custom tools can create unseen paths; common names such as `build`, `logs`, `generated`, `vendor`, `cache`, `env`, `bin`, `out`, or `site` can also contain legitimate user content. Review the filter tooltip and enable the global toggle when you need those paths.

## Reference conventions checked

- GitHub's public language/framework/OS ignore templates: https://github.com/github/gitignore
- Node template: https://github.com/github/gitignore/blob/main/Node.gitignore
- Flutter template: https://github.com/github/gitignore/blob/main/Flutter.gitignore
- Visual Studio template: https://github.com/github/gitignore/blob/main/VisualStudio.gitignore
- GitHub documentation on ignore rules: https://docs.github.com/en/get-started/getting-started-with-git/ignoring-files
