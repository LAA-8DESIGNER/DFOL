# DFOL — Dump Folder

**DFOL = Dump Folder — Poore Folder Ka Dump.**

A local-first Android/Termux tool for browsing project folders, reviewing their structure, detecting configured sensitive-data patterns, masking selected matches, and exporting a project snapshot to TXT files, a sanitized text-focused folder copy, `Tree.txt`, and an optional ZIP.

## v8.0 — No application-level file-count or file-size ceilings

DFOL no longer has hard-coded maximums for the number of files discovered by the scanner, source-file size, HTTP request-body length, tree node count, or directory depth. The tree browser and tree rendering walk structures iteratively rather than truncating a tree at a configured node/depth threshold.

**Device-performance notice shown before export and during export:** large projects may need substantial time, memory, storage and compression work. Processing duration and completion depend on the device and operating environment. Android/Termux, Node.js, the browser, filesystem, available storage/memory and ZIP tool still have physical/runtime limits; no script can make device resources literally unlimited. A very large operation may slow down or fail if resources are exhausted.

This removes DFOL's fixed count/size cutoffs; it does not promise that a physical device can process trillions of files or a file larger than its available resources. Keep Termux and the browser available while a large operation runs and ensure enough free storage for the output and ZIP.

## Quick start (Termux)

For a public clone after the repository is published:

```bash
pkg install git -y && git clone https://github.com/LAA-8DESIGNER/DFOL.git && cd DFOL && bash quickstart.sh
```

Manual start from this release:

```bash
pkg install nodejs zip -y
termux-setup-storage
cd dfol_termux
node server.js
```

Open `http://127.0.0.1:3001` in Android Chrome on the same device. Stop with `Ctrl+C`. Keep the server bound to localhost; do not expose port 3001 to a LAN/public internet.

## Export behavior

- Long-press a folder and choose **EXPORT TREE** or **EXPORT CODE**.
- Normal exports can contain `live.txt`, `individual/`, `sanitized_project/`, `Tree.txt`, `DFOL_audit_report.json` and an optional `DFOL_export.zip`, according to selected output options.
- The same canonical outer `Tree.txt` is included unchanged in `DFOL_export.zip`; its tree is not replaced with an archive-specific manifest.
- When `live.txt` is selected, the same tree text is appended at the end.
- Output folder names are based on device-local date/time by default, or a manually entered name. Existing folder names are rejected instead of silently renamed.
- Browser workflow state (including in-progress export task ID and scan selections) is saved in browser `localStorage` and restored after refresh while the server remains running. This is intentional workflow recovery, not a generated file/cache folder. The custom export folder name is intentionally not restored from old browser state.

## Security and limitations

- Pattern-based detection can produce false positives and false negatives. A clean scan/audit does not prove that no secrets remain.
- Unchecked sensitive findings remain raw. The explicit unchanged-source export can include detected sensitive values; read and complete the warning flow before using it.
- Files are still treated according to the existing supported text/binary/credential-name rules. Removing file-count and file-size thresholds does not make all binary formats readable, does not add image OCR/archive decryption, and does not make unsupported file types scan as source code.
- Common cache/generated names are heuristic; some matching names may contain legitimate source. Review the generated/cache tree and its tooltip.
- DFOL does not intentionally edit originals. Exports may still contain confidential data; inspect every output before sharing.
- Large work is inherently constrained by real device memory, storage, OS/filesystem behavior and runtime availability.

## About the designer

The application includes an **About the Designer** page for PRAKASHH / LAA-8DESIGNER, with the supplied profile photo and signature display image, direct GitHub, YouTube, Instagram and email links, plus the original vision letter.

## Files and documentation

- `DFOL_COMPLETE_DOCUMENTATION.txt` — detailed technical reference.
- `MY_DFOL_VISION.txt` — designer's vision in letter form.
- `LICENSE` — The Unlicense; reuse, modifications and redistribution are permitted. Attribution is optional, not required.
- `dfol_termux/GENERATED_FILTERS.md` — details and limitations of generated/cache heuristics.

## Tests and release checks

```bash
bash verify_release.sh
```

The tests and static checks help validate the release, but do not replace an Android/Termux live scan/export test. The software is provided as-is without a guarantee that every file or secret is detected or that a device can finish any arbitrarily large export.

## Publishing to GitHub

Run `bash publish_github.sh` from the release root in Termux. It asks for a GitHub token using hidden terminal input, checks the target account/repository, avoids force-pushing existing history, pushes the release, and attempts a public clone check. Do not paste tokens into chat, source code, a README, or a repository URL.
