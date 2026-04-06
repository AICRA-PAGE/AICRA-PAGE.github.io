/**
 * AICRA Paper Editor - Conference Deck Starter (PPT Export)
 * Redesigned: lazy-load PptxGenJS, outline preview before generation,
 * focused extraction (title/abstract/contributions/results/conclusion).
 * Graceful CDN failure handling.
 */
(function(global){

let _pptxReady=false;
let _pptxLoading=false;

/**
 * PptxGenJS CDN lazy loader
 * @returns {Promise<boolean>} true if loaded successfully
 */
function _loadPptxLib(){
  if(_pptxReady&&typeof PptxGenJS!=='undefined')return Promise.resolve(true);
  if(_pptxLoading)return new Promise(r=>{const iv=setInterval(()=>{if(_pptxReady){clearInterval(iv);r(true);}},200);setTimeout(()=>{clearInterval(iv);r(false);},15000);});
  _pptxLoading=true;
  return new Promise(resolve=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
    s.onload=()=>{_pptxReady=true;_pptxLoading=false;resolve(true);};
    s.onerror=()=>{_pptxLoading=false;resolve(false);};
    document.head.appendChild(s);
  });
}

/**
 * Build slide outline from paper content for preview
 * @param {string} text - editor content
 * @returns {Array<{title:string,type:string,include:boolean,body:string}>}
 */
function buildSlideOutline(text){
  const slides=[];
  const title=document.getElementById('ti').value||'Untitled Paper';
  const author=document.getElementById('au').value||'AICRA';
  const coau=document.getElementById('coau').value;
  const allAuthors=coau?author+', '+coau:author;
  const domain=document.getElementById('dm').value||'';

  // Slide 1: Title (always included)
  slides.push({title:'Title Slide',type:'title',include:true,body:title+'\n'+allAuthors+(domain?'\n'+domain:'')});

  // Slide 2: Abstract
  const absMatch=text.match(/:::abstract\n([\s\S]*?)\n:::/);
  if(absMatch)slides.push({title:'Abstract',type:'abstract',include:true,body:absMatch[1].trim().substring(0,500)});

  // Section slides - filter to meaningful sections
  const secs=parseSections(text);
  const skipPat=/reference|bibliography|acknowledge|appendix|부록|감사|참고문헌/i;
  for(const sec of secs){
    if(skipPat.test(sec.title))continue;
    const secBody=text.split('\n').slice(sec.start,sec.end).join('\n');
    const bullets=extractBullets(secBody);
    if(bullets.length<1)continue;
    slides.push({title:sec.title,type:'section',include:true,body:bullets.slice(0,8).join('\n')});
    // Check for tables
    const tbl=extractTable(secBody);
    if(tbl&&tbl.length>1)slides.push({title:sec.title+' (Table)',type:'table',include:true,body:tbl.map(r=>r.join(' | ')).join('\n')});
  }

  // Thank You slide
  slides.push({title:'Thank You',type:'closing',include:true,body:allAuthors+'\n'+domain});
  return slides;
}

/**
 * Show outline preview modal before PPT generation
 */
function showPptPreview(){
  const text=(document.getElementById('input')||{}).value||'';
  if(!text.trim()){alert('Write paper content first.');return;}
  const outline=buildSlideOutline(text);
  if(outline.length<2){alert('Not enough content for slides.');return;}

  // Build modal dynamically
  let modal=document.getElementById('pptPreviewModal');
  if(!modal){
    modal=document.createElement('div');modal.id='pptPreviewModal';modal.className='modal-overlay';
    modal.innerHTML='<div class="modal-box" style="max-width:560px"><div class="modal-head"><span>Conference Deck Starter</span><button class="bt" onclick="closeModal(\'pptPreviewModal\')" style="padding:1px 6px">X</button></div><div class="modal-body" style="max-height:400px;overflow-y:auto"><div id="pptOutlineList"></div></div><div class="modal-foot"><span id="pptSlideCount" style="font-size:.62rem;color:var(--muted)"></span><button class="bt" onclick="closeModal(\'pptPreviewModal\')">Cancel</button><button class="bt p" id="pptGenBtn">Generate PPTX</button></div></div>';
    document.body.appendChild(modal);
  }

  const list=document.getElementById('pptOutlineList');list.innerHTML='';
  outline.forEach((s,i)=>{
    const row=document.createElement('label');
    row.style.cssText='display:flex;gap:6px;align-items:flex-start;padding:6px 4px;border-bottom:1px dotted var(--line);font-size:.68rem;cursor:pointer';
    const cb=document.createElement('input');cb.type='checkbox';cb.checked=s.include;cb.dataset.idx=i;
    cb.style.cssText='width:auto;margin-top:2px;flex-shrink:0';
    cb.addEventListener('change',()=>{outline[i].include=cb.checked;_updateSlideCount(outline);});
    row.appendChild(cb);
    const info=document.createElement('div');info.style.flex='1';
    const t=document.createElement('b');t.style.cssText='color:var(--brand)';t.textContent=s.title;info.appendChild(t);
    const tag=document.createElement('span');tag.style.cssText='font-size:.5rem;color:var(--muted);margin-left:4px;background:var(--surface);padding:0 3px;border-radius:2px';tag.textContent=s.type;info.appendChild(tag);
    if(s.body){const preview=document.createElement('div');preview.style.cssText='font-size:.56rem;color:var(--muted);margin-top:2px;max-height:40px;overflow:hidden';preview.textContent=s.body.substring(0,120)+(s.body.length>120?'...':'');info.appendChild(preview);}
    row.appendChild(info);list.appendChild(row);
  });

  function _updateSlideCount(ol){
    const cnt=ol.filter(s=>s.include).length;
    document.getElementById('pptSlideCount').textContent=cnt+' slides selected';
  }
  _updateSlideCount(outline);

  document.getElementById('pptGenBtn').onclick=async()=>{
    const selected=outline.filter(s=>s.include);
    if(!selected.length){alert('Select at least one slide.');return;}
    closeModal('pptPreviewModal');
    await _generatePptx(selected);
  };

  modal.classList.add('show');
}

/**
 * Generate PPTX file from selected slides
 * @param {Array} slides - selected slide objects
 */
async function _generatePptx(slides){
  const statusEl=document.getElementById('as');
  statusEl.textContent='[*] PptxGenJS loading...';

  const ok=await _loadPptxLib();
  if(!ok){
    statusEl.textContent='[!] Failed to load PptxGenJS. Check network connection.';
    return;
  }

  const title=document.getElementById('ti').value||'Untitled Paper';
  const brandColor='2f5d50';
  const pptx=new PptxGenJS();
  pptx.defineLayout({name:'AICRA',width:13.333,height:7.5});
  pptx.layout='AICRA';

  for(const s of slides){
    const slide=pptx.addSlide();
    slide.background={color:'FFFFFF'};

    if(s.type==='title'){
      slide.addShape(pptx.shapes.RECTANGLE,{x:0,y:0,w:'100%',h:0.8,fill:{color:brandColor}});
      slide.addText('AICRA',{x:0.5,y:0.15,fontSize:14,color:'FFFFFF',fontFace:'Arial',bold:true});
      const parts=s.body.split('\n');
      slide.addText(parts[0]||'',{x:0.8,y:2.0,w:11.7,fontSize:28,color:'222222',fontFace:'Arial',bold:true,align:'center'});
      if(parts[1])slide.addText(parts[1],{x:0.8,y:3.8,w:11.7,fontSize:16,color:'666666',fontFace:'Arial',align:'center'});
      if(parts[2])slide.addText(parts[2],{x:0.8,y:4.5,w:11.7,fontSize:13,color:brandColor,fontFace:'Arial',align:'center'});
      slide.addShape(pptx.shapes.RECTANGLE,{x:0,y:6.7,w:'100%',h:0.8,fill:{color:brandColor}});

    }else if(s.type==='closing'){
      slide.background={fill:{color:brandColor}};
      slide.addText('Thank You',{x:0,y:2.5,w:'100%',fontSize:36,color:'FFFFFF',fontFace:'Arial',bold:true,align:'center'});
      slide.addText(s.body.replace('\n',' | '),{x:0,y:4.0,w:'100%',fontSize:16,color:'CCDDCC',fontFace:'Arial',align:'center'});

    }else if(s.type==='table'){
      slide.addShape(pptx.shapes.RECTANGLE,{x:0,y:0,w:'100%',h:0.6,fill:{color:brandColor}});
      slide.addText(s.title,{x:0.3,y:0.1,fontSize:16,color:'FFFFFF',fontFace:'Arial',bold:true});
      const tableLines=s.body.split('\n').map(l=>l.split(' | '));
      if(tableLines.length>1){
        const rows=tableLines.map((row,ri)=>row.map(cell=>({text:cell.trim(),options:{fontSize:10,color:ri===0?'FFFFFF':'333333',fill:{color:ri===0?brandColor:'F5F5F5'},bold:ri===0,align:'left'}})));
        slide.addTable(rows,{x:0.5,y:1.0,w:12.3,border:{pt:0.5,color:'CCCCCC'}});
      }

    }else{
      // section or abstract
      slide.addShape(pptx.shapes.RECTANGLE,{x:0,y:0,w:'100%',h:0.6,fill:{color:brandColor}});
      slide.addText(s.title,{x:0.3,y:0.1,fontSize:16,color:'FFFFFF',fontFace:'Arial',bold:true});
      const bullets=s.body.split('\n').filter(l=>l.trim());
      if(bullets.length){
        const textRows=bullets.map(b=>({text:b,options:{fontSize:13,color:'333333',bullet:{type:'bullet'},lineSpacingMultiple:1.3,breakLine:true}}));
        slide.addText(textRows,{x:0.8,y:1.0,w:11.7,h:5.5,fontFace:'Arial',valign:'top'});
      }
    }
  }

  const fn=title.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')||'presentation';
  pptx.writeFile({fileName:fn+'.pptx'});
  statusEl.textContent='[+] '+slides.length+' slides exported: '+fn+'.pptx';
}

/**
 * Export PPT wrapper (called from export dropdown)
 */
function exportPPT(){
  showPptPreview();
}

/**
 * Extract bullet points from section body
 * @param {string} body - section markdown text
 * @returns {string[]} array of bullet strings
 */
function extractBullets(body){
  const lines=body.split('\n');const bullets=[];
  for(const l of lines){
    const cl=l.replace(/^\s*[-*]\s+/,'').replace(/[#*_>`|]/g,'').replace(/\$[^$]*\$/g,'[math]').replace(/:::.*|```[\s\S]*?```/g,'').trim();
    if(cl.length>15&&cl.length<300&&!/^\|/.test(l)&&!/^---/.test(l)&&!/^:::/.test(l)){
      bullets.push(cl);
    }
  }
  return bullets;
}

/**
 * Extract table data from section body
 * @param {string} body - section markdown text
 * @returns {string[][]|null} 2D array of table cells
 */
function extractTable(body){
  const lines=body.split('\n');const tableLines=[];
  for(const l of lines){if(l.trim().startsWith('|')&&l.trim().endsWith('|'))tableLines.push(l);else if(tableLines.length)break;}
  if(tableLines.length<2)return null;
  return tableLines.filter(l=>!/^[\s|:-]+$/.test(l)).map(l=>l.split('|').filter(c=>c.trim()).map(c=>c.trim()));
}

// Export to window for backward compatibility
Object.assign(global,{showPptPreview,exportPPT,extractBullets,extractTable,genPPT:showPptPreview});

})(window);
