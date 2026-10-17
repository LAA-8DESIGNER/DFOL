#!/usr/bin/env node
'use strict';

/*
 * DFOL Privacy Dumper — local-only Termux backend.
 * Uses Node built-ins plus the Termux `zip` command for archives.
 * It never modifies source files. Exports are created in /storage/emulated/0/dump.
 */
const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { FILTER_PACK_VERSION, classifyGeneratedDirectory, classifyGeneratedFile, filterCatalogSummary } = require('./generated_filters');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 3001);
const STORAGE_ROOT = '/storage/emulated/0';
const OUTPUT_ROOT = path.join(STORAGE_ROOT, 'dump');
const APP_ROOT = __dirname;
const SECRET_NAMES = new Set([
  '.env', '.env.local', '.env.production', '.env.development',
  '.npmrc', '.pypirc', '.netrc', 'credentials', 'credentials.json',
  'secrets.json', 'secret.json', 'secrets.yaml', 'secrets.yml',
  'service-account.json', 'id_rsa', 'id_dsa', 'id_ecdsa', 'id_ed25519',
  'known_hosts', 'authorized_keys'
]);
const SECRET_EXTS = new Set(['.pem', '.key', '.p12', '.pfx', '.jks', '.keystore', '.kdbx']);
const SENSITIVE_DATA_EXTS = new Set(['.sql', '.sqlite', '.sqlite3', '.db', '.dump', '.bak', '.backup']);
const BINARY_EXTS = new Set([
  '.png','.jpg','.jpeg','.gif','.webp','.bmp','.ico','.heic','.mp4','.mov','.mkv',
  '.mp3','.wav','.ogg','.pdf','.apk','.aab','.dex','.so','.jar','.class','.zip',
  '.gz','.7z','.rar','.tar','.woff','.woff2','.ttf','.otf','.eot','.wasm',
  '.sqlite','.sqlite3','.db','.p12','.pfx','.jks','.keystore','.kdbx'
]);
const TEXT_EXTS = new Set([
  '.js','.jsx','.ts','.tsx','.mjs','.cjs','.json','.jsonc','.html','.htm','.css',
  '.scss','.sass','.less','.py','.pyw','.sh','.bash','.zsh','.php','.rb','.go',
  '.rs','.java','.kt','.kts','.c','.h','.cpp','.hpp','.cs','.swift','.dart',
  '.vue','.svelte','.md','.mdx','.txt','.log','.xml','.yml','.yaml','.toml',
  '.ini','.conf','.config','.properties','.gradle','.sql','.graphql','.gql',
  '.env','.example','.sample','.csv','.tsv','.gitignore','.dockerignore',
  '.editorconfig','.rules','.service','.timer','.makefile'
]);
const jobs = new Map();
const sessions = new Map();
const exportTasks = new Map();
const securityChallenges = new Map();
const unmaskApprovals = new Map();
const OTP_TTL_MS = 45_000;
let otpDisplayTimer = null;
let activeOtpChallengeId = null;
let otpInAlternateScreen = false;

function sha256(buf) { return crypto.createHash('sha256').update(buf).digest(); }
function constantTimeTextEqual(a,b) {
  const aa=Buffer.from(String(a)), bb=Buffer.from(String(b));
  return aa.length===bb.length && crypto.timingSafeEqual(aa,bb);
}
function clearOtpTerminalDisplay(challengeId = null, message = '') {
  if (challengeId && activeOtpChallengeId && challengeId !== activeOtpChallengeId) return;
  if (otpDisplayTimer) {
    clearTimeout(otpDisplayTimer);
    otpDisplayTimer = null;
  }
  if (otpInAlternateScreen && process.stdout.isTTY) {
    // Termux's alternate screen keeps this temporary code out of the normal scrollback.
    process.stdout.write('\x1b[2J\x1b[H\x1b[?1049l');
  }
  otpInAlternateScreen = false;
  activeOtpChallengeId = null;
  if (message && process.stdout.isTTY) process.stdout.write(`${message}\n`);
}
function pruneSecurityState() {
  const now = Date.now();
  for (const [k, v] of securityChallenges) {
    if (v.expiresAt <= now) {
      securityChallenges.delete(k);
      if (v.kind === 'otp') clearOtpTerminalDisplay(k, 'DFOL: ephemeral authorization code expired and was discarded.');
    }
  }
  for (const [k, v] of unmaskApprovals) if (v.expiresAt < now || v.used) unmaskApprovals.delete(k);
}
function createUnmaskApproval(method) {
  pruneSecurityState();
  const token = id();
  unmaskApprovals.set(token, { method, createdAt: Date.now(), expiresAt: Date.now() + 20 * 60 * 1000, used: false });
  return token;
}
function checkUnmaskApproval(token, consume = false) {
  pruneSecurityState();
  const approval = unmaskApprovals.get(String(token || ''));
  if (!approval || approval.used || approval.expiresAt < Date.now()) throw new Error('Raw export authorization is missing or expired. Complete the raw-export safety confirmation again.');
  if (consume) { approval.used = true; unmaskApprovals.delete(String(token)); }
  return approval;
}
function formatEphemeralOtp() {
  // 256 bits from the OS CSPRNG; uppercase hex groups are easy to transcribe and case-insensitive.
  return crypto.randomBytes(32).toString('hex').toUpperCase().match(/.{1,8}/g).join('-');
}
function normalizeEphemeralOtp(value) {
  return String(value || '').toUpperCase().replace(/[\s-]/g, '');
}
function showEphemeralOtp(challengeId, code) {
  if (!process.stdout.isTTY) throw new Error('OTP requires the visible interactive Termux terminal. Stop DFOL and run node server.js directly in Termux; no code was issued.');
  clearOtpTerminalDisplay();
  activeOtpChallengeId = challengeId;
  process.stdout.write('\x1b[?1049h\x1b[2J\x1b[H');
  otpInAlternateScreen = true;
  process.stdout.write([
    'DFOL — TEMPORARY RAW-EXPORT AUTHORIZATION',
    '',
    'Enter this code in the DFOL browser dialog.',
    'Lifetime: 45 seconds. One use only. Do not share it.',
    '',
    `CODE: ${code}`,
    '',
    'This temporary screen will be cleared on verification, cancellation, or expiry.',
    'Keep the server running; no code is written to a file or persistent log.',
    ''
  ].join('\n'));
  otpDisplayTimer = setTimeout(() => {
    const pending = securityChallenges.get(challengeId);
    if (pending && pending.expiresAt <= Date.now()) securityChallenges.delete(challengeId);
    clearOtpTerminalDisplay(challengeId, 'DFOL: ephemeral authorization code expired and was discarded.');
  }, OTP_TTL_MS);
  if (typeof otpDisplayTimer.unref === 'function') otpDisplayTimer.unref();
}
process.on('exit', () => {
  if (otpDisplayTimer) clearTimeout(otpDisplayTimer);
  if (otpInAlternateScreen && process.stdout.isTTY) process.stdout.write('\x1b[2J\x1b[H\x1b[?1049l');
});
function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}
function safeRoot(p) {
  const resolved = path.resolve(p || STORAGE_ROOT);
  return resolved === STORAGE_ROOT || resolved.startsWith(STORAGE_ROOT + path.sep);
}
function safePath(p) {
  if (typeof p !== 'string' || !p) throw new Error('A path is required.');
  const resolved = path.resolve(p);
  if (!safeRoot(resolved)) throw new Error('Path is outside shared storage.');
  return resolved;
}
function id() { return crypto.randomBytes(16).toString('hex'); }
function isLikelyBinary(buf) {
  const sample = buf.subarray(0, Math.min(buf.length, 8192));
  if (sample.includes(0)) return true;
  let bad = 0;
  for (const b of sample) if (b < 9 || (b > 13 && b < 32)) bad++;
  return sample.length > 0 && bad / sample.length > 0.08;
}
function isSecretFilename(name) {
  const low = name.toLowerCase();
  if (SECRET_NAMES.has(low)) return true;
  if (SECRET_EXTS.has(path.extname(low))) return true;
  if (/^(id_(rsa|dsa|ecdsa|ed25519))(\..*)?$/.test(low)) return true;
  if (/^(.*\.)?(secret|secrets|credential|credentials)(\..*)?$/.test(low)) return true;
  return false;
}
function isProtectedOutputPath(target) {
  const resolved = path.resolve(target);
  const output = path.resolve(OUTPUT_ROOT);
  return resolved === output || resolved.startsWith(output + path.sep);
}
function isSkippableDir(name, fullPath, relativePath, includeGenerated = false) {
  // Never recurse into DFOL's own exports or OS trash. Do not skip every folder
  // named "dump": a user's real project may legitimately contain that name.
  if (isProtectedOutputPath(fullPath)) return true;
  const low = String(name || '').toLowerCase();
  if (low === '.trash' || low === '.trashes' || low === '$recycle.bin' || low === 'system volume information') return true;
  return !includeGenerated && Boolean(classifyGeneratedDirectory(name, relativePath));
}
function isGeneratedCacheFile(name, relativePath = '') {
  return Boolean(classifyGeneratedFile(name, relativePath));
}
function generatedDirKind(name, relativePath = '') {
  const match = classifyGeneratedDirectory(name, relativePath);
  return match ? match.kind : null;
}
function generatedFileKind(name, relativePath = '') {
  const match = classifyGeneratedFile(name, relativePath);
  return match ? match.kind : null;
}
function generatedDirMatch(name, relativePath = '') {
  return classifyGeneratedDirectory(name, relativePath);
}
function generatedFileMatch(name, relativePath = '') {
  return classifyGeneratedFile(name, relativePath);
}
function addFinding(findings, file, line, category, severity, confidence, snippet, start, end) {
  findings.push({
    id: id(), file, line, category, severity, confidence,
    snippet: snippet.slice(0, 240), start, end, selected: severity === 'critical' || severity === 'high'
  });
}

const PATTERNS = [
  { category:'API keys / service keys', severity:'high', confidence:'medium', re:/\b(?:sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{25,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})\b/g },
  { category:'Private key material', severity:'critical', confidence:'high', re:/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
  { category:'Credential assignment', severity:'high', confidence:'medium', re:/\b(?:password|passwd|pwd|client_secret|secret_access_key|private_key|api_key|apikey|access_token|refresh_token|auth_token|jwt_secret)\b\s*["']?\s*[:=]\s*["']([^"' \n]{4,})["']/gi, capture:1 },
  { category:'Database connection secret', severity:'high', confidence:'medium', re:/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s"'`]+/gi },
  { category:'Bearer / authorization token', severity:'high', confidence:'medium', re:/\bBearer\s+[A-Za-z0-9._~+\/=-]{12,}/gi },
  { category:'Webhook secret / URL', severity:'high', confidence:'medium', re:/https?:\/\/[^\s"'`]*(?:webhook|hooks)[^\s"'`]*(?:token|secret|key)=[^&\s"'`]+/gi },
  { category:'Email address', severity:'low', confidence:'high', re:/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { category:'Phone-like number', severity:'low', confidence:'low', re:/(?<!\w)(?:\+?\d[\d ()-]{8,}\d)(?!\w)/g }
];

function scanText(file, text, findings) {
  const lines = text.split(/\r?\n/);
  lines.forEach((line, idx) => {
    for (const p of PATTERNS) {
      p.re.lastIndex = 0;
      let m;
      while ((m = p.re.exec(line)) !== null) {
        let start = m.index, value = m[0];
        if (p.capture) {
          const cap = m[p.capture];
          const relative = m[0].lastIndexOf(cap);
          start += relative; value = cap;
        }
        if (!value || value.length < 4) continue;
        const highRisk = ['Private key material','API keys / service keys','Credential assignment','Database connection secret','Bearer / authorization token','Webhook secret / URL'].includes(p.category);
        const selectedByDefault = highRisk;
        addFinding(findings, file, idx + 1, p.category, p.severity, p.confidence,
          line.trim(), start, start + value.length);
        findings[findings.length - 1].selected = selectedByDefault;
        findings[findings.length - 1].valueHash = crypto.createHash('sha256').update(value).digest('hex');
        // Avoid repeated infinite matches on zero-length patterns.
        if (m[0].length === 0) p.re.lastIndex++;
      }
    }
  });
}

async function readJson(req) {
  // No DFOL-defined request-body byte ceiling. Metadata size is limited only by
  // the running device/runtime's available memory and operating environment.
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function sendStatic(res, name) {
  const p = path.join(APP_ROOT, 'public', name);
  fs.readFile(p, (err, data) => {
    if (err) return json(res, 404, { error: 'UI file not found. Ensure public/ files exist.' });
    const lower = name.toLowerCase();
    const type = lower.endsWith('.html') ? 'text/html; charset=utf-8' :
      lower.endsWith('.css') ? 'text/css; charset=utf-8' :
      lower.endsWith('.js') ? 'text/javascript; charset=utf-8' :
      lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? 'image/jpeg' :
      lower.endsWith('.png') ? 'image/png' :
      lower.endsWith('.svg') ? 'image/svg+xml; charset=utf-8' :
      lower.endsWith('.txt') ? 'text/plain; charset=utf-8' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options':'nosniff',
      'Content-Security-Policy': "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });
    res.end(data);
  });
}
async function listDir(dir) {
  const target = safePath(dir || STORAGE_ROOT);
  const stat = await fsp.stat(target);
  if (!stat.isDirectory()) throw new Error('Path is not a directory.');
  const ents = await fsp.readdir(target, { withFileTypes: true });
  const rows = [];
  for (const ent of ents) {
    // Files are listed but never served/opened by the UI.
    let st;
    try { st = await fsp.lstat(path.join(target, ent.name)); } catch { continue; }
    rows.push({
      name: ent.name,
      path: path.join(target, ent.name),
      type: ent.isDirectory() ? 'directory' : ent.isSymbolicLink() ? 'symlink' : 'file',
      size: st.size,
      modified: st.mtime.toISOString(),
      hidden: ent.name.startsWith('.')
    });
  }
  rows.sort((a,b) => (a.type === 'directory' ? 0 : 1) - (b.type === 'directory' ? 0 : 1) || a.name.localeCompare(b.name));
  return { path: target, parent: target === STORAGE_ROOT ? null : path.dirname(target), entries: rows };
}
async function walk(root, onFile, counters, exclusions = [], includeGenerated = false, rawGeneratedPaths = []) {
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    if (isProtectedOutputPath(dir)) { counters.skipped++; continue; }
    let ents;
    try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch (e) {
      counters.errors++; continue;
    }
    for (const ent of ents) {
      const full = path.join(dir, ent.name);
      const rel = path.relative(root, full).split(path.sep).join('/');
      if (isExcluded(full, exclusions)) { counters.skipped++; continue; }
      if (isUnderAny(full, rawGeneratedPaths)) { counters.skipped++; continue; }
      if (ent.isSymbolicLink()) { counters.skipped++; continue; }
      if (ent.isDirectory()) {
        if (isSkippableDir(ent.name, full, rel, includeGenerated)) { counters.skipped++; continue; }
        stack.push(full);
      } else if (ent.isFile()) {
        if (!includeGenerated && isGeneratedCacheFile(ent.name, rel)) { counters.skipped++; continue; }
        counters.discovered++;
        await onFile(full, ent);
      }
    }
  }
}
async function getTree(root) {
  const target = safePath(root);
  const st = await fsp.stat(target);
  if (!st.isDirectory()) throw new Error('Select a folder, not a file.');

  const baseName = path.basename(target) || target;
  const rootMatch = generatedDirMatch(baseName, '');
  const rootNode = {
    name:baseName, path:target, type:'directory', generated:Boolean(rootMatch),
    generatedKind:rootMatch ? rootMatch.kind : null,
    generatedReason:rootMatch ? rootMatch.reason : null,
    generatedConfidence:rootMatch ? rootMatch.confidence : null,
    generatedRuleId:rootMatch ? rootMatch.ruleId : null,
    children:[]
  };
  let count = 0;
  const stack = [{ dir:target, node:rootNode, inheritedMatch:rootMatch }];
  while (stack.length) {
    const frame = stack.pop();
    let entries;
    try { entries = await fsp.readdir(frame.dir, { withFileTypes:true }); }
    catch { frame.node.unreadable = true; continue; }
    entries.sort((a,b) => {
      const ad = a.isDirectory() ? 0 : 1, bd = b.isDirectory() ? 0 : 1;
      return ad - bd || a.name.localeCompare(b.name);
    });
    const directoryFrames = [];
    for (const ent of entries) {
      const full = path.join(frame.dir, ent.name);
      const rel = path.relative(target, full).split(path.sep).join('/');
      if (ent.isDirectory() && (isProtectedOutputPath(full) || ['.trash','.trashes','$recycle.bin','system volume information'].includes(ent.name.toLowerCase()))) continue;
      count++;
      if (ent.isSymbolicLink()) {
        frame.node.children.push({name:ent.name,path:full,type:'symlink',children:[]});
        continue;
      }
      if (ent.isDirectory()) {
        const ownMatch = generatedDirMatch(ent.name, rel);
        const effectiveMatch = ownMatch || frame.inheritedMatch;
        const child = {
          name:ent.name,path:full,type:'directory',generated:Boolean(effectiveMatch),
          generatedKind:effectiveMatch ? effectiveMatch.kind : null,
          generatedReason:effectiveMatch ? effectiveMatch.reason : null,
          generatedConfidence:effectiveMatch ? effectiveMatch.confidence : null,
          generatedRuleId:effectiveMatch ? effectiveMatch.ruleId : null,
          children:[]
        };
        frame.node.children.push(child);
        directoryFrames.push({dir:full,node:child,inheritedMatch:effectiveMatch});
      } else if (ent.isFile()) {
        const fileMatch = generatedFileMatch(ent.name, rel) || frame.inheritedMatch;
        frame.node.children.push({
          name:ent.name,path:full,type:'file',generated:Boolean(fileMatch),
          generatedKind:fileMatch ? fileMatch.kind : null,
          generatedReason:fileMatch ? fileMatch.reason : null,
          generatedConfidence:fileMatch ? fileMatch.confidence : null,
          generatedRuleId:fileMatch ? fileMatch.ruleId : null,
          children:[]
        });
      }
    }
    // LIFO stack: reverse insertion preserves the same displayed directory order.
    for (let i=directoryFrames.length-1;i>=0;i--) stack.push(directoryFrames[i]);
  }
  return { root:target, tree:rootNode, nodeCount:count, truncated:false };
}

function renderTreeText(rootNode) {
  const out = [];
  const stack = [{type:'node',node:rootNode,prefix:'',last:true,root:true}];
  while (stack.length) {
    const item = stack.pop();
    if (item.type === 'text') { out.push(item.value); continue; }
    const node = item.node;
    const label = (node.name || path.basename(node.path || '')) + (node.type === 'directory' ? '/' : node.type === 'symlink' ? ' -> [symlink]' : '');
    out.push(item.root ? label : `${item.prefix}${item.last ? '└── ' : '├── '}${label}`);
    const nextPrefix = item.root ? '' : item.prefix + (item.last ? '    ' : '│   ');
    if (node.truncated) stack.push({type:'text',value:`${nextPrefix}    [tree truncated]`});
    if (node.unreadable) stack.push({type:'text',value:`${nextPrefix}    [unreadable]`});
    const kids = Array.isArray(node.children) ? node.children : [];
    for (let i=kids.length-1;i>=0;i--) stack.push({type:'node',node:kids[i],prefix:nextPrefix,last:i===kids.length-1,root:false});
  }
  return out;
}
function localTreeFolderName(){const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;}
async function createOutputDir(name){await fsp.mkdir(OUTPUT_ROOT,{recursive:true});const out=path.join(OUTPUT_ROOT,name);try{await fsp.mkdir(out,{recursive:false});return out}catch(e){if(e.code==='EEXIST')throw new Error(`Folder "${name}" already exists in ${OUTPUT_ROOT}. Wait for a new timestamp and try again.`);throw e}}
function outputTree(dir, exclude=new Set()) {
  const lines = [path.basename(dir) + '/'];
  const stack = [];
  function getEntries(current) {
    try {
      return fs.readdirSync(current,{withFileTypes:true})
        .filter(e => !exclude.has(path.relative(dir,path.join(current,e.name)).split(path.sep).join('/')))
        .sort((a,b)=>(a.isDirectory()?0:1)-(b.isDirectory()?0:1)||a.name.localeCompare(b.name,undefined,{numeric:true}));
    } catch { return []; }
  }
  const rootEntries = getEntries(dir);
  for (let i=rootEntries.length-1;i>=0;i--) stack.push({current:dir,entry:rootEntries[i],prefix:'',last:i===rootEntries.length-1});
  while (stack.length) {
    const item = stack.pop();
    const full = path.join(item.current,item.entry.name);
    const isDir = item.entry.isDirectory();
    lines.push(`${item.prefix}${item.last?'└── ':'├── '}${item.entry.name}${isDir?'/':item.entry.isSymbolicLink()?' -> [symlink]':''}`);
    if (isDir && !item.entry.isSymbolicLink()) {
      const entries = getEntries(full);
      const nextPrefix = item.prefix + (item.last ? '    ' : '│   ');
      for (let i=entries.length-1;i>=0;i--) stack.push({current:full,entry:entries[i],prefix:nextPrefix,last:i===entries.length-1});
    }
  }
  return lines.join('\n') + '\n';
}
async function exportTreeJob(body){const folder=String(body.path||'');if(!folder)throw new Error('Select a folder first.');const tree=await getTree(folder);const outDir=await createOutputDir(localTreeFolderName());const treePath=path.join(outDir,'Tree.txt');await fsp.writeFile(treePath,`DFOL TREE EXPORT\nSource: ${tree.root}\nGenerated: ${new Date().toString()}\nItems counted: ${tree.nodeCount}\n\n${renderTreeText(tree.tree).join('\n')}\n`,{mode:0o600});let zipPath=null;if(body.zip===true){zipPath=path.join(outDir,'DFOL_Tree.zip');await runZip(zipPath,outDir,['Tree.txt']);}return {ok:true,outputDir:outDir,treePath,zipPath,nodeCount:tree.nodeCount};}

function normalizeExclusions(root, raw) {
  if (!Array.isArray(raw)) return [];
  const clean = [];
  for (const item of raw) {
    if (typeof item !== 'string' || !item) continue;
    const resolved = safePath(item);
    if (resolved === root || resolved.startsWith(root + path.sep)) clean.push(resolved);
  }
  return [...new Set(clean)];
}
function isExcluded(file, exclusions) {
  return exclusions.some(ex => file === ex || file.startsWith(ex + path.sep));
}
function isUnderAny(file, roots) {
  return roots.some(root => file === root || file.startsWith(root + path.sep));
}
function isGeneratedPathWithinRoot(root, target) {
  const rel = path.relative(root, target);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return false;
  const parts = rel.split(path.sep);
  for (let i=0;i<parts.length-1;i++) {
    const prefix = parts.slice(0,i+1).join('/');
    if (generatedDirKind(parts[i], prefix)) return true;
  }
  const fullRelative = parts.join('/');
  const last = parts[parts.length-1];
  return Boolean(generatedDirKind(last, fullRelative) || generatedFileKind(last, fullRelative));
}
function normalizeRawGeneratedPaths(root, raw) {
  if (!Array.isArray(raw)) return [];
  const clean=[];
  for (const item of raw) {
    if (typeof item !== 'string' || !item) continue;
    let resolved; try { resolved=safePath(item); } catch { continue; }
    if ((resolved===root || resolved.startsWith(root+path.sep)) && resolved!==root && !isProtectedOutputPath(resolved) && isGeneratedPathWithinRoot(root,resolved)) clean.push(resolved);
  }
  return [...new Set(clean)];
}

async function startScan(root, rawExclusions = [], includeGenerated = false, rawGeneratedInput = [], maskingMode = 'masked', rawApprovalToken = '') {
  const target = safePath(root);
  if (isProtectedOutputPath(target)) throw new Error('DFOL output folders cannot be scanned again. Choose the original project folder.');
  if (maskingMode === 'raw') checkUnmaskApproval(rawApprovalToken, false);
  const exclusions = normalizeExclusions(target, rawExclusions);
  const rawGeneratedPaths = normalizeRawGeneratedPaths(target, rawGeneratedInput).filter(p => !isExcluded(p, normalizeExclusions(target, rawExclusions)));
  const st = await fsp.stat(target);
  if (!st.isDirectory()) throw new Error('Select a folder, not a file.');
  const job = {
    id: id(), root: target, exclusions, rawGeneratedPaths, includeGenerated: Boolean(includeGenerated), maskingMode: maskingMode === 'raw' ? 'raw' : 'masked', status: 'scanning', progress: 0, filesSeen: 0,
    readable: 0, skipped: 0, errors: 0, findings: [], files: [], started: Date.now()
  };
  jobs.set(job.id, job);
  setImmediate(async () => {
    const counters = { discovered:0, skipped:0, errors:0 };
    try {
      await walk(target, async (file, ent) => {
        job.filesSeen++;
        const base = path.basename(file);
        const rel = path.relative(target, file);
        if (isSecretFilename(base) || SENSITIVE_DATA_EXTS.has(path.extname(base).toLowerCase())) {
          job.files.push({ path:file, rel, status:'excluded-sensitive-file', reason:'Sensitive filename or data-file type; content not read or exported by default.' });
          counters.skipped++;
          return;
        }
        const ext = path.extname(base).toLowerCase();
        if (BINARY_EXTS.has(ext) || (!TEXT_EXTS.has(ext) && !base.startsWith('.') && !['Dockerfile','Makefile','Procfile'].includes(base))) {
          job.files.push({ path:file, rel, status:'skipped-nontext', reason:'Binary or unrecognized file type; not read/exported by default.' });
          counters.skipped++;
          return;
        }
        let buf;
        try {
          // No DFOL-defined file-size ceiling. The file is read under available device/runtime memory.
          buf = await fsp.readFile(file);
        } catch {
          counters.errors++;
          job.files.push({ path:file, rel, status:'unreadable', reason:'Could not read file.' });
          return;
        }
        if (isLikelyBinary(buf)) {
          counters.skipped++;
          job.files.push({ path:file, rel, status:'skipped-binary', reason:'Binary content detected.' });
          return;
        }
        const text = buf.toString('utf8');
        job.readable++;
        job.files.push({ path:file, rel, status:'scanned', size:buf.length });
        const before = job.findings.length;
        scanText(rel, text, job.findings);
        for (let i=before; i<job.findings.length; i++) job.findings[i].absPath = file;
        job.progress = Math.min(95, Math.round(job.filesSeen / Math.max(1, counters.discovered + stackEstimate(target)) * 100));
      }, counters, exclusions, job.includeGenerated, job.rawGeneratedPaths);
      job.skipped = counters.skipped;
      job.errors = counters.errors;
      if (job.maskingMode === 'raw') job.findings.forEach(f => { f.selected = false; });
      else job.findings.forEach(f => { f.selected = true; });
      job.progress = 100;
      job.status = 'complete';
      job.finished = Date.now();
    } catch (e) {
      job.status = 'error'; job.error = e.message; job.finished = Date.now();
    }
  });
  return { id: job.id, root: job.root };
}
function stackEstimate() { return 1; }
function getJob(idValue) {
  const job = jobs.get(idValue);
  if (!job) throw new Error('Scan session not found or expired.');
  return job;
}
function safeSnippetForFinding(f) {
  // UI receives the line with likely secret-like substrings hidden, not the raw secret value.
  let s = f.snippet;
  const common = [
    /\b(?:sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{25,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})\b/g,
    /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
    /(["']?)(?:password|passwd|pwd|client_secret|secret_access_key|private_key|api_key|apikey|access_token|refresh_token|auth_token|jwt_secret)(["']?\s*[:=]\s*["'])([^"' \n]{4,})(["'])/gi,
    /\bBearer\s+[A-Za-z0-9._~+\/=-]{12,}/gi,
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
  ];
  for (const re of common) s = s.replace(re, (m) => m.length > 16 ? m.slice(0, 5) + '…[hidden]' : '[hidden]');
  return s;
}
function publicJob(job) {
  const counts = {};
  for (const f of job.findings) counts[f.category] = (counts[f.category] || 0) + 1;
  return {
    id:job.id, root:job.root, exclusions:job.exclusions || [], status:job.status, progress:job.progress,
    filesSeen:job.filesSeen, readable:job.readable, skipped:job.skipped, includeGenerated:job.includeGenerated,
    errors:job.errors, findingCount:job.findings.length, counts, maskingMode:job.maskingMode || 'masked', error:job.error || null
  };
}
function runZip(zipPath, cwd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn('zip', ['-q','-r',zipPath,...args], { cwd, stdio:'ignore' });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`zip exited with code ${code}. Install it with: pkg install zip`)));
  });
}
async function copyRawGeneratedOverrides(job, stage) {
  const copied = new Set();
  const stack = (job.rawGeneratedPaths || []).map(source => ({source, dest:null}));
  while (stack.length) {
    const item = stack.pop();
    let st; try { st = await fsp.lstat(item.source); } catch { continue; }
    if (st.isSymbolicLink()) continue;
    const rel = path.relative(job.root,item.source);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) continue;
    const dest = item.dest || path.join(stage,rel);
    if (st.isDirectory()) {
      await fsp.mkdir(dest,{recursive:true});
      let entries; try { entries = await fsp.readdir(item.source,{withFileTypes:true}); } catch { continue; }
      for (let i=entries.length-1;i>=0;i--) {
        const entry = entries[i];
        if (entry.isSymbolicLink()) continue;
        stack.push({source:path.join(item.source,entry.name),dest:path.join(dest,entry.name)});
      }
    } else if (st.isFile()) {
      if (copied.has(item.source)) continue;
      copied.add(item.source);
      await fsp.mkdir(path.dirname(dest),{recursive:true});
      // Explicitly unticked cache/generated items are exported byte-for-byte and are not scanned/redacted.
      await fsp.copyFile(item.source,dest);
    }
  }
}

function localExportFolderTimestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}
function normalizeExportFolderName(value) {
  const name = String(value || '').trim().normalize('NFKC')
    .replace(/[\/\\<>:"|?*\x00-\x1f]/g, '_')
    .replace(/[. ]+$/g, '').replace(/\s+/g, '_').slice(0, 100);
  if (!name || name === '.' || name === '..') throw new Error('Enter a valid export folder name.');
  return name;
}
async function checkExportFolderName(body = {}) {
  const automatic = body.useDeviceDateTime !== false;
  const name = automatic ? localExportFolderTimestamp() : normalizeExportFolderName(body.exportFolderName);
  const candidate = path.join(OUTPUT_ROOT, name);
  let exists = false;
  try { await fsp.lstat(candidate); exists = true; }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  return { ok:true, automatic, normalizedName:name, exists, available:!exists };
}

async function exportJob(body) {
  const job = getJob(body.jobId);
  if (job.status !== 'complete') throw new Error('Scan must finish before export.');
  const selections = Array.isArray(body.selectedFindingIds) ? new Set(body.selectedFindingIds) : new Set();
  const options = body.outputs || {};
  const unmaskFiles = body.unmaskFiles === true;
  if (unmaskFiles) checkUnmaskApproval(body.rawApprovalToken, false);
  const includeCombined = !!options.combined;
  const includeIndividual = !!options.individual;
  const includeCopy = !!options.folderCopy;
  const includeZip = !!options.zip;
  if (!includeCombined && !includeIndividual && !includeCopy && !includeZip) throw new Error('Choose at least one output.');
  if (includeZip && !options.zipAll && !includeCombined && !includeIndividual && !includeCopy) throw new Error('Select ZIP contents.');
  if (unmaskFiles && !includeZip && !includeCopy) throw new Error('For unchanged source-file export, enable Create ZIP or Sanitized folder copy.');
  const unresolved = job.findings.filter(f => !selections.has(f.id) && ['critical','high'].includes(f.severity));
  const confirmUnresolved = body.confirmUnresolved === true;
  if (unresolved.length && !confirmUnresolved && !unmaskFiles) {
    return { needsConfirmation:true, unresolvedCount:unresolved.length,
      message:'High-risk findings remain unmasked. Confirm explicitly to export, or select more findings to mask.' };
  }
  if (unmaskFiles) checkUnmaskApproval(body.rawApprovalToken, true);
  // Use the Android/Termux device's local system clock, not UTC/ISO-Z time.
  const autoFolderName = body.useDeviceDateTime !== false;
  const folderName = autoFolderName ? localExportFolderTimestamp() : normalizeExportFolderName(body.exportFolderName);
  await fsp.mkdir(OUTPUT_ROOT, { recursive:true });
  const outDir = path.join(OUTPUT_ROOT, folderName);
  // Never silently auto-rename a duplicate. The UI checks availability as well, but
  // this server-side guard prevents a race between the check and export creation.
  try { await fsp.mkdir(outDir, { recursive:false }); }
  catch (e) {
    if (e.code === 'EEXIST') throw new Error(`Folder "${folderName}" already exists in ${OUTPUT_ROOT}. Choose a different name.`);
    throw e;
  }
  const selectedFindings = job.findings.filter(f => selections.has(f.id));
  const byFile = new Map();
  for (const f of selectedFindings) {
    if (!byFile.has(f.absPath)) byFile.set(f.absPath, []);
    byFile.get(f.absPath).push(f);
  }
  const exported = [];
  const errors = [];
  const allowedFiles = job.files.filter(f => f.status === 'scanned');
  const redactedContent = new Map();
  for (const f of allowedFiles) {
    try {
      const originalBuffer = await fsp.readFile(f.path);
      let text = originalBuffer.toString('utf8');
      if (unmaskFiles) { redactedContent.set(f.path, originalBuffer); continue; }
      const matches = (byFile.get(f.path) || []).slice().sort((a,b)=>b.line-a.line || b.start-a.start);
      // Apply replacements in reverse line/column order so offsets remain valid.
      const lines = text.split(/\r?\n/);
      const perLine = new Map();
      for (const m of matches) {
        if (!perLine.has(m.line - 1)) perLine.set(m.line - 1, []);
        perLine.get(m.line - 1).push(m);
      }
      for (const [lineIndex, arr] of perLine) {
        let line = lines[lineIndex];
        arr.sort((a,b)=>b.start-a.start);
        for (const m of arr) {
          const start = Math.max(0, m.start), end = Math.min(line.length, m.end);
          if (end > start) line = line.slice(0,start) + '*'.repeat(Math.min(32, Math.max(8,end-start))) + line.slice(end);
        }
        lines[lineIndex] = line;
      }
      redactedContent.set(f.path, lines.join('\n'));
    } catch (e) { errors.push(`Could not prepare ${f.rel}`); }
  }
  // Every export is made from this sanitized staging tree only.
  const stage = path.join(outDir, 'sanitized_project');
  if (includeCopy || includeZip || unmaskFiles) await fsp.mkdir(stage, { recursive:true });
  for (const f of allowedFiles) {
    const content = redactedContent.get(f.path);
    if (content === undefined) continue;
    if (includeCopy || includeZip || unmaskFiles) {
      const dest = path.join(stage, f.rel);
      await fsp.mkdir(path.dirname(dest), { recursive:true });
      await fsp.writeFile(dest, content, { mode:0o600 });
    }
  }
  if (includeCopy || (includeZip && options.zipAll)) await copyRawGeneratedOverrides(job, stage);
  if (includeCombined || (includeZip && options.zipAll)) {
    const chunks = [];
    for (const f of allowedFiles) {
      const content = redactedContent.get(f.path);
      if (content === undefined) continue;
      const textContent = Buffer.isBuffer(content) ? content.toString('utf8') : content;
      chunks.push(`===== FILE: ${f.path} =====\n${textContent}\n`);
    }
    const dest = path.join(outDir, 'live.txt');
    await fsp.writeFile(dest, chunks.join('\n'), { mode:0o600 });
    exported.push('live.txt');
  }
  if (includeIndividual || (includeZip && options.zipAll)) {
    const indiv = path.join(outDir, 'individual');
    await fsp.mkdir(indiv, { recursive:true });
    for (const f of allowedFiles) {
      const content = redactedContent.get(f.path);
      if (content === undefined) continue;
      const safeName = f.rel.replace(/[\\/]/g,'__').replace(/[^a-zA-Z0-9._-]/g,'_');
      await fsp.writeFile(path.join(indiv, safeName + '.txt'), `===== FILE: ${f.path} =====\n${content}\n`, { mode:0o600 });
    }
    exported.push('individual/');
  }
  if (includeCopy || (includeZip && options.zipAll) || unmaskFiles) exported.push('sanitized_project/');
  let zipFile = null;
  const zipItems = [];
  if (includeZip) {
    if (includeCombined || options.zipAll) zipItems.push('live.txt');
    if (includeIndividual || options.zipAll) zipItems.push('individual');
    if (includeCopy || options.zipAll || unmaskFiles) zipItems.push('sanitized_project');
    if (job.rawGeneratedPaths?.length && !includeCopy && !options.zipAll) {
      const rawStage = path.join(outDir, 'raw_generated_overrides');
      await fsp.mkdir(rawStage, { recursive:true }); await copyRawGeneratedOverrides(job, rawStage); zipItems.push('raw_generated_overrides');
    }
    if (!zipItems.length) throw new Error('For ZIP-only output, enable “include all selected output types” or select an output type.');
  }
  // Re-open and audit exported text files for selected finding signatures and common token patterns.
  const auditIssues = [];
  const auditPaths = [];
  // Exact values explicitly left unmasked by the user are an intentional opt-in.
  // They are allow-listed by hash only; values are never written to the audit report.
  const intentionalRawHashes = new Set(job.findings.filter(f => !selections.has(f.id) && f.valueHash).map(f => f.valueHash));
  const tokenAuditPattern = /\b(?:sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{25,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})\b/g;
  const privateKeyAuditPattern = /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g;
  function hasUnexpectedMatch(content, pattern) {
    pattern.lastIndex = 0; let match;
    while ((match = pattern.exec(content)) !== null) {
      const hash = crypto.createHash('sha256').update(match[0]).digest('hex');
      if (unmaskFiles || !intentionalRawHashes.has(hash)) return true;
      if (match[0].length === 0) pattern.lastIndex++;
    }
    return false;
  }
  async function auditDir(rootDir) {
    const stack = [rootDir];
    while (stack.length) {
      const dir = stack.pop();
      let entries;
      try { entries = await fsp.readdir(dir, { withFileTypes:true }); } catch { continue; }
      for (let i=entries.length-1;i>=0;i--) {
        const e = entries[i], p = path.join(dir,e.name);
        if (e.isDirectory()) stack.push(p);
        else if (e.isFile() && (p.endsWith('.txt') || p.endsWith('.js') || p.endsWith('.json') || p.endsWith('.py') || p.endsWith('.ts') || p.endsWith('.tsx') || p.endsWith('.html') || p.endsWith('.yml') || p.endsWith('.yaml') || p.endsWith('.env'))) {
          auditPaths.push(p);
          const content = await fsp.readFile(p,'utf8');
          if (hasUnexpectedMatch(content, tokenAuditPattern)) auditIssues.push(path.relative(outDir,p) + ': token-like pattern remains');
          if (hasUnexpectedMatch(content, privateKeyAuditPattern)) auditIssues.push(path.relative(outDir,p) + ': private-key marker remains');
        }
      }
    }
  }
  await auditDir(outDir);
  const report = {
    generatedAt:new Date().toISOString(), source:job.root,
    filesScanned:job.readable, filesSkipped:job.skipped, unreadableFiles:job.errors,
    findingCount:job.findings.length, selectedForMasking:unmaskFiles ? 0 : selectedFindings.length,
    unresolvedHighRisk:unresolved.length, auditIssues, unmaskedSourceFiles:unmaskFiles, note:unmaskFiles ? 'RAW EXPORT: scanned source files were copied unchanged and may contain sensitive values. This was explicitly authorized; inspect before sharing.' : 'Pattern-based masking cannot guarantee detection of every secret. Review source files and exported results before sharing.'
  };
  await fsp.writeFile(path.join(outDir,'DFOL_audit_report.json'), JSON.stringify(report,null,2), { mode:0o600 });
  // Build Tree.txt exactly once, independently of ZIP creation. This is the canonical
  // export tree file saved beside the outputs. If ZIP output is selected, the very same
  // Tree.txt file is added to the ZIP unchanged; no ZIP-specific manifest is generated.
  const treePath = path.join(outDir, 'Tree.txt');
  const treeText = `DFOL EXPORT TREE\nSource: ${job.root}\nGenerated: ${new Date().toString()}\n\n${outputTree(outDir, new Set(['Tree.txt', 'DFOL_export.zip']))}`;
  await fsp.writeFile(treePath, treeText, {mode:0o600});
  // Append the exact same canonical tree text to the end of live.txt when combined output exists.
  // This is intentionally independent of ZIP selection; ZIP simply packages the resulting files.
  const livePath = path.join(outDir, 'live.txt');
  if (fs.existsSync(livePath) && fs.statSync(livePath).isFile()) {
    await fsp.appendFile(livePath, `\n\n${treeText}`, {mode:0o600});
  }
  exported.push('Tree.txt');
  if (includeZip) {
    zipFile = path.join(outDir, 'DFOL_export.zip');
    await runZip(zipFile, outDir, [...zipItems, 'Tree.txt']);
    exported.push('DFOL_export.zip');
  }
  if (auditIssues.length && !unmaskFiles) {
    return { ok:false, auditBlocked:true, outputDir:outDir, auditIssues, message:'Final audit detected possible secrets. Do not share this export; inspect the report and refine masking.' };
  }
  return { ok:true, outputDir:outDir, zipPath:zipFile, exported, report, rawExport:unmaskFiles };
}

const server = http.createServer(async (req,res) => {
  try {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    if (req.method === 'GET' && url.pathname === '/') return sendStatic(res,'index.html');
    if (req.method === 'GET' && url.pathname === '/app.js') return sendStatic(res,'app.js');
    if (req.method === 'GET' && url.pathname === '/style.css') return sendStatic(res,'style.css');
    if (req.method === 'GET' && url.pathname === '/assets/prakashh-profile.jpg') return sendStatic(res,'assets/prakashh-profile.jpg');
    if (req.method === 'GET' && url.pathname === '/assets/prakashh-signature.png') return sendStatic(res,'assets/prakashh-signature.png');
    if (req.method === 'GET' && url.pathname === '/api/health') {
      let storage = false, reason = null;
      try { await fsp.access(STORAGE_ROOT, fs.constants.R_OK | fs.constants.X_OK); storage = true; }
      catch (e) { reason = e.message; }
      return json(res,200,{ ok:true, host:HOST, port:PORT, storageRoot:STORAGE_ROOT, storageAccess:storage, reason,
        outputRoot:OUTPUT_ROOT, platform:os.platform(), filterPack:FILTER_PACK_VERSION });
    }
    if (req.method === 'GET' && url.pathname === '/api/filters') return json(res,200,filterCatalogSummary());
    if (req.method === 'GET' && url.pathname === '/api/list') {
      const dir = url.searchParams.get('path') || STORAGE_ROOT;
      return json(res,200,await listDir(dir));
    }
    if (req.method === 'GET' && url.pathname === '/api/tree') {
      const dir = url.searchParams.get('path') || STORAGE_ROOT;
      return json(res,200,await getTree(dir));
    }
    if (req.method === 'POST' && url.pathname === '/api/tree-export') return json(res,200,await exportTreeJob(await readJson(req)));
    if (req.method === 'POST' && url.pathname === '/api/scan') {
      const body = await readJson(req);
      const result = await startScan(body.path, body.exclusions || [], body.includeGenerated === true, body.rawGeneratedPaths || [], body.maskingMode || 'masked', body.rawApprovalToken || '');
      return json(res,202,result);
    }
    if (req.method === 'GET' && url.pathname.startsWith('/api/scan/')) {
      const job = getJob(url.pathname.split('/').pop());
      return json(res,200,{ ...publicJob(job), findings:job.findings.map(f => ({
        id:f.id,file:f.file,line:f.line,category:f.category,severity:f.severity,confidence:f.confidence,
        snippet:safeSnippetForFinding(f),start:f.start,end:f.end,selected:f.selected
      })), files:job.files.map(f=>({rel:f.rel,status:f.status,reason:f.reason||null})) });
    }
    if (req.method === 'POST' && url.pathname === '/api/unmask/otp/request') {
      pruneSecurityState();
      await readJson(req);
      if (!process.stdout.isTTY) throw new Error('OTP requires the visible interactive Termux terminal. Stop DFOL and run node server.js directly in Termux; no code was issued.');
      // A new request invalidates any previous active challenge; the code is never returned by HTTP.
      for (const [key, value] of securityChallenges) if (value.kind === 'otp') securityChallenges.delete(key);
      clearOtpTerminalDisplay();
      const challengeId = id();
      const code = formatEphemeralOtp();
      const normalized = normalizeEphemeralOtp(code);
      const otpDigest = sha256(Buffer.from(normalized, 'utf8')).toString('hex');
      const expiresAt = Date.now() + OTP_TTL_MS;
      securityChallenges.set(challengeId, { kind: 'otp', otpDigest, attempts: 0, expiresAt });
      try {
        showEphemeralOtp(challengeId, code);
      } catch (e) {
        securityChallenges.delete(challengeId);
        throw e;
      }
      return json(res, 200, { ok: true, challengeId, expiresInSeconds: 45, message: 'A 256-bit one-time code is displayed temporarily in the Termux terminal. It is not returned to the browser.' });
    }
    if (req.method === 'POST' && url.pathname === '/api/unmask/otp/cancel') {
      const body = await readJson(req);
      const challengeId = String(body.challengeId || '');
      const challenge = securityChallenges.get(challengeId);
      if (challenge && challenge.kind === 'otp') securityChallenges.delete(challengeId);
      clearOtpTerminalDisplay(challengeId, 'DFOL: ephemeral authorization code canceled and discarded.');
      return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/unmask/otp/verify') {
      const body = await readJson(req);
      const challengeId = String(body.challengeId || '');
      const challenge = securityChallenges.get(challengeId);
      if (!challenge || challenge.kind !== 'otp') throw new Error('One-time code is missing, expired, or already used. Request a new code.');
      if (challenge.expiresAt <= Date.now()) {
        securityChallenges.delete(challengeId);
        clearOtpTerminalDisplay(challengeId, 'DFOL: ephemeral authorization code expired and was discarded.');
        throw new Error('One-time code expired after 45 seconds. Request a new code.');
      }
      challenge.attempts++;
      if (challenge.attempts > 5) {
        securityChallenges.delete(challengeId);
        clearOtpTerminalDisplay(challengeId, 'DFOL: ephemeral authorization code invalidated after too many attempts.');
        throw new Error('Too many attempts. The code was destroyed; request a new one.');
      }
      const submitted = normalizeEphemeralOtp(body.code || body.otp || '');
      const submittedDigest = sha256(Buffer.from(submitted, 'utf8')).toString('hex');
      if (!constantTimeTextEqual(challenge.otpDigest, submittedDigest)) {
        if (challenge.attempts >= 5) {
          securityChallenges.delete(challengeId);
          clearOtpTerminalDisplay(challengeId, 'DFOL: ephemeral authorization code invalidated after too many attempts.');
          throw new Error('Code incorrect. Attempt limit reached; request a new code.');
        }
        throw new Error(`Code incorrect. ${5 - challenge.attempts} attempt(s) remain.`);
      }
      securityChallenges.delete(challengeId);
      clearOtpTerminalDisplay(challengeId, 'DFOL: ephemeral authorization code verified and discarded.');
      return json(res, 200, { ok: true, approvalToken: createUnmaskApproval('termux-ephemeral-otp'), message: 'Termux one-time authorization verified.' });
    }
    if (req.method === 'POST' && url.pathname === '/api/check-export-name') return json(res,200,await checkExportFolderName(await readJson(req)));
    if (req.method === 'POST' && url.pathname === '/api/export') {
      const body = await readJson(req);
      const taskId=id();
      const task={id:taskId,status:'running',startedAt:Date.now(),result:null,error:null};
      exportTasks.set(taskId,task);
      setImmediate(async()=>{
        try { task.result=await exportJob(body); task.status=task.result.auditBlocked?'blocked':'complete'; }
        catch(e) { task.status='error'; task.error=e.message||'Export failed'; }
        task.finishedAt=Date.now();
      });
      return json(res,202,{ok:true,taskId,status:'running'});
    }
    if (req.method === 'GET' && url.pathname.startsWith('/api/export/')) {
      const task=exportTasks.get(url.pathname.split('/').pop());
      if(!task) throw new Error('Export task not found or expired.');
      return json(res,200,{id:task.id,status:task.status,startedAt:task.startedAt,finishedAt:task.finishedAt||null,result:task.result,error:task.error});
    }
    if (req.method === 'GET' && url.pathname === '/api/download') {
      const p = safePath(url.searchParams.get('path'));
      if (!p.startsWith(OUTPUT_ROOT + path.sep)) throw new Error('Only DFOL output files can be downloaded.');
      const st = await fsp.stat(p);
      if (!st.isFile()) throw new Error('Download target is not a file.');
      res.writeHead(200, {'Content-Type':p.toLowerCase().endsWith('.zip')?'application/zip':'application/octet-stream','Content-Length':st.size,'Content-Disposition':`attachment; filename="${path.basename(p).replace(/"/g,'')}"`,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});
      return fs.createReadStream(p).pipe(res);
    }
    json(res,404,{error:'Not found'});
  } catch (e) {
    json(res,400,{error:e.message || 'Request failed'});
  }
});
server.listen(PORT,HOST,() => {
  console.log(`DFOL running at http://${HOST}:${PORT}`);
  console.log('Unmasked export authorization uses only an ephemeral Termux OTP.');
  console.log(`Storage root: ${STORAGE_ROOT}`);
  console.log(`Output root:  ${OUTPUT_ROOT}`);
  console.log('Localhost only. Keep this server private; stop with Ctrl+C.');
});
