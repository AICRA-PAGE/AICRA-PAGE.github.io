/**
 * AICRA Paper Editor - Conditional Research Assistant (Dataset Workspace)
 * Redesigned: template-aware activation (experimental papers only),
 * search + insert main flow, evaluation as collapsible advanced section.
 */
(function(global){

let _dsCache=null;
let _dsAbort=null;
let _selectedDs=null;

// Templates where dataset workspace is relevant
const EXPERIMENTAL_TPLS=['neurips','icml','iclr','aaai','ccs','ndss','sp','usenix_en','tdsc','tifs','ieee_en','acm_en','journal_en','short_en','kiisc','kci_kr','journal_kr','phd_kr','phd_en'];
const NON_EXPERIMENTAL_TPLS=['legal','compliance','governance','policy'];

/**
 * Check if dataset workspace should be available for current template
 * @returns {boolean}
 */
function isDatasetRelevant(){
  const sel=document.getElementById('tplSel');
  if(!sel||!sel.value)return true; // default: show
  return !NON_EXPERIMENTAL_TPLS.includes(sel.value);
}

/**
 * Load dataset catalog from local JSON
 * @returns {Promise<Array>}
 */
async function _loadDatasetCatalog(){
  if(_dsCache)return _dsCache;
  try{const r=await fetch('/assets/data/datasets.json');if(r.ok)_dsCache=await r.json();}catch(e){}
  return _dsCache||[];
}

/**
 * Search datasets in sidebar panel (quick search)
 */
async function searchDataset(){
  const q=(document.getElementById('dsQuery')||{}).value;
  if(!q||!q.trim())return;
  const query=q.trim().toLowerCase();
  const results=document.getElementById('dsResults');
  if(!results)return;
  results.innerHTML='';
  const loading=document.createElement('p');loading.style.cssText='padding:6px;color:var(--muted)';loading.textContent='Searching...';results.appendChild(loading);

  if(_dsAbort){try{_dsAbort.abort();}catch(e){}}
  _dsAbort=new AbortController();

  const catalog=await _loadDatasetCatalog();
  const local=catalog.filter(d=>{
    const hay=(d.name+' '+d.description+' '+(d.tags||[]).join(' ')+' '+(d.domain||[]).join(' ')).toLowerCase();
    return query.split(/\s+/).every(w=>hay.includes(w));
  });
  results.innerHTML='';
  local.forEach(d=>results.appendChild(_buildDsCard(d)));

  // External: HuggingFace only (reduced scope)
  try{
    const r=await fetch('https://huggingface.co/api/datasets?search='+encodeURIComponent(query)+'&sort=downloads&limit=8',{signal:_dsAbort.signal});
    if(r.ok){
      const data=await r.json();
      data.forEach(p=>{
        const existing=local.find(l=>l.name.toLowerCase()===p.id.split('/').pop().toLowerCase());
        if(!existing){
          results.appendChild(_buildDsCard({
            id:p.id,name:p.id.split('/').pop(),description:'HuggingFace: '+p.id,
            url:'https://huggingface.co/datasets/'+p.id,source:'HuggingFace',tags:(p.tags||[]).slice(0,5)
          }));
        }
      });
    }
  }catch(e){}

  if(!results.children.length){
    const empty=document.createElement('p');empty.style.cssText='padding:6px;color:var(--muted)';empty.textContent='No results';results.appendChild(empty);
  }
}

/**
 * Search dataset by domain shortcut
 * @param {string} dom - domain keyword
 */
function searchDatasetByDomain(dom){
  const el=document.getElementById('dsQuery');
  if(el){el.value=dom;searchDataset();}
}

/**
 * Build a dataset card element for sidebar results
 * @param {Object} d - dataset object
 * @returns {HTMLElement}
 */
function _buildDsCard(d){
  const div=document.createElement('div');
  div.style.cssText='padding:4px 6px;border-bottom:1px dotted var(--line);cursor:pointer';
  div.addEventListener('click',()=>insertDatasetRef(d));
  const title=document.createElement('b');
  title.style.cssText='color:var(--brand);font-size:.56rem';title.textContent=d.name;div.appendChild(title);
  if(d.source){
    const src=document.createElement('span');src.style.cssText='font-size:.44rem;color:var(--accent);margin-left:4px;background:var(--surface);padding:0 3px;border-radius:2px';
    src.textContent=d.source;div.appendChild(src);
  }
  if(d.domain&&d.domain.length){
    const dom=document.createElement('span');dom.style.cssText='font-size:.46rem;color:var(--muted);margin-left:4px';
    dom.textContent='['+d.domain.join(', ')+']';div.appendChild(dom);
  }
  div.appendChild(document.createElement('br'));
  const desc=document.createElement('span');
  desc.style.cssText='color:var(--text);font-size:.52rem';desc.textContent=(d.description||'').substring(0,120);div.appendChild(desc);
  if(d.size||d.license||d.year){
    div.appendChild(document.createElement('br'));
    const meta=document.createElement('span');meta.style.cssText='font-size:.46rem;color:var(--muted)';
    const parts=[];if(d.size)parts.push(d.size);if(d.license)parts.push(d.license);if(d.year)parts.push(String(d.year));if(d.format)parts.push(d.format);
    meta.textContent=parts.join(' | ');div.appendChild(meta);
  }
  return div;
}

/**
 * Insert dataset as reference and editor block
 * @param {Object} d - dataset object
 */
function insertDatasetRef(d){
  const refs=window.refs||[];
  const ref=(d.source||'')+(d.source?'. ':'')+'"'+d.name+'." '+(d.url||'')+', '+(d.year||'')+'.';
  const norm=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
  if(refs.some(r=>norm(r).includes(norm(d.name)))){
    document.getElementById('as').textContent='[*] "'+d.name+'" already in references';return;
  }
  refs.push(ref);
  if(window.renderRefs)window.renderRefs();
  const inp=document.getElementById('input');
  const block='\n\n**Dataset: '+d.name+'**\n'+(d.description?'> '+d.description.substring(0,200)+'\n':'')+(d.url?'> URL: '+d.url+'\n':'')+(d.size?'> Size: '+d.size:'')+(d.format?' | Format: '+d.format:'')+'\n\n';
  if(inp){inp.focus();if(window.typeText)window.typeText(block);}
  if(window.render)window.render();
  if(window._pendingCite&&window._completeCiteInsert)window._completeCiteInsert();
  else document.getElementById('as').textContent='[+] Dataset "'+d.name+'" added ['+refs.length+']';
}

/**
 * Open dataset workspace modal (if template is relevant)
 */
function openDatasetWorkspace(){
  if(!isDatasetRelevant()){
    document.getElementById('as').textContent='[i] Dataset workspace is not relevant for this paper type';
    return;
  }
  const modal=document.getElementById('dsModal');
  if(modal)modal.classList.add('show');
  switchDsTab(0);
}

/**
 * Switch dataset workspace tabs
 * @param {number} idx - tab index (0=search, 1=evaluate, 2=templates)
 */
function switchDsTab(idx){
  [0,1,2].forEach(i=>{
    const tab=document.getElementById('dsTab'+i);
    const pane=document.getElementById('dsMTab'+i);
    if(tab)tab.style.cssText='flex:1;border-radius:0;border:none;padding:6px;font-size:.65rem;'+(i===idx?'font-weight:600;border-bottom:2px solid var(--brand);color:var(--brand)':'color:var(--muted)');
    if(pane)pane.style.display=i===idx?'':'none';
  });
}

/**
 * Search datasets in workspace modal
 */
async function searchDatasetModal(){
  const q=(document.getElementById('dsModalQuery')||{}).value;
  if(!q||!q.trim())return;
  const query=q.trim().toLowerCase();
  const results=document.getElementById('dsModalResults');
  if(!results)return;
  results.innerHTML='';
  const loading=document.createElement('p');loading.style.cssText='padding:10px;color:var(--muted)';loading.textContent='Searching...';results.appendChild(loading);

  const catalog=await _loadDatasetCatalog();
  const local=catalog.filter(d=>{
    const hay=(d.name+' '+d.description+' '+(d.tags||[]).join(' ')+' '+(d.domain||[]).join(' ')).toLowerCase();
    return query.split(/\s+/).every(w=>hay.includes(w));
  });
  const all=[...local];

  // External APIs: HuggingFace only (reduced from 2 APIs to 1)
  try{
    const r=await fetch('https://huggingface.co/api/datasets?search='+encodeURIComponent(query)+'&sort=downloads&limit=10');
    if(r.ok){
      const data=await r.json();
      data.forEach(p=>all.push({id:p.id,name:p.id.split('/').pop(),description:'HuggingFace: '+p.id,url:'https://huggingface.co/datasets/'+p.id,source:'HuggingFace',tags:(p.tags||[]).slice(0,5)}));
    }
  }catch(e){}

  // Deduplicate
  const seen=new Map();const deduped=[];
  all.forEach(d=>{const key=(d.name||d.id||'').toLowerCase().replace(/[^a-z0-9]/g,'');if(!seen.has(key)){seen.set(key,true);deduped.push(d);}});

  results.innerHTML='';
  if(!deduped.length){results.innerHTML='<p style="padding:10px;color:var(--muted)">No results</p>';return;}

  deduped.forEach(d=>{
    const card=document.createElement('div');
    card.style.cssText='padding:6px 8px;border:1px solid var(--line);border-radius:4px;margin-bottom:4px;cursor:pointer;transition:.15s';
    card.addEventListener('mouseenter',()=>{card.style.background='var(--surface)';});
    card.addEventListener('mouseleave',()=>{card.style.background='';});
    card.addEventListener('click',()=>{_selectedDs=d;_showDsEval(d);switchDsTab(1);});
    const title=document.createElement('b');title.style.cssText='color:var(--brand);font-size:.72rem';title.textContent=d.name;card.appendChild(title);
    if(d.source){const src=document.createElement('span');src.style.cssText='font-size:.48rem;color:var(--accent);margin-left:4px;background:var(--surface);padding:0 3px;border-radius:2px';src.textContent=d.source;card.appendChild(src);}
    card.appendChild(document.createElement('br'));
    const desc=document.createElement('span');desc.style.cssText='color:var(--text);font-size:.62rem';desc.textContent=(d.description||'').substring(0,150);card.appendChild(desc);
    if(d.size||d.license||d.year){
      card.appendChild(document.createElement('br'));
      const meta=document.createElement('span');meta.style.cssText='font-size:.5rem;color:var(--muted)';
      const parts=[];if(d.size)parts.push(d.size);if(d.license)parts.push(d.license);if(d.year)parts.push(String(d.year));
      meta.textContent=parts.join(' | ');card.appendChild(meta);
    }
    results.appendChild(card);
  });
}

/**
 * Show dataset evaluation (collapsible advanced section)
 * @param {Object} d - dataset object
 */
function _showDsEval(d){
  const el=document.getElementById('dsEvalContent');
  if(!el)return;
  el.innerHTML='';
  const h=document.createElement('h3');h.style.cssText='font-size:.82rem;color:var(--brand);margin-bottom:8px';h.textContent=d.name;el.appendChild(h);

  // Basic metadata
  const fields=[['Source',d.source],['URL',d.url],['Domain',(d.domain||[]).join(', ')],['Size',d.size],['License',d.license],['Year',d.year],['Format',d.format]];
  fields.forEach(([label,val])=>{
    if(!val)return;
    const row=document.createElement('div');row.style.cssText='display:flex;gap:6px;padding:2px 0;border-bottom:1px dotted var(--line);font-size:.65rem';
    const l=document.createElement('b');l.style.cssText='min-width:60px;color:var(--muted)';l.textContent=label;row.appendChild(l);
    const v=document.createElement('span');v.textContent=String(val);row.appendChild(v);
    el.appendChild(row);
  });

  // Collapsible evaluation checklist (advanced)
  const details=document.createElement('details');details.style.cssText='margin-top:8px;border:1px solid var(--line);border-radius:4px;padding:4px 6px';
  const summary=document.createElement('summary');summary.style.cssText='font-size:.62rem;font-weight:600;color:var(--brand);cursor:pointer';summary.textContent='Evaluation Checklist (Advanced)';details.appendChild(summary);
  const checks=[
    {label:'Fits research question',desc:'Does this dataset validate your hypothesis?'},
    {label:'Benchmark or training data',desc:'Is the role clear (benchmark vs. training)?'},
    {label:'Access verified',desc:'Is the dataset freely accessible?'},
    {label:'License compatible',desc:'Does the license allow your intended use?'},
    {label:'Official splits exist',desc:'Are train/val/test splits provided?'}
  ];
  checks.forEach(c=>{
    const row=document.createElement('label');row.style.cssText='display:flex;gap:4px;align-items:flex-start;font-size:.58rem;padding:3px 0;border-bottom:1px dotted var(--line)';
    const cb=document.createElement('input');cb.type='checkbox';cb.style.cssText='width:auto;margin-top:2px;flex-shrink:0';row.appendChild(cb);
    const txt=document.createElement('div');
    const lbl=document.createElement('span');lbl.style.fontWeight='600';lbl.textContent=c.label;txt.appendChild(lbl);
    const desc=document.createElement('div');desc.style.cssText='font-size:.48rem;color:var(--muted)';desc.textContent=c.desc;txt.appendChild(desc);
    row.appendChild(txt);details.appendChild(row);
  });
  el.appendChild(details);

  // Insert buttons
  const btns=document.createElement('div');btns.style.cssText='margin-top:10px;display:flex;gap:4px;flex-wrap:wrap';
  const addBtn=document.createElement('button');addBtn.className='bt p';addBtn.style.cssText='font-size:.62rem;padding:4px 10px';addBtn.textContent='Add to refs + insert';
  addBtn.addEventListener('click',()=>{insertDatasetRef(d);if(window.closeModal)window.closeModal('dsModal');});btns.appendChild(addBtn);
  const tplBtn=document.createElement('button');tplBtn.className='bt';tplBtn.style.cssText='font-size:.62rem;padding:4px 10px';tplBtn.textContent='Templates';
  tplBtn.addEventListener('click',()=>switchDsTab(2));btns.appendChild(tplBtn);
  el.appendChild(btns);
}

/**
 * Insert dataset template snippet
 * @param {string} type - template key
 */
function insertDsTemplate(type){
  const d=_selectedDs;
  if(!d){document.getElementById('as').textContent='[!] Select a dataset first';return;}
  const tpls={
    factsheet:'\n\n### Dataset Fact Sheet: '+d.name+'\n- **Source:** '+(d.source||'[enter]')+'\n- **URL:** '+(d.url||'[enter]')+'\n- **Domain/Task:** '+((d.domain||[]).join(', ')||'[enter]')+'\n- **Size:** '+(d.size||'[enter]')+'\n- **License:** '+(d.license||'[enter]')+'\n\n',
    dstbl:'\n\n*Table N. Dataset comparison.*\n| Dataset | Task | Size | Modality | Labels | License | Popularity |\n|---------|------|------|----------|--------|---------|------------|\n| '+d.name+' | | '+(d.size||'')+' | | | '+(d.license||'')+' | |\n| [dataset2] | | | | | | |\n\n',
    expsetup:'\n\n### Experimental Setup\n**Primary dataset:** '+d.name+'\n**Task:** [task]\n**Split:** [Train/Val/Test]\n**Preprocessing:** [preprocessing]\n**Metrics:** [metrics]\n**Hardware:** [GPU/CPU]\n\n'
  };
  const inp=document.getElementById('input');
  if(tpls[type]&&inp){inp.focus();if(window.typeText)window.typeText(tpls[type]);if(window.render)window.render();}
  if(window.closeModal)window.closeModal('dsModal');
}

/**
 * Save dataset link to repository
 */
async function saveDsToRepo(){
  if(!_selectedDs){document.getElementById('as').textContent='[!] Select a dataset first';return;}
  const d=_selectedDs;
  document.getElementById('as').textContent='[*] Saving dataset info to repository...';
  try{
    const token=window.docManager?window.docManager.getToken():null;
    if(!token){document.getElementById('as').textContent='[!] Login required';return;}
    const path='assets/data/dataset-links.json';
    const headers={'Authorization':'token '+token,'Content-Type':'application/json'};
    let existing=[];let sha=null;
    try{
      const r=await fetch('https://api.github.com/repos/AICRA-PAGE/AICRA-PAGE.github.io/contents/'+path,{headers});
      if(r.ok){const data=await r.json();sha=data.sha;existing=JSON.parse(atob(data.content));}
    }catch(e){}
    const link={dataset_id:d.id||d.name.toLowerCase().replace(/\s+/g,'-'),dataset_name:d.name,paper_title:document.getElementById('ti').value||'',added_at:new Date().toISOString()};
    existing.push(link);
    const content=btoa(unescape(encodeURIComponent(JSON.stringify(existing,null,2))));
    const payload={message:'dataset: add '+d.name+' link',content};if(sha)payload.sha=sha;
    const r=await fetch('https://api.github.com/repos/AICRA-PAGE/AICRA-PAGE.github.io/contents/'+path,{method:'PUT',headers,body:JSON.stringify(payload)});
    if(r.ok)document.getElementById('as').textContent='[+] Dataset "'+d.name+'" saved to repository';
    else document.getElementById('as').textContent='[!] Save failed: '+r.status;
  }catch(e){document.getElementById('as').textContent='[!] Save error: '+e.message;}
}

// Keyboard shortcut: Ctrl+Shift+D
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.shiftKey&&(e.key==='d'||e.key==='D')&&!e.altKey){e.preventDefault();openDatasetWorkspace();}});

// Export to window
Object.assign(global,{
  isDatasetRelevant,_loadDatasetCatalog,searchDataset,searchDatasetByDomain,_buildDsCard,
  insertDatasetRef,openDatasetWorkspace,switchDsTab,searchDatasetModal,_showDsEval,
  insertDsTemplate,saveDsToRepo,_selectedDs
});

})(window);
