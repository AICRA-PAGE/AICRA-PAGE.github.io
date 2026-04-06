/**
 * AICRA Paper Editor - QA Diagnostic (Evidence Layer)
 * Redesigned: pure diagnostic (not recommendation engine),
 * template-aware rules, confidence levels, on-demand trigger.
 */
(function(global){

let _papersCache=null;
let _evidenceDismissed=new Set();
try{const d=sessionStorage.getItem('aicra.evidence.dismissed');if(d)_evidenceDismissed=new Set(JSON.parse(d));}catch(e){}

// Templates that are NOT experiment-based (skip dataset-related diagnostics)
const NON_EXPERIMENTAL_TPLS=['legal','compliance','governance','policy'];

/**
 * Load papers.json cache
 * @returns {Promise<Array>}
 */
async function _loadPapersCache(){
  if(_papersCache)return _papersCache;
  try{const r=await fetch('/assets/data/papers.json');if(r.ok)_papersCache=await r.json();}catch(e){}
  return _papersCache||[];
}

/**
 * Check if current template is experiment-based
 * @returns {boolean}
 */
function _isExperimentalTemplate(){
  const sel=document.getElementById('tplSel');
  if(!sel||!sel.value)return true; // default: assume experimental
  return !NON_EXPERIMENTAL_TPLS.includes(sel.value);
}

/**
 * Extract document context for diagnostic analysis
 * @returns {Object} document context
 */
function extractDocumentContext(){
  const title=(document.getElementById('ti').value||'').trim().toLowerCase();
  const domain=(document.getElementById('dm').value||'').trim().toLowerCase();
  const keywords=(document.getElementById('kw').value||'').trim().toLowerCase();
  const inp=document.getElementById('input');
  const body=inp?inp.value||'':'';
  const sections=[];
  body.replace(/^## (.+)$/gm,(m,h)=>{sections.push(h.trim().toLowerCase());});
  const hasExperiments=sections.some(s=>/experiment|evaluation|result|실험|평가/.test(s));
  const hasRelatedWork=sections.some(s=>/related|prior|선행|관련/.test(s));
  const hasDatasetSection=/dataset|data set|corpus|benchmark|실험\s?데이터|데이터셋|evaluation\s+data/i.test(body);
  const usedRefs=(window.refs||[]).map(r=>r.toLowerCase());
  const allKw=[title,domain,...keywords.split(',').map(s=>s.trim()),...sections].filter(Boolean);
  return{title,domain,keywords:allKw,sections,hasExperiments,hasRelatedWork,hasDatasetSection,usedRefs,body};
}

/**
 * Run QA diagnostics on the paper
 * Returns gap analysis with confidence levels (high/medium/low)
 * @param {Object} ctx - document context from extractDocumentContext()
 * @returns {Promise<{gaps:Array}>}
 */
async function findEvidence(ctx){
  const isExp=_isExperimentalTemplate();
  const gaps=[];

  // 1. Missing dataset section (only for experimental templates)
  if(isExp&&ctx.hasExperiments&&!ctx.hasDatasetSection){
    gaps.push({type:'gap',msg:'Experiments section has no explicit dataset reference',confidence:'high',icon:'[!]'});
  }

  // 2. Missing related work
  if(!ctx.hasRelatedWork&&ctx.body.length>1000){
    gaps.push({type:'gap',msg:'No Related Work / Prior Work section found',confidence:'high',icon:'[!]'});
  }

  // 3. Insufficient references
  const refCount=(window.refs||[]).length;
  if(refCount<3&&ctx.body.length>2000){
    gaps.push({type:'gap',msg:'Only '+refCount+' references (minimum 5 recommended)',confidence:'high',icon:'[!]'});
  }else if(refCount<5&&ctx.body.length>3000){
    gaps.push({type:'gap',msg:refCount+' references may be insufficient for this paper length',confidence:'medium',icon:'[?]'});
  }

  // 4. Citation-less claims detection
  const claimPat=/(?:을 보였다|을 달성했다|significantly|outperform|demonstrates?|achieve[ds]?|show[ns]? that|prove[dns]?|results? indicate|우수한 성능|높은 정확도)/i;
  const lines=ctx.body.split('\n');
  let unsupportedClaims=0;
  const claimExamples=[];
  lines.forEach((line,i)=>{
    if(claimPat.test(line)&&!line.includes('[cite:')&&line.trim().length>20){
      unsupportedClaims++;
      if(claimExamples.length<3)claimExamples.push({line:i+1,text:line.trim().substring(0,80)});
    }
  });
  if(unsupportedClaims>0){
    const conf=unsupportedClaims>3?'high':unsupportedClaims>1?'medium':'low';
    gaps.push({type:'gap',msg:unsupportedClaims+' claim(s) without citations',confidence:conf,icon:'[!]',details:claimExamples});
  }

  // 5. Missing abstract (for papers > 500 words)
  if(ctx.body.split(/\s+/).length>500&&!/:::abstract/.test(ctx.body)){
    gaps.push({type:'gap',msg:'No structured abstract found',confidence:'medium',icon:'[?]'});
  }

  // 6. Missing conclusion
  if(ctx.body.length>2000&&!ctx.sections.some(s=>/conclusion|결론|요약/.test(s))){
    gaps.push({type:'gap',msg:'No Conclusion section found',confidence:'medium',icon:'[?]'});
  }

  // 7. Section balance check (if experiment paper)
  if(isExp&&ctx.sections.length>3){
    const introIdx=ctx.sections.findIndex(s=>/introduction|서론/.test(s));
    const expIdx=ctx.sections.findIndex(s=>/experiment|evaluation|실험/.test(s));
    if(introIdx>=0&&expIdx>=0){
      const introLines=lines.slice(0,lines.findIndex(l=>/^## /.test(l)&&l!==lines[0])||lines.length);
      // If introduction is >40% of total, flag it
      if(introLines.length>lines.length*0.4){
        gaps.push({type:'gap',msg:'Introduction may be disproportionately long',confidence:'low',icon:'[i]'});
      }
    }
  }

  return{gaps};
}

/**
 * Render diagnostic results in the evidence hints panel
 * @param {Object} diagnostics - result from findEvidence()
 */
function renderEvidenceHints(diagnostics){
  const el=document.getElementById('evidenceHints');
  if(!el)return;
  el.innerHTML='';
  const gaps=diagnostics.gaps.filter(g=>!_evidenceDismissed.has(g.msg));
  if(gaps.length===0){el.style.display='none';_updateEvidenceBadge(0);return;}
  el.style.display='';

  // Header
  const header=document.createElement('div');
  header.style.cssText='padding:3px 6px;font-size:.54rem;font-weight:600;color:var(--brand);border-bottom:1px solid var(--line);display:flex;justify-content:space-between';
  header.innerHTML='<span>QA Diagnostic ('+gaps.length+')</span>';
  el.appendChild(header);

  // Confidence color map
  const confColor={high:'#b42318',medium:'#b7791f',low:'var(--muted)'};
  const confLabel={high:'HIGH',medium:'MED',low:'LOW'};

  gaps.forEach(g=>{
    const row=document.createElement('div');
    row.style.cssText='padding:4px 6px;font-size:.58rem;border-bottom:1px dotted var(--line);display:flex;gap:4px;align-items:flex-start';

    const badge=document.createElement('span');
    badge.style.cssText='font-size:.44rem;padding:0 3px;border-radius:2px;font-weight:600;flex-shrink:0;color:#fff;background:'+(confColor[g.confidence]||confColor.medium);
    badge.textContent=confLabel[g.confidence]||'MED';
    row.appendChild(badge);

    const msg=document.createElement('span');msg.style.cssText='flex:1;color:'+(g.confidence==='high'?'#b42318':'var(--text)');
    msg.textContent=g.msg;
    row.appendChild(msg);

    const dismissBtn=document.createElement('button');
    dismissBtn.style.cssText='border:none;background:none;cursor:pointer;font-size:.5rem;color:var(--muted);flex-shrink:0';
    dismissBtn.textContent='X';dismissBtn.title='Dismiss';
    dismissBtn.addEventListener('click',()=>{_dismissEvidence(g.msg);row.remove();_updateEvidenceBadge(el.querySelectorAll('div[style*="border-bottom"]').length-1);});
    row.appendChild(dismissBtn);

    // Show details (claim examples) if available
    if(g.details&&g.details.length){
      const detDiv=document.createElement('div');detDiv.style.cssText='font-size:.48rem;color:var(--muted);margin-top:2px;padding-left:28px';
      g.details.forEach(d=>{
        const dl=document.createElement('div');dl.textContent='L'+d.line+': '+d.text+'...';detDiv.appendChild(dl);
      });
      row.appendChild(detDiv);
    }

    el.appendChild(row);
  });

  _updateEvidenceBadge(gaps.length);
}

/**
 * Dismiss a diagnostic item
 * @param {string} key - the message string used as key
 */
function _dismissEvidence(key){
  _evidenceDismissed.add(key);
  try{sessionStorage.setItem('aicra.evidence.dismissed',JSON.stringify([..._evidenceDismissed]));}catch(e){}
}

/**
 * Update the evidence badge count on ref panel button
 * @param {number} count
 */
function _updateEvidenceBadge(count){
  let badge=document.getElementById('evidenceBadge');
  if(count<=0){if(badge)badge.remove();return;}
  if(!badge){
    const refBtn=document.querySelector('[onclick*="toggleRef"]');
    if(!refBtn)return;
    badge=document.createElement('span');badge.id='evidenceBadge';
    badge.style.cssText='position:absolute;top:-4px;right:-4px;background:#b42318;color:#fff;font-size:.42rem;padding:0 3px;border-radius:6px;font-weight:700;min-width:12px;text-align:center';
    refBtn.appendChild(badge);
  }
  badge.textContent=count;
}

/**
 * Trigger evidence diagnostic (on-demand)
 */
async function _triggerEvidence(){
  const ctx=extractDocumentContext();
  const diagnostics=await findEvidence(ctx);
  renderEvidenceHints(diagnostics);
}

// Export to window
Object.assign(global,{extractDocumentContext,findEvidence,renderEvidenceHints,_dismissEvidence,_updateEvidenceBadge,_triggerEvidence,_loadPapersCache});

})(window);
