# DFOL v8.0.0 — Termux application

DFOL means **Dump Folder — Poore Folder Ka Dump**. This local Node.js/HTML tool browses Android shared storage, shows a project tree, scans supported text files for configured sensitive patterns, lets the user choose which detected values to mask, and creates requested TXT/folder/ZIP exports.

## Run

```bash
pkg install nodejs zip -y
termux-setup-storage
node server.js
```

Open `http://127.0.0.1:3001` in Android Chrome on the same device. The server binds only to `127.0.0.1`; do not expose it to a LAN or public internet. Keep the terminal visible for the explicit raw-export one-time-code flow.

## No DFOL file-count/file-size caps

Version 8.0 removes fixed application-level limits on scan file count, text-file size, request-body size, tree-node count and tree depth. Tree traversal/rendering is iterative. There is no promise of literal infinite capacity: device RAM/storage, Android/Termux, browser, filesystem, Node.js and ZIP implementation remain physical/runtime constraints. The UI displays a performance notice before export and a persistent notice while exporting; processing time and completion depend on device resources and environment.

## Existing behavior retained

- The scanner only reads supported file types and still skips binary/unrecognized content and credential-like filenames/data-file types according to the existing rules. No OCR or archive decryption is performed.
- Pattern detection is heuristic. False positives and false negatives are possible; never consider a clean scan proof that a project has no secrets.
- Checked findings are selected for masking in normal exports; unchecked findings remain raw.
- The special unchanged-source export uses a separate high-risk warning and temporary Termux one-time code. No device-lock, fingerprint, biometric or passkey flow is included.
- Generated/cache filtering remains heuristic and does not delete the originals.
- `Tree.txt` is generated alongside the export; when selected, the same file is packaged inside the ZIP, and the same tree text is appended to `live.txt` when that output is selected.
- Browser state restoration remains enabled so refresh does not automatically restart the workflow. Export-name values are not restored from stale browser state.

Read the root `DFOL_COMPLETE_DOCUMENTATION.txt`, `MY_DFOL_VISION.txt`, and `GENERATED_FILTERS.md` before public distribution. Manually inspect every export before sharing.
