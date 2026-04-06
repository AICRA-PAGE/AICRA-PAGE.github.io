/**
 * AICRA Paper Editor - Related Paper Search (Recommendations)
 * Kept with improvements: relabeled as "search/suggest",
 * improved seed logic for recommendByRefs (top-3 refs).
 */
(function(global){

/**
 * Search related papers by title/keywords/abstract via Semantic Scholar
 */
async function recommendPapers(){
  const kw=(document.getElementById('kw')||{}).value||'';
  const ab=(document.getElementById('ab')||{}).value||'';
  const ti=(document.getElementById('ti')||{}).value||'';
  const query=[ti,kw,ab].filter(s=>s.trim()).join(' ').substring(0,200);
  if(!query.trim()){document.getElementById('as').textContent='[!] Enter keywords or abstract first';return;}

  const results=document.getElementById('recResults');
  if(!results)return;
  results.style.display='block';results.innerHTML='';
  const loading=document.createElement('p');loading.style.cssText='padding:6px;color:var(--muted)';loading.textContent='Searching related papers...';results.appendChild(loading);

  try{
    const r=await fetch('https://api.semanticscholar.org/graph/v1/paper/search?query='+encodeURIComponent(query)+'&limit=8&fields=title,authors,year,venue,citationCount,url');
    if(!r.ok)throw new Error('API error '+r.status);
    const d=await r.json();
    results.innerHTML='';
    if(!d.data||!d.data.length){results.innerHTML='<p style="padding:6px;color:var(--muted)">No related papers found</p>';return;}

    const label=document.createElement('div');label.style.cssText='padding:2px 6px;font-size:.5rem;color:var(--muted);font-weight:600';
    label.textContent='Related paper candidates ('+d.data.length+')';results.appendChild(label);

    d.data.forEach(p=>{
      const authors=(p.authors||[]).map(a=>a.name).join(', ');
      const ref=authors+'. "'+p.title+'." '+(p.venue||'')+', '+(p.year||'')+'.';
      const div=document.createElement('div');div.style.cssText='padding:4px 6px;border-bottom:1px dotted var(--line);cursor:pointer';
      div.dataset.ref=ref;
      div.addEventListener('click',function(){if(window.addScholarRef)window.addScholarRef(this);});
      const b=document.createElement('b');b.style.cssText='color:var(--brand);font-size:.56rem';b.textContent=p.title;div.appendChild(b);
      div.appendChild(document.createElement('br'));
      const sp=document.createElement('span');sp.style.cssText='color:var(--muted);font-size:.5rem';
      sp.textContent=authors.substring(0,80)+(authors.length>80?'...':'')+' ('+p.year+') '+(p.venue||'')+' | cited:'+p.citationCount;
      div.appendChild(sp);
      results.appendChild(div);
    });
  }catch(e){
    results.innerHTML='<p style="padding:6px;color:#b42318">Search failed. Please try again later.</p>';
  }
}

/**
 * Search related papers using existing references as seed
 * Improved: uses titles from top-3 refs instead of just the first one
 */
async function recommendByRefs(){
  const refs=window.refs||[];
  if(!refs.length){document.getElementById('as').textContent='[!] Add references first';return;}

  // Extract seed from top-3 references (improved from single ref)
  const seeds=refs.slice(0,3).map(r=>{
    // Try to extract title from ref string (between quotes)
    const titleMatch=r.match(/"([^"]+)"/);
    if(titleMatch)return titleMatch[1];
    // Fallback: use first 60 chars
    return r.substring(0,60);
  });
  const query=seeds.join(' ').substring(0,200);

  const results=document.getElementById('recResults');
  if(!results)return;
  results.style.display='block';results.innerHTML='';
  const loading=document.createElement('p');loading.style.cssText='padding:6px;color:var(--muted)';loading.textContent='Searching by reference context...';results.appendChild(loading);

  try{
    const r=await fetch('https://api.semanticscholar.org/graph/v1/paper/search?query='+encodeURIComponent(query)+'&limit=8&fields=title,authors,year,venue,citationCount,url');
    if(!r.ok)throw new Error('API error '+r.status);
    const d=await r.json();
    results.innerHTML='';
    if(!d.data||!d.data.length){results.innerHTML='<p style="padding:6px;color:var(--muted)">No related papers found</p>';return;}

    const label=document.createElement('div');label.style.cssText='padding:2px 6px;font-size:.5rem;color:var(--muted);font-weight:600';
    label.textContent='Reference-based candidates ('+d.data.length+')';results.appendChild(label);

    d.data.forEach(p=>{
      const authors=(p.authors||[]).map(a=>a.name).join(', ');
      const ref=authors+'. "'+p.title+'." '+(p.venue||'')+', '+(p.year||'')+'.';
      const div=document.createElement('div');div.style.cssText='padding:4px 6px;border-bottom:1px dotted var(--line);cursor:pointer';
      div.dataset.ref=ref;
      div.addEventListener('click',function(){if(window.addScholarRef)window.addScholarRef(this);});
      const b=document.createElement('b');b.style.cssText='color:var(--brand);font-size:.56rem';b.textContent=p.title;div.appendChild(b);
      div.appendChild(document.createElement('br'));
      const sp=document.createElement('span');sp.style.cssText='color:var(--muted);font-size:.5rem';
      sp.textContent=authors.substring(0,80)+(authors.length>80?'...':'')+' ('+p.year+') '+(p.venue||'')+' | cited:'+p.citationCount;
      div.appendChild(sp);
      results.appendChild(div);
    });
  }catch(e){
    results.innerHTML='<p style="padding:6px;color:#b42318">Search failed.</p>';
  }
}

// Export to window
Object.assign(global,{recommendPapers,recommendByRefs});

})(window);
