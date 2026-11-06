'use strict';
const ROOT='/storage/emulated/0';
const $=id=>document.getElementById(id);
const APP_STATE_KEY='dfol-session-v1';
let currentPath=ROOT, activeJob=null, findings=[], scanTimer=null, selectedFolder=null;
let maskingMode='masked', rawApprovalToken=null, pendingScanRequest=null, securityTimer=null, securityPurpose='export';
let activeExportTask=null, exportTimer=null, selectionEdited=false, booting=true;
let exportNameStatusState='checking', exportNameCheckTimer=null, exportNameCheckSeq=0;
let workflowStage=0; // 0: choose folder, 1: exclusions, 2: review/export, 3: result
let activeOtpChallengeId=null;
function readPersistedState(){try{const state=JSON.parse(localStorage.getItem(APP_STATE_KEY)||'{}');if(state&&typeof state==='object')delete state.exportFolderName;return state}catch{return {}}}
function saveAppState(extra={}){
  try {
    const state={...readPersistedState(),currentPath,activeJob,selectedFolder,workflowStage,view:document.querySelector('#exportResultPage:not(.hidden)')?'result':document.querySelector('#treeReview:not(.hidden)')?'tree':document.querySelector('#reviewArea:not(.hidden)')?'review':document.querySelector('#scanProgress:not(.hidden)')?'scanning':'explorer',
      exclusions:[...excludedPaths],rawGeneratedPaths:[...rawGeneratedPaths],includeGenerated:$('includeGenerated')?.checked||false,maskingMode,unmaskRawFiles:$('unmaskRawFiles')?.checked||false,
      selectedFindingIds:findings.filter(f=>f.selected).map(f=>f.id),selectionEdited,selectionJobId:activeJob,
      outputs:{combined:$('outCombined')?.checked??true,individual:$('outIndividual')?.checked??true,folderCopy:$('outCopy')?.checked??false,zip:$('outZip')?.checked??true,zipAll:$('zipAll')?.checked??true},
      useDeviceDateTime:$('useDeviceDateTime')?.checked??true,
      hiddenToggle:$('hiddenToggle')?.checked||false,activeExportTask};
    localStorage.setItem(APP_STATE_KEY,JSON.stringify({...state,...extra}));
  } catch {}
}
let pendingTree=null, excludedPaths=new Set(), rawGeneratedPaths=new Set();
let longPressTimer=null, longPressTriggered=false, touchStart=null;
let folderDraftSelections=null, activeDetailFolder='';
const expandedFindingFolders=new Set();

async function api(url, options={}) {
  const res=await fetch(url,{cache:'no-store',headers:{'Content-Type':'application/json'},...options});
  let data={}; try{data=await res.json()}catch{}
  if(!res.ok && !data.auditBlocked) throw new Error(data.error||data.message||`Request failed (${res.status})`);
  return data;
}
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),3200)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function fmtSize(n){if(n<1024)return `${n} B`;if(n<1048576)return `${(n/1024).toFixed(1)} KB`;return `${(n/1048576).toFixed(1)} MB`}
async function health(){
  try{const h=await api('/api/health');$('healthDot').className='dot '+(h.storageAccess?'ok':'');$('healthText').textContent=h.storageAccess?'Storage access ready':'Storage permission needed';if(!h.storageAccess)toast('Run: termux-setup-storage, then allow permission.')}
  catch(e){$('healthText').textContent='Backend unavailable';toast(e.message)}
}
async function loadDir(dir=currentPath){
  try{
    const data=await api('/api/list?path='+encodeURIComponent(dir));currentPath=data.path;if(!booting)saveAppState();
    $('currentPath').textContent=currentPath;$('upBtn').disabled=!data.parent;
    const showHidden=$('hiddenToggle').checked;
    const entries=data.entries.filter(e=>showHidden||!e.hidden);
    $('folderCount').textContent=`${entries.filter(e=>e.type==='directory').length} folders · ${entries.length} items`;
    const list=$('fileList');list.innerHTML='';
    if(!entries.length){list.innerHTML='<div class="empty">This folder is empty.</div>';return}
    for(const e of entries){
      const row=document.createElement('div');row.className='file-row';row.tabIndex=0;
      row.innerHTML=`<span class="file-icon">${e.type==='directory'?'▰':e.type==='symlink'?'↗':'·'}</span><span class="file-name">${esc(e.name)}</span><span class="file-meta">${e.type==='directory'?'Folder':fmtSize(e.size)}</span>`;
      row.addEventListener('click',()=>{if(longPressTriggered){longPressTriggered=false;return}if(e.type==='directory')loadDir(e.path);else toast('Files are not opened in DFOL.')});
      const start=()=>{longPressTriggered=false;clearTimeout(longPressTimer);longPressTimer=setTimeout(()=>{longPressTriggered=true;if(e.type==='directory')showExportChoice(e.path);else toast('Long-press a folder to choose an export action.')},560)};
      const end=()=>clearTimeout(longPressTimer);
      row.addEventListener('touchstart',start,{passive:true});row.addEventListener('touchend',end);row.addEventListener('touchmove',end);
      row.addEventListener('contextmenu',ev=>{ev.preventDefault();if(e.type==='directory')showExportChoice(e.path);else toast('Long-press a folder to choose an export action.')});
      row.addEventListener('pointerdown',ev=>{if(ev.pointerType==='mouse')start()});row.addEventListener('pointerup',end);row.addEventListener('pointerleave',end);
      list.appendChild(row);
    }
  }catch(e){toast(e.message);$('fileList').innerHTML=`<div class="empty">${esc(e.message)}</div>`}
}
function setBadge(text,cls=''){const b=$('scanBadge');b.textContent=text;b.className='badge '+cls}

function showExportChoice(folder){if(!folder)return;clearInterval(scanTimer);selectedFolder=folder;pendingTree=null;$('treeReview').classList.add('hidden');$('scanProgress').classList.add('hidden');$('reviewArea').classList.add('hidden');$('exportResultPage').classList.add('hidden');$('exportReviewSidebar').classList.add('hidden');$('explorerContent').classList.remove('hidden');$('emptyState').classList.remove('hidden');$('emptyState').innerHTML=`<div class="hero-icon">⇧</div><h3>Choose export type</h3><p class="choice-path">${esc(folder)}</p><div class="export-choice-grid"><button id="exportTreeChoice" class="export-choice-card" type="button"><span class="export-choice-icon">⌘</span><b>EXPORT TREE</b><small>Export the selected folder's directory map as Tree.txt.</small></button><button id="exportCodeChoice" class="export-choice-card primary-choice" type="button"><span class="export-choice-icon">{ }</span><b>EXPORT CODE</b><small>Continue to scan, review, mask and export project files.</small></button></div><label class="toggle tree-zip-option"><input id="treeZipChoice" type="checkbox" checked> Also create ZIP containing Tree.txt</label><div id="treeExportStatus" class="tree-export-status" aria-live="polite"></div><div class="privacy-note"><span>●</span> Tree export lists names and paths, not file contents.</div>`;$('analysisTitle').textContent='Folder export';$('analysisSubtitle').textContent='Choose Tree or Code for the selected folder.';$('leftPaneSubtitle').textContent='Selected folder: export tree or code';setBadge('EXPORT OPTIONS');$('exportTreeChoice').addEventListener('click',exportSelectedTree);$('exportCodeChoice').addEventListener('click',()=>openTreeReview(folder));saveAppState({view:'explorer',selectedFolder:folder});updateWorkflowNavigation();}
async function exportSelectedTree(){const folder=selectedFolder;if(!folder){toast('Long-press a folder first.');return}const btn=$('exportTreeChoice'),status=$('treeExportStatus');if(btn)btn.disabled=true;if(status)status.textContent='Generating Tree.txt…';try{const result=await api('/api/tree-export',{method:'POST',body:JSON.stringify({path:folder,zip:!!$('treeZipChoice')?.checked,useDeviceDateTime:true})});if(status)status.innerHTML=`<b>Tree export complete</b><br>Folder: <code>${esc(result.outputDir)}</code><br>Items: ${result.nodeCount}<br><a href="/api/download?path=${encodeURIComponent(result.treePath)}" download="Tree.txt">Download Tree.txt</a>${result.zipPath?`<br><a href="/api/download?path=${encodeURIComponent(result.zipPath)}" download="DFOL_Tree.zip">Download ZIP</a>`:''}`;toast('Tree.txt exported successfully.')}catch(e){if(status)status.textContent=e.message;toast(e.message)}finally{if(btn)btn.disabled=false}}

async function openTreeReview(folder, restore=false){
  if(!folder)return;
  clearInterval(scanTimer);if(!restore)activeJob=null;findings=[];expandedFindingFolders.clear();selectedFolder=folder;pendingTree=null;workflowStage=1;if(!restore){excludedPaths=new Set();rawGeneratedPaths=new Set();}saveAppState({view:'tree'});
  $('emptyState').classList.add('hidden');$('scanProgress').classList.add('hidden');$('reviewArea').classList.add('hidden');$('exportResultPage').classList.add('hidden');
  $('exportReviewSidebar').classList.add('hidden');$('explorerContent').classList.remove('hidden');$('leftPaneTitle').textContent='File explorer';$('leftPaneSubtitle').textContent='Long-press a folder to scan';
  $('treeReview').classList.remove('hidden');$('treeList').innerHTML='<div class="empty">Loading folder tree…</div>';
  $('treeRootPath').textContent=folder;$('treeConfirmPath').textContent=folder;$('treeCount').textContent='Loading…';
  $('analysisTitle').textContent='Review folder tree';$('analysisSubtitle').textContent='Select exclusions before scanning.';setBadge('TREE REVIEW');
  try{
    pendingTree=await api('/api/tree?path='+encodeURIComponent(folder));
    $('treeCount').textContent=pendingTree.nodeCount+(pendingTree.truncated?'+':'')+' items';
    $('treeTruncated').classList.toggle('hidden',!pendingTree.truncated);
    renderTree(pendingTree.tree);
    updateWorkflowNavigation();
  }catch(e){$('treeList').innerHTML=`<div class="empty">${esc(e.message)}</div>`;toast(e.message);updateWorkflowNavigation()}
}
function isPathExcluded(p){for(const x of excludedPaths)if(p===x||p.startsWith(x+'/'))return true;return false}
function isRawGenerated(p){for(const x of rawGeneratedPaths)if(p===x||p.startsWith(x+'/'))return true;return false}
function clearRawGeneratedUnder(p){for(const x of [...rawGeneratedPaths])if(x===p||x.startsWith(p+'/')||p.startsWith(x+'/'))rawGeneratedPaths.delete(x)}
function renderTree(rootNode){
  const list=$('treeList');list.innerHTML='';
  if(!rootNode){list.innerHTML='<div class="empty">Could not load this folder tree.</div>';return}
  function makeNodeElement(node){
    const wrap=document.createElement('div');wrap.className='tree-node';
    const row=document.createElement('div');row.className='tree-node-row';row.style.paddingLeft='5px';
    const hasChildren=node.type==='directory'&&Array.isArray(node.children)&&node.children.length>0;
    const twisty=document.createElement('button');twisty.className='tree-twisty'+(!hasChildren?' spacer':'');twisty.textContent=hasChildren?'▾':'·';twisty.type='button';twisty.setAttribute('aria-label','Expand or collapse');
    const check=document.createElement('input');check.type='checkbox';check.checked=node.generated?($('includeGenerated').checked&&!isRawGenerated(node.path)):isPathExcluded(node.path);check.disabled=node.type==='symlink'||(node.generated&&!$('includeGenerated').checked);check.title=node.generated?($('includeGenerated').checked?'Checked = scan/redact normally; untick = include this cache/generated path raw in ZIP only.':'Enable Include cache & generated files to choose individual generated paths.'):'Tick to exclude this path and its descendants';
    const kind=document.createElement('span');kind.className='tree-kind'+(node.generated?' generated-kind':'');kind.textContent=node.type==='directory'?'▰':node.type==='symlink'?'↗':'·';
    const info=document.createElement('div');info.className='tree-node-info';
    const name=document.createElement('div');name.className='tree-node-name'+(node.generated?' generated-name':'');name.textContent=node.name+(node.unreadable?' (unreadable)':'');
    const pathEl=document.createElement('div');pathEl.className='tree-node-path';pathEl.textContent=node.path;info.append(name,pathEl);
    if(node.generated){const tag=document.createElement('span');tag.className='generated-tag';tag.dataset.kind=node.generatedKind||'GENERATED';tag.textContent=tag.dataset.kind;tag.title=[node.generatedReason||'Matched the generated/cache filter catalog.',node.generatedRuleId?`Rule: ${node.generatedRuleId}`:'',node.generatedConfidence?`Confidence: ${node.generatedConfidence}`:'','Review the path before excluding it; custom project folders can share these names.'].filter(Boolean).join(' ');info.appendChild(tag);row.classList.add('is-generated');}
    row.append(twisty,check,kind,info);wrap.appendChild(row);
    const children=document.createElement('div');children.className='tree-children';
    if(hasChildren)wrap.appendChild(children);
    twisty.addEventListener('click',()=>{if(!hasChildren)return;const collapsed=children.classList.toggle('hidden');twisty.textContent=collapsed?'▸':'▾'});
    check.addEventListener('change',()=>{
      if(node.generated){
        if(check.checked)clearRawGeneratedUnder(node.path);
        else {for(const x of [...rawGeneratedPaths])if(x.startsWith(node.path+'/'))rawGeneratedPaths.delete(x);rawGeneratedPaths.add(node.path);}
      }else{if(check.checked)excludedPaths.add(node.path);else excludedPaths.delete(node.path);}
      renderTree(pendingTree.tree);saveAppState({view:'tree'});
    });
    row.classList.toggle('is-excluded',node.generated?isPathExcluded(node.path):check.checked);
    check.addEventListener('change',()=>row.classList.toggle('is-excluded',node.generated?isPathExcluded(node.path):check.checked));
    return {wrap,children,hasChildren};
  }
  const rootEntry=makeNodeElement(rootNode);list.appendChild(rootEntry.wrap);
  const stack=[];
  if(rootEntry.hasChildren)stack.push({node:rootNode,parent:rootEntry.children});
  while(stack.length){
    const frame=stack.pop();
    const children=Array.isArray(frame.node.children)?frame.node.children:[];
    for(const child of children){
      const entry=makeNodeElement(child);frame.parent.appendChild(entry.wrap);
      if(entry.hasChildren)stack.push({node:child,parent:entry.children});
    }
  }
  updateTreeSelection();
}
function updateTreeSelection(){
  $('excludeCount').textContent=`${excludedPaths.size} excluded · ${rawGeneratedPaths.size} raw ZIP override(s)`;
  $('treeConfirmPath').textContent=selectedFolder||'';
  document.querySelectorAll('.tree-node-row').forEach(row=>{
    const pathText=row.querySelector('.tree-node-path')?.textContent||'';
    const cb=row.querySelector('input[type=checkbox]');
    if(cb)row.classList.toggle('is-excluded',row.classList.contains('is-generated')?isPathExcluded(pathText):(cb.checked||isPathExcluded(pathText)));
  });
  document.querySelectorAll('.tree-node-row.is-generated').forEach(row=>{
    const cb=row.querySelector('input[type=checkbox]');
    const pathText=row.querySelector('.tree-node-path')?.textContent||'';
    const raw=isRawGenerated(pathText);
    row.classList.toggle('generated-included',$('includeGenerated').checked&&!raw);
    const tag=row.querySelector('.generated-tag');
    if(tag){const kind=tag.dataset.kind||'GENERATED';tag.textContent=raw?`${kind} · RAW ZIP`:( $('includeGenerated').checked?`✓ ${kind} · SCANNED`:`⊘ ${kind} · IGNORED`);}
  });
}

function updateGeneratedTreeState(){
  const include=$('includeGenerated').checked;
  document.querySelectorAll('.tree-node-row.is-generated').forEach(row=>{
    const cb=row.querySelector('input[type=checkbox]');
    const pathText=row.querySelector('.tree-node-path')?.textContent||'';
    const raw=isRawGenerated(pathText);
    row.classList.toggle('generated-included',include&&!raw);
    if(cb)cb.disabled=!include;
    if(cb)cb.checked=include&&!raw;
    const tag=row.querySelector('.generated-tag');
    if(tag){const kind=tag.dataset.kind||'GENERATED';tag.textContent=raw?`${kind} · RAW ZIP`:(include?`✓ ${kind} · SCANNED`:`⊘ ${kind} · IGNORED`);}
  });
}
$('includeGenerated').addEventListener('change',()=>{saveAppState();
  if(pendingTree)renderTree(pendingTree.tree);
  updateGeneratedTreeState();
  toast($('includeGenerated').checked?'Cache/generated files are selected for scanning by default. Untick an individual generated item to include it raw in the ZIP instead.':'Cache/generated files are ignored by default; individual generated overrides are preserved.');
});
$('treeSelectAll').addEventListener('click',()=>{
  if(!pendingTree)return;
  function collect(node){if(node.type!=='symlink'&&!node.generated)excludedPaths.add(node.path);(node.children||[]).forEach(collect)}
  rawGeneratedPaths.clear();collect(pendingTree.tree);renderTree(pendingTree.tree);saveAppState({view:'tree'});
});
$('treeClear').addEventListener('click',()=>{excludedPaths.clear();rawGeneratedPaths.clear();if(pendingTree)renderTree(pendingTree.tree);saveAppState({view:'tree'})});
$('beginScanBtn').addEventListener('click',()=>showPreScanConsent());
async function startScan(folder, exclusions=[], rawGenerated=[], selectedMaskingMode='masked', approvalToken=''){
  if(!folder)return;
  workflowStage=2;updateWorkflowNavigation();
  try{
    clearInterval(scanTimer);activeJob=null;findings=[];selectionEdited=false;expandedFindingFolders.clear();selectedFolder=folder;maskingMode=selectedMaskingMode==='raw'?'raw':'masked';$('confirmUnresolved').checked=false;$('unmaskRawFiles').checked=false;saveAppState({activeJob:null,activeExportTask:null,lastExport:null,selectionEdited:false,selectedFindingIds:[],view:'scanning',maskingMode});
    $('treeReview').classList.add('hidden');$('emptyState').classList.add('hidden');$('reviewArea').classList.add('hidden');$('scanProgress').classList.remove('hidden');$('exportReviewSidebar').classList.add('hidden');$('explorerContent').classList.remove('hidden');$('leftPaneTitle').textContent='File explorer';$('leftPaneSubtitle').textContent='Scanning selected folder';
    $('analysisTitle').textContent='Scanning folder';$('analysisSubtitle').textContent=folder;$('exportResult').classList.add('hidden');$('exportResultPage').classList.add('hidden');
    $('progressBar').style.width='0%';$('progressPercent').textContent='0%';$('progressLabel').textContent='Starting scanner…';setBadge('SCANNING','scanning');updateWorkflowNavigation();
    const result=await api('/api/scan',{method:'POST',body:JSON.stringify({path:folder,exclusions,rawGeneratedPaths:rawGenerated,includeGenerated:$('includeGenerated').checked,maskingMode,rawApprovalToken:approvalToken})});activeJob=result.id;saveAppState({view:'scanning',activeJob,maskingMode,selectionEdited:false,selectedFindingIds:[]});
    scanTimer=setInterval(pollScan,500);await pollScan();
  }catch(e){setBadge('ERROR');toast(e.message)}
}
async function pollScan(){
  if(!activeJob)return;
  try{
    const d=await api('/api/scan/'+activeJob);
    $('progressBar').style.width=d.progress+'%';$('progressPercent').textContent=d.progress+'%';$('progressLabel').textContent=d.status==='complete'?'Scan finished':d.status==='error'?'Scan stopped':'Scanning folders and readable text files…';
    $('filesScanned').textContent=d.filesSeen;$('readableFiles').textContent=d.readable;$('findingTotal').textContent=d.findingCount;$('skippedFiles').textContent=d.skipped;updateWorkflowNavigation();
    if(d.status==='complete'){clearInterval(scanTimer);showCompletedScan(d);return}
    if(d.status==='error'){clearInterval(scanTimer);setBadge('ERROR');toast(d.error||'Scan failed');saveAppState({view:'scanning'});return}
  }catch(e){clearInterval(scanTimer);toast(e.message)}
}
function showCompletedScan(d){
  workflowStage=2;
  const state=readPersistedState();
  const restoreSelection=state.selectionEdited&&state.selectionJobId===activeJob;
  const selectedIds=new Set(restoreSelection?state.selectedFindingIds||[]:[]);
  findings=(d.findings||[]).map(f=>({...f,selected:restoreSelection?selectedIds.has(f.id):Boolean(f.selected)}));
  maskingMode=d.maskingMode||maskingMode||'masked';
  $('unmaskRawFiles').checked=maskingMode==='raw'||Boolean(state.unmaskRawFiles&&state.activeJob===activeJob);
  if(maskingMode==='raw'&&!$('unmaskRawFiles').checked)$('unmaskRawFiles').checked=true;
  $('exportResultPage').classList.add('hidden');setBadge('REVIEW','complete');$('analysisTitle').textContent='Sanitize & export';$('analysisSubtitle').textContent=d.root;$('reviewArea').classList.remove('hidden');$('explorerContent').classList.add('hidden');$('treeReview').classList.add('hidden');$('scanProgress').classList.remove('hidden');$('exportReviewSidebar').classList.remove('hidden');$('leftPaneTitle').textContent='Export review';$('leftPaneSubtitle').textContent='Final included and masked folders';
  $('outCombined').checked=state.outputs?.combined??true;$('outIndividual').checked=state.outputs?.individual??true;$('outCopy').checked=state.outputs?.folderCopy??false;$('outZip').checked=state.outputs?.zip??true;$('zipAll').checked=state.outputs?.zipAll??true;$('zipAllWrap').classList.toggle('hidden',!$('outZip').checked);
  renderFindings(d);saveAppState({view:'review',activeJob,maskingMode,unmaskRawFiles:$('unmaskRawFiles').checked,expandedFindingFolders:[...expandedFindingFolders]});updateWorkflowNavigation();
}
function pathPartsForFinding(f){
  const parts=String(f.file||'').replace(/\\/g,'/').split('/').filter(Boolean);
  parts.pop();
  return parts;
}
function folderEntries(){
  const folders=new Map();
  for(const f of findings){
    const parts=pathPartsForFinding(f);
    if(!parts.length){if(!folders.has('.'))folders.set('.',[]);folders.get('.').push(f);continue}
    let prefix='';
    for(const part of parts){prefix=prefix?prefix+'/'+part:part;if(!folders.has(prefix))folders.set(prefix,[]);}
  }
  for(const [folder] of [...folders]){
    if(folder==='.')continue;
    const prefix=folder+'/';
    folders.set(folder,findings.filter(f=>String(f.file||'').replace(/\\/g,'/').startsWith(prefix)));
  }
  return [...folders.entries()].sort((a,b)=>a[0].localeCompare(b[0],undefined,{numeric:true}));
}
function findingsForFolder(folder){
  if(folder==='.')return findings.filter(f=>pathPartsForFinding(f).length===0);
  const prefix=folder+'/';
  return findings.filter(f=>String(f.file||'').replace(/\\/g,'/').startsWith(prefix));
}
function buildFindingFolderTree(){
  const root={name:'',path:'',children:new Map(),findings:[]};
  for(const f of findings){
    const parts=String(f.file||'').replace(/\\/g,'/').split('/').filter(Boolean);
    const fileName=parts.pop()||String(f.file||'Unknown file');
    let node=root;
    for(const part of parts){
      const nextPath=node.path?node.path+'/'+part:part;
      if(!node.children.has(part))node.children.set(part,{name:part,path:nextPath,children:new Map(),findings:[]});
      node=node.children.get(part);
    }
    node.findings.push({...f,_fileName:fileName});
  }
  return root;
}
function descendantFindings(node){
  const all=[...node.findings];
  for(const child of node.children.values())all.push(...descendantFindings(child));
  return all;
}
function renderSensitiveTree(){
  const host=$('folderSensitiveList');host.innerHTML='';
  if(!findings.length){host.innerHTML='<div class="empty">No sensitive findings detected by the current scan rules.</div>';renderExportFolderLists();updateSelectedCount();updateUnresolved();return}
  const root=buildFindingFolderTree();
  function renderFolder(node,depth=0){
    const wrap=document.createElement('section');wrap.className='sensitive-folder-node';
    const all=descendantFindings(node);
    const row=document.createElement('div');row.className='sensitive-folder-row';row.style.setProperty('--depth',depth);
    const toggle=document.createElement('button');toggle.type='button';toggle.className='folder-expand-btn';toggle.textContent='▸';toggle.setAttribute('aria-label','Open folder');
    const cb=document.createElement('input');cb.type='checkbox';cb.checked=all.length>0&&all.every(f=>f.selected);cb.setAttribute('aria-label',`Mask all sensitive findings in ${node.path||'root files'}`);
    const label=document.createElement('button');label.type='button';label.className='sensitive-folder-label';label.innerHTML=`<span class="folder-glyph">▰</span><span class="folder-label-name">${esc(node.name||'Root files')}</span><span class="folder-finding-count">${all.length}</span>`;
    row.append(toggle,cb,label);wrap.appendChild(row);
    const contents=document.createElement('div');
    const folderKey=node.path||'.';
    const initiallyOpen=expandedFindingFolders.has(folderKey);
    contents.className='sensitive-folder-contents';
    // Use both the hidden class and the native hidden property so expansion is
    // reliable in mobile Chrome even if stale CSS/classes survive a rerender.
    contents.hidden=!initiallyOpen;
    contents.style.display=initiallyOpen?'flex':'none';
    contents.classList.toggle('hidden',!initiallyOpen);
    toggle.textContent=initiallyOpen?'▾':'▸';
    toggle.setAttribute('aria-expanded',String(initiallyOpen));
    label.setAttribute('aria-expanded',String(initiallyOpen));
    const direct=node.findings.slice().sort((a,b)=>a._fileName.localeCompare(b._fileName,undefined,{numeric:true}));
    for(const f of direct){
      const fr=document.createElement('div');fr.className='sensitive-finding-row';
      fr.innerHTML=`<input type="checkbox" aria-label="Mask finding" ${f.selected?'checked':''}><div class="sensitive-finding-info"><div class="finding-title">${esc(f._fileName)} · ${esc(f.category)} <span class="severity ${esc(f.severity)}">${esc(f.severity)}</span></div><div class="finding-path">${esc(f.file)} · line ${f.line} · ${esc(f.confidence)} confidence</div><div class="snippet">${esc(f.snippet||'[line hidden]')}</div></div>`;
      fr.querySelector('input').addEventListener('change',ev=>{const target=findings.find(x=>x.id===f.id);if(target)target.selected=ev.target.checked;refreshSelectionViews()});
      contents.appendChild(fr);
    }
    for(const child of [...node.children.values()].sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true})))contents.appendChild(renderFolder(child,depth+1));
    if(!all.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='No findings in this folder.';contents.appendChild(empty)}
    const setExpanded=expanded=>{
      // Explicit inline display avoids mobile Chrome/CSS display:flex overriding [hidden].
      contents.hidden=!expanded;
      contents.style.display=expanded?'flex':'none';
      contents.classList.toggle('hidden',!expanded);
      if(expanded)expandedFindingFolders.add(folderKey);else expandedFindingFolders.delete(folderKey);
      toggle.textContent=expanded?'▾':'▸';
      toggle.setAttribute('aria-expanded',String(expanded));
      toggle.setAttribute('aria-label',expanded?'Collapse folder':'Open folder');
      label.setAttribute('aria-expanded',String(expanded));
      try{const st=readPersistedState();const list=new Set(st.expandedFindingFolders||[]);if(expanded)list.add(folderKey);else list.delete(folderKey);saveAppState({expandedFindingFolders:[...list]})}catch{}
    };
    const toggleExpanded=ev=>{
      ev.preventDefault();
      ev.stopPropagation();
      setExpanded(contents.style.display==='none'||contents.hidden||contents.classList.contains('hidden'));
    };
    toggle.addEventListener('click',toggleExpanded);
    label.addEventListener('click',toggleExpanded);
    // Make the row itself a convenient tap target, without hijacking checkbox taps.
    row.addEventListener('click',ev=>{
      if(ev.target===cb||ev.target===toggle||ev.target===label)return;
      if(ev.target.closest('input,button'))return;
      toggleExpanded(ev);
    });
    cb.addEventListener('change',()=>{all.forEach(f=>{const target=findings.find(x=>x.id===f.id);if(target)target.selected=cb.checked});refreshSelectionViews()});
    return wrap;
  }
  if(root.findings.length){const rootNode={...root,name:'Root files',path:'.'};host.appendChild(renderFolder(rootNode,0))}
  for(const child of [...root.children.values()].sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true})))host.appendChild(renderFolder(child,0));
  renderExportFolderLists();updateSelectedCount();updateUnresolved();
}
function renderExportFolderLists(){
  const folders=folderEntries(),include=[],masked=[];
  for(const [folder,items] of folders){
    if(!items.length)continue;
    if(items.some(f=>!f.selected))include.push({folder,items});
    if(items.some(f=>f.selected))masked.push({folder,items});
  }
  function renderList(id,items,emptyText){
    const host=$(id);host.innerHTML='';
    if(!items.length){host.innerHTML=`<div class="empty">${esc(emptyText)}</div>`;return}
    for(const entry of items){
      const b=document.createElement('button');b.type='button';b.className='export-folder-item';
      const raw=entry.items.filter(f=>!f.selected).length,maskedCount=entry.items.filter(f=>f.selected).length;
      b.innerHTML=`<span class="export-folder-icon">▰</span><span class="export-folder-name">${esc(entry.folder==='.'?'Root files':entry.folder)}</span><span class="export-folder-count">${raw} raw · ${maskedCount} masked</span><span class="export-folder-open">›</span>`;
      b.addEventListener('click',()=>{if(workflowStage===3){toast('Press Back to review before changing selections.');return;}openFolderDetail(entry.folder)});host.appendChild(b);
    }
  }
  renderList('includeFolderList',include,'No unmasked findings.');
  renderList('maskedFolderList',masked,'No masked findings.');
  $('includeFolderCount').textContent=String(include.length);$('maskedFolderCount').textContent=String(masked.length);
}
function openFolderDetail(folder){
  activeDetailFolder=folder;folderDraftSelections=new Map(findings.map(f=>[f.id,f.selected]));
  $('folderDetailTitle').textContent=folder==='.'?'Root files':folder;
  const relevant=findingsForFolder(folder);
  $('folderDetailSubtitle').textContent=`${relevant.length} sensitive finding(s) · review selection, then press Done`;
  const list=$('folderDetailList');list.innerHTML='';
  if(!relevant.length){list.innerHTML='<div class="empty">No sensitive findings in this folder.</div>'}
  relevant.forEach(f=>{
    const row=document.createElement('div');row.className='sensitive-finding-row';
    const rel=String(f.file||'').split('/').pop();
    row.innerHTML=`<input type="checkbox" aria-label="Mask finding" ${f.selected?'checked':''}><div class="sensitive-finding-info"><div class="finding-title">${esc(rel)} · ${esc(f.category)} <span class="severity ${esc(f.severity)}">${esc(f.severity)}</span></div><div class="finding-path">${esc(f.file)} · line ${f.line} · ${esc(f.confidence)} confidence</div><div class="snippet">${esc(f.snippet||'[line hidden]')}</div></div>`;
    row.querySelector('input').addEventListener('change',ev=>folderDraftSelections.set(f.id,ev.target.checked));list.appendChild(row);
  });
  $('folderDetailModal').classList.remove('hidden');
}
function closeFolderDetail(apply){
  if(apply&&folderDraftSelections){findings.forEach(f=>{if(folderDraftSelections.has(f.id))f.selected=folderDraftSelections.get(f.id)});renderSensitiveTree()}
  $('folderDetailModal').classList.add('hidden');folderDraftSelections=null;activeDetailFolder='';
}
$('closeFolderDetail').addEventListener('click',()=>closeFolderDetail(false));
$('doneFolderDetail').addEventListener('click',()=>closeFolderDetail(true));
$('folderDetailModal').addEventListener('click',ev=>{if(ev.target===$('folderDetailModal'))closeFolderDetail(false)});
function refreshSelectionViews(){selectionEdited=true;renderSensitiveTree();saveAppState()}
function renderFindings(){
  $('scanNotes').textContent='Pattern-based redaction may produce false positives: code literals, examples, fixtures, comments or syntax may be mistaken for sensitive data and masking can change behavior. It may also miss real secrets. Compare the exported output against the original source file before relying on it; inspect build/tests and the audit report. Only detected values selected for masking are changed—not every byte or every possible secret in the project.';
  renderSensitiveTree();
}
function updateSelectedCount(){$('selectedCount').textContent=`${findings.filter(f=>f.selected).length} masked · ${findings.filter(f=>!f.selected).length} raw`}
function syncExportConfirmation(){
  const checkbox=$('confirmUnresolved');
  const button=$('exportBtn');
  if(checkbox&&button&&!activeExportTask){
    const nameReady=exportNameStatusState==='available';
    button.disabled=!checkbox.checked||!nameReady;
    button.setAttribute('aria-disabled',String(button.disabled));
    button.title=!checkbox.checked?'Tick the confirmation checkbox below to enable export':!nameReady?'Choose a new, available export folder name':'Ready to sanitize and export';
  }
}
function updateUnresolved(){
  const unresolved=findings.filter(f=>!f.selected&&['critical','high'].includes(f.severity));
  $('unresolvedWarning').textContent=unresolved.length?`${unresolved.length} high-risk finding(s) will remain unmasked in the export. Confirm explicitly if you want to continue.`:'All detected high-risk findings are selected for masking. Pattern detection is not a guarantee.';
  $('confirmUnresolved').checked=false;
  syncExportConfirmation();
}
$('confirmUnresolved').addEventListener('change',syncExportConfirmation);
$('selectHighBtn').addEventListener('click',()=>{findings.forEach(f=>{if(['critical','high'].includes(f.severity))f.selected=true});refreshSelectionViews();updateUnresolved()});
$('selectAllBtn').addEventListener('click',()=>{findings.forEach(f=>f.selected=true);refreshSelectionViews();updateUnresolved()});
$('selectNoneBtn').addEventListener('click',()=>{findings.forEach(f=>f.selected=false);refreshSelectionViews();updateUnresolved()});
$('exportBtn').addEventListener('click',showExportPerformanceNotice);
syncExportConfirmation();
const EXPORT_PERFORMANCE_WARNING = `
  <div class="security-copy">
    <div class="security-alert"><b>No fixed DFOL file-count or file-size ceiling</b><br>DFOL does not impose an application-level maximum number of files or source-file size for scanning/tree generation/export.</div>
    <p>Very large projects can require substantial processing time, working memory, storage space and compression work. Performance and duration depend on the device's resources and operating environment rather than a fixed DFOL count/size cap.</p>
    <p>Android/Termux, the browser, filesystem, Node.js, available memory/storage and the ZIP tool still have physical/runtime limits. If those resources run out, the device may slow down, stop the process or fail to finish the export. DFOL cannot make finite device resources unlimited.</p>
    <p>Keep Termux and this page available while a large operation runs. Allow enough free storage for both the export folder and the ZIP, which may temporarily require additional space.</p>
  </div>`;
function showExportPerformanceNotice(){
  if(!activeJob)return toast('Scan a folder first.');
  if(exportNameStatusState!=='available')return toast(exportNameStatusState==='exists'?'That export folder already exists. Choose another name.':'Wait for DFOL to confirm that the export folder name is available.');
  if(activeExportTask)return toast('An export is already running; its status will resume after refresh.');
  const outputs={combined:$('outCombined').checked,individual:$('outIndividual').checked,folderCopy:$('outCopy').checked,zip:$('outZip').checked,zipAll:$('zipAll').checked};
  if(!Object.values(outputs).some(Boolean))return toast('Choose at least one output type.');
  showSecurityModal('Large export — device performance notice','Review before starting the export.',EXPORT_PERFORMANCE_WARNING,
    '<button id="continueLargeExportBtn" class="primary" type="button">I understand — continue export</button><button id="cancelLargeExportBtn" class="secondary" type="button">Cancel</button>');
  $('continueLargeExportBtn').addEventListener('click',()=>{closeSecurityModal();doExport();});
  $('cancelLargeExportBtn').addEventListener('click',closeSecurityModal);
}
function setExportPerformanceNotice(visible){
  const notice=$('exportPerformanceNotice');
  if(notice)notice.classList.toggle('hidden',!visible);
}
async function doExport(){
  if(!activeJob)return toast('Scan a folder first.');
  if(exportNameStatusState!=='available')return toast(exportNameStatusState==='exists'?'That export folder already exists. Choose another name.':'Wait for DFOL to confirm that the export folder name is available.');
  if(activeExportTask)return toast('An export is already running; its status will resume after refresh.');
  if($('unmaskRawFiles').checked&&!rawApprovalToken){showRawWarning('export');return}
  const outputs={combined:$('outCombined').checked,individual:$('outIndividual').checked,folderCopy:$('outCopy').checked,zip:$('outZip').checked,zipAll:$('zipAll').checked};
  if(!Object.values(outputs).some(Boolean))return toast('Choose at least one output type.');
  setExportPerformanceNotice(true);$('exportBtn').disabled=true;$('exportStatus').textContent='Starting export…';$('exportResult').classList.add('hidden');$('exportResultPage').classList.add('hidden');workflowStage=2;updateWorkflowNavigation();
  try{
    const start=await api('/api/export',{method:'POST',body:JSON.stringify({jobId:activeJob,selectedFindingIds:findings.filter(f=>f.selected).map(f=>f.id),outputs,confirmUnresolved:$('confirmUnresolved').checked,unmaskFiles:$('unmaskRawFiles').checked,rawApprovalToken,exportFolderName:$('exportFolderName').value,useDeviceDateTime:$('useDeviceDateTime').checked})});
    if(start.needsConfirmation){$('exportBtn').disabled=false;$('unresolvedWarning').textContent=start.message+` Remaining high-risk findings: ${start.unresolvedCount}.`;$('exportStatus').textContent='Confirmation required';toast('Review remaining high-risk findings and confirm explicitly.');return}
    if(!start.taskId)throw new Error(start.error||'Could not start export task.');
    activeExportTask=start.taskId;saveAppState({activeExportTask,view:'review'});$('exportStatus').textContent='Sanitizing, exporting and auditing…';
    clearInterval(exportTimer);exportTimer=setInterval(()=>pollExportTask(activeExportTask),700);await pollExportTask(activeExportTask);
  }catch(e){$('exportStatus').textContent='Export failed';toast(e.message)}
  finally{if(!activeExportTask){setExportPerformanceNotice(false);syncExportConfirmation()}}
}
async function pollExportTask(taskId){
  if(!taskId)return;
  try{
    const task=await api('/api/export/'+encodeURIComponent(taskId));
    if(task.status==='running'){setExportPerformanceNotice(true);$('exportStatus').textContent='Export is running on the Termux server. Refreshing the page will resume this status.';return}
    clearInterval(exportTimer);activeExportTask=null;setExportPerformanceNotice(false);syncExportConfirmation();saveAppState({activeExportTask:null});
    if(task.status==='error'){ $('exportStatus').textContent='Export failed';$('exportResult').classList.remove('hidden');$('exportResult').textContent=task.error||'Export failed';scheduleExportNameCheck(0);toast(task.error||'Export failed');if($('unmaskRawFiles').checked&&/authorization.*expired|authorization.*missing/i.test(task.error||'')){rawApprovalToken=null;showRawWarning('export');return;}workflowStage=3;setWorkflowStage(3);return; }
    const result=task.result||{};
    if(result.needsConfirmation){$('unresolvedWarning').textContent=result.message+` Remaining high-risk findings: ${result.unresolvedCount}.`;$('exportStatus').textContent='Confirmation required';toast('Review remaining high-risk findings and confirm explicitly.');return}
    if(result.auditBlocked||task.status==='blocked'){scheduleExportNameCheck(0);$('exportStatus').textContent='Final audit blocked export';$('exportResult').classList.remove('hidden');$('exportResult').textContent=result.message+' '+(result.auditIssues||[]).join('; ');workflowStage=3;setWorkflowStage(3);return}
    if(result.ok){
      $('exportStatus').textContent=result.rawExport?'Export completed — RAW SENSITIVE DATA INCLUDED':'Export audited';
      const el=$('exportResult');el.classList.remove('hidden');
      let html=`<b>${result.rawExport?'RAW EXPORT COMPLETED':'Export completed'}</b><br>Location: <code>${esc(result.outputDir)}</code><br>Masked findings requested: ${result.report.selectedForMasking}<br>Unresolved high-risk findings: ${result.report.unresolvedHighRisk}<br>Audit pattern matches: ${result.report.auditIssues.length}<br>`;
      html+=`<br><a href="/api/download?path=${encodeURIComponent(result.outputDir+'/Tree.txt')}" download="Tree.txt">Download Tree.txt</a>`;if(result.zipPath){const zipUrl='/api/download?path='+encodeURIComponent(result.zipPath);html+=`<br><a id="downloadZipLink" href="${zipUrl}" download="DFOL_export.zip">Download ZIP</a>`;}
      if(result.rawExport)html+=`<br><div class="raw-result-warning"><b>Raw export warning:</b> scanned source files were copied unchanged. Sensitive values may be present. The audit was informational and did not block this explicitly authorized raw export.</div>`;
      html+=`<br><small>Review DFOL_audit_report.json and compare output against original source files. Pattern matching is not a guarantee that all secrets were found.</small>`;
      el.innerHTML=html;toast(result.rawExport?'Raw export created. Handle it securely.':'Export created.');$('exportFolderName').value='';updateExportNameControls();saveAppState({lastExport:{outputDir:result.outputDir,zipPath:result.zipPath||null,rawExport:!!result.rawExport,report:result.report},view:'review'});workflowStage=3;setWorkflowStage(3);
      if(result.rawExport)rawApprovalToken=null;
    }
  }catch(e){clearInterval(exportTimer);activeExportTask=null;saveAppState({activeExportTask:null});$('exportStatus').textContent='Could not recover export status';toast(e.message)}
}
// High-friction consent flow for scanning and any explicitly unmasked export.
const FALSE_POSITIVE_WARNING = `
  <div class="security-copy">
    <div class="security-alert"><b>Important:</b> DFOL uses local, pattern-based detection. It is a review aid, not a guarantee of security.</div>
    <h4>What masking does</h4><p>DFOL looks for configured patterns that resemble credentials or personal information. Selected matches are replaced in supported text exports. It does not understand the intent or semantics of every programming language, configuration format, code sample, test fixture, comment or string literal.</p>
    <h4>False positives can change code</h4><p>A valid code value, placeholder, test token, example email, phone-like number, documentation snippet or syntax fragment can be mistaken for sensitive information. If that finding is masked, the exported copy may no longer behave like the original code, may fail tests, or may become syntactically invalid. Always cross-check the exported version with the original source files and run appropriate build/tests before using it.</p>
    <h4>False negatives are also possible</h4><p>Secrets can use formats that DFOL does not recognize, be split across lines, be encoded or encrypted, be located in binary files or archives, or be stored in files excluded by its scanning rules. Some files are skipped based on name, type, size or readability. “No finding” does not mean “no sensitive data.”</p>
    <h4>Review responsibility</h4><p>Inspect the final TXT/folder/ZIP output and the audit report manually. Do not assume an audit pass proves that all secrets are gone. Keep the original source untouched and compare meaningful changes before sharing or deploying any sanitized copy.</p>
  </div>`;
const RAW_EXPORT_DISCLAIMER = `
  <div class="security-copy raw-disclaimer">
    <div class="security-alert critical"><b>HIGH-RISK ACTION — UNMASKED DATA MAY LEAVE YOUR DEVICE</b><br>This option intentionally exports scanned source-file contents unchanged. It can include passwords, API keys, bearer tokens, private-key material, database credentials, personal information, internal URLs, proprietary code and other confidential data found in those files.</div>
    <h4>1. What this option does</h4><p>When the raw option is used, the scanned text files that DFOL successfully read are copied into the export without replacing detected values. The ZIP/folder can therefore contain the original sensitive strings even when the findings list shows them. The ordinary masking selections do not sanitize those unchanged copies. The scanner still excludes unsupported/non-text file categories and configured sensitive filename/data types by default; there is no DFOL-defined file-count or file-size ceiling. Separately configured cache/generated overrides may also be copied raw according to their own setting.</p>
    <h4>2. Data exposure and downstream copies</h4><p>Anyone who can access the exported file, its ZIP, your shared-storage dump directory, backups, cloud-synced folders, messaging attachments, or a device to which you copy it may be able to read its contents. Once exported or shared, data can be duplicated, indexed, backed up, forwarded or retained outside DFOL’s control. Deleting the local copy later cannot guarantee deletion of every copy.</p>
    <h4>3. Credentials can grant real access</h4><p>Exposed credentials may permit access to source repositories, cloud accounts, databases, APIs, customer systems, deployment pipelines or other services. If any secret is accidentally disclosed, treat it as compromised: revoke or rotate it, review provider audit logs, invalidate sessions where appropriate, and follow your organization’s incident-response procedures. Do not use production credentials in demonstrations or share raw dumps casually.</p>
    <h4>4. Scope and limitations</h4><p>DFOL is a local utility, not a managed security service, secret vault, legal adviser or compliance certification. It cannot determine whether you have permission to export a particular file, cannot enforce the recipient’s handling of it, and cannot guarantee that all sensitive data has been detected. The scan and audit are heuristic checks only. They can miss secrets or produce false positives. A successful export is not a clean bill of health.</p>
    <h4>5. Preserve the original and verify the result</h4><p>DFOL does not intentionally modify your original source files. However, exports may be saved in shared storage, and other applications on the device may be able to access them depending on Android permissions. Confirm the source path, output folder, file names and ZIP contents before sharing. Use the raw option only for a specific, justified purpose and only after checking the recipient, destination and authorization to disclose all included material.</p>
    <h4>6. User authorization and responsibility</h4><p>By proceeding, you confirm that you understand the export may contain secrets and personal or confidential data; you are authorized to create and handle this copy; you will protect it, share it only with approved recipients, and rotate/revoke exposed credentials if necessary. You accept responsibility for your selection and for reviewing the resulting files. DFOL is provided on an “as is” basis without a guarantee of detection, masking, confidentiality, suitability or fitness for a particular purpose. To the extent permitted by applicable law, the project author/operator is not responsible for losses, unauthorized disclosure, downstream copying, credential misuse, service disruption or other consequences arising from your decision to export or share unmasked data. This notice does not remove any non-waivable rights or obligations under applicable law.</p>
    <h4>7. Final confirmation</h4><p>Do not continue if you are unsure, if you did not inspect the destination, or if you do not have authority to disclose the data. Canceling is the safe choice. The delay and one-time verification are deliberate safeguards against accidental taps; they are not proof that the chosen export is appropriate.</p>
    <label class="security-agree"><input id="rawRiskAgreement" type="checkbox"><span>I have read the full warning, understand that the export may contain real sensitive information, and explicitly accept responsibility for authorizing an unmasked export.</span></label>
  </div>`;
function showSecurityModal(title,subtitle,content,actionsHtml){
  clearInterval(securityTimer);securityTimer=null;
  $('securityModalTitle').textContent=title;$('securityModalSubtitle').textContent=subtitle;
  $('securityModalContent').innerHTML=content;$('securityModalActions').innerHTML=actionsHtml;
  $('securityModal').classList.remove('hidden');
}
function closeSecurityModal(){
  clearInterval(securityTimer);securityTimer=null;
  const input=$('rawOtpInput');if(input){input.value='';input.disabled=true;}
  const challengeId=activeOtpChallengeId;activeOtpChallengeId=null;
  $('securityModal').classList.add('hidden');
  if(challengeId)void cancelOtpChallenge(challengeId);
}
$('closeSecurityModal').addEventListener('click',()=>{closeSecurityModal();toast('Confirmation canceled. No scan/export authorization was granted.');});
function showPreScanConsent(){
  if(!selectedFolder)return toast('Select a folder and confirm exclusions first.');
  pendingScanRequest={folder:selectedFolder,exclusions:[...excludedPaths],rawGenerated:[...rawGeneratedPaths]};
  let remaining=10;
  showSecurityModal('Sensitive-data handling','Review the limitations before the scan starts.',FALSE_POSITIVE_WARNING+`<div class="countdown-panel">Continue buttons unlock in <strong id="preScanCountdown">10</strong> seconds. This pause is intentional to prevent an accidental tap.</div>`,
    `<button id="continueMaskedBtn" class="primary" type="button" disabled>Proceed with masking</button><button id="continueRawBtn" class="danger-button" type="button" disabled>Choose unmasked export</button><button id="cancelPreScanBtn" class="secondary" type="button">Cancel</button>`);
  $('continueMaskedBtn').addEventListener('click',()=>{if(remaining>0)return;closeSecurityModal();const r=pendingScanRequest;pendingScanRequest=null;if(r)startScan(r.folder,r.exclusions,r.rawGenerated,'masked','')});
  $('continueRawBtn').addEventListener('click',()=>{if(remaining>0)return;const r=pendingScanRequest;if(!r)return;securityPurpose='scan';showRawWarning('scan')});
  $('cancelPreScanBtn').addEventListener('click',closeSecurityModal);
  securityTimer=setInterval(()=>{remaining=Math.max(0,remaining-1);const c=$('preScanCountdown');if(c)c.textContent=String(remaining);if(remaining===0){clearInterval(securityTimer);securityTimer=null;$('continueMaskedBtn').disabled=false;$('continueRawBtn').disabled=false;}},1000);
}
function showRawWarning(purpose='export'){
  securityPurpose=purpose;
  showSecurityModal('Unmasked export — explicit risk acceptance','This is a separate, high-risk path. Read all sections before accepting.',RAW_EXPORT_DISCLAIMER,
    `<button id="beginRawHoldBtn" class="danger-button" type="button" disabled>I have read and agree — begin 30-second hold</button><button id="cancelRawWarningBtn" class="secondary" type="button">Cancel</button>`);
  $('rawRiskAgreement').addEventListener('change',()=>{$('beginRawHoldBtn').disabled=!$('rawRiskAgreement').checked});
  $('beginRawHoldBtn').addEventListener('click',()=>{
    if(!$('rawRiskAgreement').checked)return;
    let remaining=30;
    $('securityModalActions').innerHTML=`<button id="confirmAfterRawHoldBtn" class="danger-button" type="button" disabled>Confirm unmasked path (${remaining}s)</button><button id="cancelRawHoldBtn" class="secondary" type="button">Cancel</button>`;
    const status=document.createElement('div');status.className='countdown-panel';status.id='rawHoldCountdown';status.innerHTML=`Safety hold in progress: <strong>${remaining}</strong> seconds remaining. Keep this page open; you can still cancel.`;$('securityModalContent').appendChild(status);
    $('cancelRawHoldBtn').addEventListener('click',closeSecurityModal);
    $('confirmAfterRawHoldBtn').addEventListener('click',()=>{if(remaining>0)return;showOtpEntry()});
    securityTimer=setInterval(()=>{remaining=Math.max(0,remaining-1);const c=$('rawHoldCountdown');if(c)c.innerHTML=remaining?`Safety hold in progress: <strong>${remaining}</strong> seconds remaining. Keep this page open; you can still cancel.`:'Safety hold complete. Read the warning once more before continuing.';const b=$('confirmAfterRawHoldBtn');if(b){b.disabled=remaining>0;b.textContent=remaining?`Confirm unmasked path (${remaining}s)`:'Confirm unmasked path and verify';}if(remaining===0){clearInterval(securityTimer);securityTimer=null;}},1000);
  });
  $('cancelRawWarningBtn').addEventListener('click',closeSecurityModal);
}
async function cancelOtpChallenge(challengeId){
  try { await api('/api/unmask/otp/cancel',{method:'POST',body:JSON.stringify({challengeId})}); } catch {}
}
async function showOtpEntry(){
  try{
    const request=await api('/api/unmask/otp/request',{method:'POST',body:JSON.stringify({})});
    activeOtpChallengeId=request.challengeId;
    let remaining=Number(request.expiresInSeconds)||45;
    showSecurityModal('Enter one-time Termux verification code','This high-entropy code exists for 45 seconds and is single-use.',
      `<div class="security-copy"><p>The local Node server has displayed a <b>256-bit one-time code</b> in the temporary Termux terminal screen. It is not sent to this webpage, written to a file, or saved in browser storage. It expires after 45 seconds, is destroyed after successful verification or cancellation, and permits at most five attempts.</p><div class="countdown-panel">Code expires in <strong id="otpExpiresCountdown">45</strong> seconds.</div><label class="otp-field">One-time code<input id="rawOtpInput" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" maxlength="71" pattern="[A-Fa-f0-9-]{64,71}" placeholder="AB12CDEF-01234567-…"></label><p class="muted-note">Enter all 64 hexadecimal characters. Hyphens are optional; letter case does not matter.</p></div>`,
      `<button id="verifyOtpBtn" class="primary" type="button">Verify code</button><button id="requestNewOtpBtn" class="secondary" type="button">Generate a new code</button><button id="backOtpBtn" class="secondary" type="button">Back to warning</button><button id="cancelOtpBtn" class="secondary" type="button">Cancel</button>`);
    const expiresAt=Date.now()+remaining*1000;
    const updateCountdown=()=>{
      remaining=Math.max(0,Math.ceil((expiresAt-Date.now())/1000));
      const c=$('otpExpiresCountdown');if(c)c.textContent=String(remaining);
      const b=$('verifyOtpBtn');if(b)b.disabled=remaining<=0;
      if(remaining<=0){clearInterval(securityTimer);securityTimer=null;const input=$('rawOtpInput');if(input){input.value='';input.disabled=true;}const info=$('otpExpiresCountdown');if(info&&info.parentElement)info.parentElement.innerHTML='Code <strong>expired</strong>. Generate a new code to continue.';}
    };
    securityTimer=setInterval(updateCountdown,200);updateCountdown();
    $('verifyOtpBtn').addEventListener('click',async()=>{
      try{
        if(Date.now()>=expiresAt)throw new Error('Code expired after 45 seconds. Generate a new one.');
        const value=$('rawOtpInput').value.trim().toUpperCase().replace(/[\s-]/g,'');
        if(!/^[A-F0-9]{64}$/.test(value))throw new Error('Enter the complete 64-character hexadecimal code from Termux.');
        const result=await api('/api/unmask/otp/verify',{method:'POST',body:JSON.stringify({challengeId:request.challengeId,code:value})});
        clearInterval(securityTimer);securityTimer=null;activeOtpChallengeId=null;
        await completeRawAuthorization(result.approvalToken,'Termux one-time code');
      }catch(e){toast(e.message);if(/expired|attempt limit|already used|missing/i.test(e.message)){clearInterval(securityTimer);securityTimer=null;activeOtpChallengeId=null;const input=$('rawOtpInput');if(input){input.value='';input.disabled=true;}const b=$('verifyOtpBtn');if(b)b.disabled=true;}else $('rawOtpInput')?.focus();}
    });
    $('requestNewOtpBtn').addEventListener('click',async()=>{await cancelOtpChallenge(request.challengeId);activeOtpChallengeId=null;showOtpEntry()});
    $('backOtpBtn').addEventListener('click',async()=>{await cancelOtpChallenge(request.challengeId);activeOtpChallengeId=null;closeSecurityModal();showRawWarning(securityPurpose)});
    $('cancelOtpBtn').addEventListener('click',async()=>{await cancelOtpChallenge(request.challengeId);activeOtpChallengeId=null;closeSecurityModal();toast('Authorization canceled; the temporary code was discarded.')});
  }catch(e){toast(e.message)}
}
async function completeRawAuthorization(token,method){
  rawApprovalToken=token;
  if(securityPurpose==='scan'){
    const r=pendingScanRequest;
    if(!r)throw new Error('Pending scan selection was lost. Repeat the confirmation.');
    closeSecurityModal();pendingScanRequest=null;
    $('unmaskRawFiles').checked=true;maskingMode='raw';
    toast(`${method} verified. Starting scan; raw export remains an explicit option.`);
    await startScan(r.folder,r.exclusions,r.rawGenerated,'raw',token);
  }else{
    $('unmaskRawFiles').checked=true;saveAppState({unmaskRawFiles:true});closeSecurityModal();toast(`${method} verified. Click Sanitize & export to create the explicitly unmasked copy.`);
  }
}
$('unmaskRawFiles').addEventListener('change',ev=>{
  if(ev.target.checked){ev.target.checked=false;showRawWarning('export');return;}
  rawApprovalToken=null;
  // Switching away from the full raw-file export returns findings to the safe mask-by-default state.
  findings.forEach(f=>{f.selected=true});selectionEdited=false;maskingMode='masked';refreshSelectionViews();saveAppState({unmaskRawFiles:false,maskingMode:'masked'});
});
$('upBtn').addEventListener('click',()=>{if(currentPath!==ROOT)loadDir(currentPath.substring(0,currentPath.lastIndexOf('/'))||ROOT)});
$('homeBtn').addEventListener('click',()=>loadDir(ROOT));
$('refreshBtn').addEventListener('click',()=>{health();loadDir(currentPath)});
$('hiddenToggle').addEventListener('change',()=>{saveAppState();loadDir(currentPath)});
$('outZip').addEventListener('change',()=>{$('zipAllWrap').classList.toggle('hidden',!$('outZip').checked);saveAppState()});
['outCombined','outIndividual','outCopy','zipAll','confirmUnresolved'].forEach(id=>$(id).addEventListener('change',()=>saveAppState()));

// Dark/light theme: user choice persists locally in this browser.
function applyTheme(theme){
  const chosen=theme==='light'?'light':'dark';
  document.documentElement.dataset.theme=chosen;
  document.documentElement.style.colorScheme=chosen;
  $('themeBtn').textContent=chosen==='dark'?'☀':'☾';
  $('themeBtn').title=chosen==='dark'?'Switch to light mode':'Switch to dark mode';
  $('themeBtn').setAttribute('aria-label',$('themeBtn').title);
  try{localStorage.setItem('dfol-theme',chosen)}catch{}
}
let savedTheme='dark';try{savedTheme=localStorage.getItem('dfol-theme')||'dark'}catch{}
applyTheme(savedTheme);
$('themeBtn').addEventListener('click',()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));


function updateWorkflowNavigation(){
  const back=$('workflowBack'),next=$('workflowNext'),label=$('workflowStepLabel'),hint=$('workflowNavHint');
  if(!back||!next||!label)return;
  const scanRunning=Boolean(activeJob&&$('scanBadge')?.textContent==='SCANNING');
  const hasExport=Boolean($('exportResult')&&!$('exportResult').classList.contains('hidden')&&$('exportResult').innerHTML.trim());
  const names=['Choose folder','Folder filters','Sensitive review & export','Export result'];
  label.textContent=`STEP ${workflowStage+1} OF 4 · ${names[workflowStage]||names[0]}`;
  back.textContent=workflowStage===3?'← Back to review':workflowStage===2?'← Back to folders':workflowStage===1?'← Back to files':'← Back';
  back.disabled=workflowStage===0||(workflowStage===2&&scanRunning);
  next.textContent=workflowStage===0?'Next: folder filters →':workflowStage===1?'Confirm & scan →':workflowStage===2?'Next: export result →':'Complete · Start again';
  next.disabled=(workflowStage===0&&!selectedFolder)||(workflowStage===1&&!selectedFolder)||(workflowStage===2&&(!hasExport||scanRunning))||scanRunning;
  if(hint){hint.textContent=workflowStage===1?'Review folders, then use Next to open the scan confirmation.':workflowStage===2?(hasExport?'Export result is available. Use Next to review it.':'Set options and press “Sanitize & export”; Next unlocks after completion.'):workflowStage===3?'Export result page. Use Back to return to review.':'Long-press a folder on the left, or select a folder and continue.';}
}
async function setWorkflowStage(stage){
  stage=Math.max(0,Math.min(3,Number(stage)||0));
  if(stage===1){
    if(!selectedFolder)return toast('Select a folder first.');
    try{
      if(!pendingTree||pendingTree.root!==selectedFolder){pendingTree=await api('/api/tree?path='+encodeURIComponent(selectedFolder));}
      $('treeRootPath').textContent=selectedFolder;$('treeConfirmPath').textContent=selectedFolder;
      $('treeCount').textContent=String(pendingTree.nodeCount)+(pendingTree.truncated?'+':'')+' items';
      $('treeTruncated').classList.toggle('hidden',!pendingTree.truncated);
      renderTree(pendingTree.tree);
    }catch(e){return toast(e.message)}
  }
  if(stage===2&&!activeJob&&(!$('exportResult')||$('exportResult').classList.contains('hidden')||!$('exportResult').innerHTML.trim()))return toast('Complete the folder scan before opening sensitive review.');
  if(stage===3&&(!$('exportResult')||$('exportResult').classList.contains('hidden')||!$('exportResult').innerHTML.trim()))return toast('First press “Sanitize & export” and wait for the result.');
  workflowStage=stage;
  $('emptyState').classList.toggle('hidden',stage!==0);
  $('treeReview').classList.toggle('hidden',stage!==1);
  const running=Boolean(activeJob&&$('scanBadge')?.textContent==='SCANNING');
  $('scanProgress').classList.toggle('hidden',stage===0||stage===1||stage===3||!activeJob);
  $('reviewArea').classList.toggle('hidden',stage!==2||running);
  $('exportResultPage').classList.toggle('hidden',stage!==3);
  $('explorerContent').classList.toggle('hidden',stage===2||stage===3);
  $('exportReviewSidebar').classList.toggle('hidden',stage!==2&&stage!==3);
  if(stage===0){
    $('leftPaneTitle').textContent='File explorer';$('leftPaneSubtitle').textContent='Long-press a folder to scan';
    $('analysisTitle').textContent='Scan & review';$('analysisSubtitle').textContent='Choose a folder on the left, then continue.';
  }else if(stage===1){
    $('leftPaneTitle').textContent='File explorer';$('leftPaneSubtitle').textContent='Folder tree is being reviewed';
    $('analysisTitle').textContent='Review folder tree';$('analysisSubtitle').textContent='Select exclusions before scanning.';setBadge('TREE REVIEW');
  }else if(stage===2){
    $('leftPaneTitle').textContent='Export review';$('leftPaneSubtitle').textContent='Final included and masked folders';
    if(running){$('analysisTitle').textContent='Scanning folder';$('analysisSubtitle').textContent=selectedFolder||'';}else{$('analysisTitle').textContent='Sanitize & export';$('analysisSubtitle').textContent=selectedFolder||'';}
  }else{
    $('leftPaneTitle').textContent='Export summary';$('leftPaneSubtitle').textContent='Completed output';
    $('analysisTitle').textContent='Export result';$('analysisSubtitle').textContent='Review output path and audit summary.';
  }
  updateWorkflowNavigation();
  saveAppState({workflowStage,view:stage===0?'explorer':stage===1?'tree':stage===2?'review':'result'});
  const pane=document.querySelector('.analysis-pane');if(pane)pane.scrollTo({top:0,behavior:'smooth'});
  window.scrollTo({top:0,behavior:'smooth'});
}
$('workflowBack').addEventListener('click',()=>{
  if(workflowStage===1)setWorkflowStage(0);
  else if(workflowStage===2&&!($('scanBadge')?.textContent==='SCANNING'))setWorkflowStage(1);
  else if(workflowStage===3){if(activeJob)setWorkflowStage(2);else setWorkflowStage(0);}
});
$('workflowNext').addEventListener('click',()=>{
  if(workflowStage===0){if(selectedFolder)setWorkflowStage(1);else toast('Long-press a folder on the left to select it first.');}
  else if(workflowStage===1){if(selectedFolder)showPreScanConsent();else toast('Select a folder first.');}
  else if(workflowStage===2){if(!$('exportResult').classList.contains('hidden'))setWorkflowStage(3);else { $('exportBtn').scrollIntoView({behavior:'smooth',block:'center'});toast('Choose outputs and press “Sanitize & export”. Next will open the result after export completes.');}}
  else if(workflowStage===3)startNewSession();
});
function startNewSession(){
  clearInterval(scanTimer);clearInterval(exportTimer);clearInterval(securityTimer);
  activeJob=null;activeExportTask=null;selectedFolder=null;findings=[];pendingTree=null;excludedPaths=new Set();rawGeneratedPaths=new Set();expandedFindingFolders.clear();selectionEdited=false;rawApprovalToken=null;activeOtpChallengeId=null;pendingScanRequest=null;workflowStage=0;
  try{localStorage.removeItem(APP_STATE_KEY)}catch{}
  $('exportResult').innerHTML='';$('exportResult').classList.add('hidden');$('exportResultPage').classList.add('hidden');$('reviewArea').classList.add('hidden');$('treeReview').classList.add('hidden');$('scanProgress').classList.add('hidden');$('exportReviewSidebar').classList.add('hidden');$('explorerContent').classList.remove('hidden');$('emptyState').classList.remove('hidden');
  $('emptyState').innerHTML='<div class="hero-icon">⌕</div><h3>Inspect before you export</h3><p>Long-press a folder to review its complete tree. Select anything to exclude before scanning for sensitive information.</p><div class="privacy-note"><span>●</span> No cloud upload. The server listens on 127.0.0.1 only.</div>';
  $('exportFolderName').value='';updateExportNameControls();$('analysisTitle').textContent='Scan & review';$('analysisSubtitle').textContent='Choose a folder on the left to begin.';$('leftPaneTitle').textContent='File explorer';$('leftPaneSubtitle').textContent='Long-press a folder to scan';$('currentPath').textContent=ROOT;$('fileList').innerHTML='<div class="empty">Loading storage…</div>';setBadge('READY');loadDir(ROOT);health();setWorkflowStage(0);toast('New DFOL session started.');
}
$('restartBtn').addEventListener('click',startNewSession);

function renderSavedExport(state){
  if(!state?.lastExport)return;
  const result=state.lastExport,el=$('exportResult');el.classList.remove('hidden');
  let html=`<b>${result.rawExport?'RAW EXPORT COMPLETED':'Previous export completed'}</b><br>Location: <code>${esc(result.outputDir)}</code><br>`;
  if(result.report)html+=`Audit pattern matches: ${(result.report.auditIssues||[]).length}<br>`;
  if(result.zipPath)html+=`<br><a href="/api/download?path=${encodeURIComponent(result.zipPath)}" download="DFOL_export.zip">Download ZIP</a>`;
  if(result.rawExport)html+=`<br><div class="raw-result-warning"><b>Raw export:</b> sensitive data may be present. Review before sharing.</div>`;
  el.innerHTML=html;$('exportStatus').textContent='Restored previous export result.';
}
async function boot(){
  const state=readPersistedState();
  booting=true;
  if(typeof state.currentPath==='string'&&state.currentPath.startsWith(ROOT))currentPath=state.currentPath;
  if(typeof state.selectedFolder==='string'&&state.selectedFolder.startsWith(ROOT))selectedFolder=state.selectedFolder;
  if(state.activeJob)activeJob=state.activeJob;
  if(state.maskingMode==='raw'||state.maskingMode==='masked')maskingMode=state.maskingMode;
  excludedPaths=new Set(Array.isArray(state.exclusions)?state.exclusions:[]);
  rawGeneratedPaths=new Set(Array.isArray(state.rawGeneratedPaths)?state.rawGeneratedPaths:[]);
  $('includeGenerated').checked=Boolean(state.includeGenerated);
  $('hiddenToggle').checked=Boolean(state.hiddenToggle);
  $('outCombined').checked=state.outputs?.combined??true;$('outIndividual').checked=state.outputs?.individual??true;$('outCopy').checked=state.outputs?.folderCopy??false;$('outZip').checked=state.outputs?.zip??true;$('zipAll').checked=state.outputs?.zipAll??true;$('zipAllWrap').classList.toggle('hidden',!$('outZip').checked);
  $('unmaskRawFiles').checked=Boolean(state.unmaskRawFiles);
  // Always start with a fresh name; prior export names must never be restored from localStorage.
  $('exportFolderName').value='';
  $('useDeviceDateTime').checked=state.useDeviceDateTime!==false;
  updateExportNameControls();
  selectionEdited=Boolean(state.selectionEdited);
  expandedFindingFolders.clear();(state.expandedFindingFolders||[]).forEach(k=>expandedFindingFolders.add(k));
  activeExportTask=state.activeExportTask||null;
  await health();
  try{await loadDir(currentPath)}catch{}
  if(activeJob){
    try{
      const d=await api('/api/scan/'+activeJob);
      $('emptyState').classList.add('hidden');$('treeReview').classList.add('hidden');$('explorerContent').classList.add('hidden');$('scanProgress').classList.remove('hidden');
      $('progressBar').style.width=d.progress+'%';$('progressPercent').textContent=d.progress+'%';$('filesScanned').textContent=d.filesSeen;$('readableFiles').textContent=d.readable;$('findingTotal').textContent=d.findingCount;$('skippedFiles').textContent=d.skipped;
      if(d.status==='complete')showCompletedScan(d);
      else if(d.status==='scanning'){setBadge('SCANNING','scanning');$('analysisTitle').textContent='Scanning folder';$('analysisSubtitle').textContent=d.root;scanTimer=setInterval(pollScan,500);await pollScan()}
      else {setBadge('ERROR');toast(d.error||'Previous scan ended with an error.')}
    }catch(e){activeJob=null;saveAppState({activeJob:null,view:'explorer'});toast('Saved scan session could not be recovered. The DFOL server may have restarted; start a new scan.');}
  }else if(state.view==='tree'&&selectedFolder){
    try{await openTreeReview(selectedFolder,true)}catch(e){toast(e.message)}
  }
  renderSavedExport(state);
  if(activeExportTask){setExportPerformanceNotice(true);$('reviewArea').classList.remove('hidden');$('exportReviewSidebar').classList.remove('hidden');$('explorerContent').classList.add('hidden');$('exportBtn').disabled=true;$('exportStatus').textContent='Recovering export status…';exportTimer=setInterval(()=>pollExportTask(activeExportTask),700);await pollExportTask(activeExportTask)}
  if(state.lastExport&&((state.workflowStage===3)||(state.view==='result'))){try{await setWorkflowStage(3)}catch{}}
  else if(state.workflowStage===0){try{await setWorkflowStage(0)}catch{}}
  else if(state.workflowStage===1&&selectedFolder){try{await setWorkflowStage(1)}catch{}}
  else if(state.workflowStage===2&&activeJob){try{await setWorkflowStage(2)}catch{}}
  booting=false;saveAppState();updateWorkflowNavigation();
}
function setExportNameStatus(state,message){
  exportNameStatusState=state;
  const el=$('exportNameAvailability');
  if(el){el.className='export-name-status '+state;el.textContent=message;}
  syncExportConfirmation();
}
function scheduleExportNameCheck(delay=250){
  clearTimeout(exportNameCheckTimer);
  const seq=++exportNameCheckSeq;
  const automatic=$('useDeviceDateTime').checked;
  const typed=$('exportFolderName').value.trim();
  if(!automatic&&!typed){setExportNameStatus('empty','Enter a name to check availability.');return;}
  setExportNameStatus('checking',automatic?'Checking the automatic timestamp…':'Checking folder name…');
  exportNameCheckTimer=setTimeout(async()=>{
    try{
      const result=await api('/api/check-export-name',{method:'POST',body:JSON.stringify({useDeviceDateTime:automatic,exportFolderName:typed})});
      if(seq!==exportNameCheckSeq)return;
      if(result.exists){setExportNameStatus('exists',`Already exists — choose a new name. DFOL won't overwrite or auto-rename it.`);if(automatic)scheduleExportNameCheck(1100);}
      else setExportNameStatus('available',automatic?'Automatic date/time name is available — a new folder will be created.':`Available — "${result.normalizedName}" will create a new folder.`);
    }catch(e){if(seq!==exportNameCheckSeq)return;setExportNameStatus('invalid','Could not verify this name. Check storage access and try again.');}
  },delay);
}
function updateExportNameControls(){
  const auto=$('useDeviceDateTime').checked;
  $('exportFolderName').disabled=auto;
  $('exportFolderName').setAttribute('aria-disabled',String(auto));
  $('exportNamePreview').textContent=auto
    ? 'Default path: /storage/emulated/0/dump/YYYY-MM-DD_HH-MM-SS (phone local system time; not UTC). Existing names are blocked.'
    : 'Custom path: /storage/emulated/0/dump/' + ($('exportFolderName').value.trim() || '[enter-folder-name]') + ' (unsafe path characters will be replaced).';
  scheduleExportNameCheck(auto?0:250);
}
$('useDeviceDateTime').addEventListener('change',()=>{if($('useDeviceDateTime').checked)$('exportFolderName').value='';updateExportNameControls();saveAppState()});
$('exportFolderName').addEventListener('input',()=>{updateExportNameControls();saveAppState()});
boot();

$('resultCompleteBtn').addEventListener('click',startNewSession);


// About the Designer is a presentation layer only. Opening/closing it does not reset the current workflow.
function openAboutDesigner(){
  const modal=$('aboutDesignerModal');
  if(!modal)return;
  modal.classList.remove('hidden');
  document.body.classList.add('about-modal-open');
  $('closeAboutDesigner')?.focus();
}
function closeAboutDesigner(){
  const modal=$('aboutDesignerModal');
  if(!modal)return;
  modal.classList.add('hidden');
  document.body.classList.remove('about-modal-open');
  $('aboutDesignerBtn')?.focus();
}
$('aboutDesignerBtn')?.addEventListener('click',openAboutDesigner);
$('closeAboutDesigner')?.addEventListener('click',closeAboutDesigner);
$('aboutDesignerModal')?.addEventListener('click',ev=>{if(ev.target===$('aboutDesignerModal'))closeAboutDesigner()});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&!$('aboutDesignerModal')?.classList.contains('hidden'))closeAboutDesigner()});
