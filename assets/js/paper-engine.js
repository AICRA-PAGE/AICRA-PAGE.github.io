/**
 * AICRA Paper Engine - Pure Logic Module
 * Extracted from paper-editor.html for maintainability and testability.
 * All functions are stateless and can be unit-tested independently.
 */
(function(global){

// === BibTeX Parser (brace-depth based) ===
function parseBibTeX(text){
  const entries=[];
  let i=0;
  while(i<text.length){
    const at=text.indexOf('@',i);if(at===-1)break;
    const ob=text.indexOf('{',at);if(ob===-1)break;
    let depth=1,j=ob+1;
    while(j<text.length&&depth>0){if(text[j]==='{')depth++;else if(text[j]==='}')depth--;j++;}
    const block=text.substring(at,j);
    const typeMatch=block.match(/@(\w+)\s*\{/);
    if(typeMatch){
      const type=typeMatch[1].toLowerCase();
      if(type!=='comment'&&type!=='string'&&type!=='preamble'){
        const fields={};
        const fieldRe=/(\w+)\s*=\s*(?:\{([^}]*(?:\{[^}]*\}[^}]*)*)\}|"([^"]*)"|(\d+))/g;
        let m;while((m=fieldRe.exec(block))!==null){fields[m[1].toLowerCase()]=m[2]||m[3]||m[4]||'';}
        const authors=(fields.author||'').replace(/\s+and\s+/g,', ').replace(/[{}]/g,'').trim();
        const title=(fields.title||'').replace(/[{}]/g,'').trim();
        const venue=(fields.journal||fields.booktitle||fields.publisher||'').replace(/[{}]/g,'').trim();
        const year=(fields.year||'').replace(/[{}]/g,'').trim();
        const doi=(fields.doi||'').replace(/[{}]/g,'').trim();
        if(title)entries.push({type,authors,title,venue,year,doi});
      }
    }
    i=j;
  }
  return entries;
}

// === Sentence Splitter (browser-compatible, no lookbehind) ===
function splitSentences(text){
  return (text.replace(/\n+/g,' ').match(/[^.!?]+[.!?]?/g)||[]).map(s=>s.trim()).filter(s=>s.length>5);
}

// === Korean Style Detection ===
function detectKoreanStyle(sentences){
  const formalPat=/(습니다|입니다|했습니다|되었습니다|하겠습니다|봅니다|됩니다)[.!?]?\s*$/;
  const informalPat=/(한다|이다|였다|했다|된다|보인다|나타난다|보았다|있다)[.!?]?\s*$/;
  const formal=[],informal=[];
  sentences.forEach((s,i)=>{
    if(formalPat.test(s))formal.push({idx:i,text:s.slice(-20)});
    else if(informalPat.test(s))informal.push({idx:i,text:s.slice(-20)});
  });
  const passive=sentences.filter(s=>/(되었다|되며|되었다고|되어서|수집되었다|처리되었다|되었으며|되어|되고|된다|된 것)/.test(s)).length;
  return {formal,informal,passive,total:sentences.length};
}

// === Vocabulary Diversity ===
function calcVocabDiversity(text){
  const words=(text.toLowerCase().match(/[a-z]{2,}|[가-힣]{2,}/g)||[]);
  const unique=new Set(words);
  return {total:words.length,unique:unique.size,ratio:words.length?Math.round(unique.size/words.length*100):0};
}

// === Abstract Quality Check ===
function checkAbstractQuality(absText){
  const hasObj=/(목적|objective|aim|goal|we propose|본 연구는|제안한다)/i.test(absText);
  const hasMethod=/(방법|method|approach|기법|using|based on|제안한|활용하여|설계하였)/i.test(absText);
  const hasResult=/(결과|result|accuracy|f1|auc|improv|향상|감소|증가|\d+(\.\d+)?%)/i.test(absText);
  const words=absText.trim().split(/\s+/).length;
  return {hasObj,hasMethod,hasResult,words,lengthOk:words>=100&&words<=300};
}

// === Term Consistency Check ===
function checkTermConsistency(text){
  const pairs=[
    ['인공지능','AI'],['딥러닝','deep learning'],['머신러닝','machine learning'],
    ['모델','model'],['알고리즘','algorithm'],['프레임워크','framework'],
    ['데이터셋','dataset'],['정확도','accuracy'],['취약점','vulnerability'],
    ['네트워크','network'],['서버','server'],['클라이언트','client']
  ];
  const issues=[];
  pairs.forEach(([kr,en])=>{
    const krC=(text.match(new RegExp(kr,'gi'))||[]).length;
    const enC=(text.match(new RegExp(en,'gi'))||[]).length;
    if(krC>0&&enC>0)issues.push({kr,en,krCount:krC,enCount:enC});
  });
  return issues;
}

// === Fuzzy Text Range Finder (for review suggestion apply) ===
function findBestRange(source,target){
  if(!source||!target)return null;
  const exact=source.indexOf(target);
  if(exact>-1)return{start:exact,end:exact+target.length,score:1};
  const trimmed=target.trim();
  const ti=trimmed?source.indexOf(trimmed):-1;
  if(ti>-1)return{start:ti,end:ti+trimmed.length,score:.99};
  const blocks=[];const re=/[^\n]+(?:\n(?!\n)[^\n]+)*/g;let m;
  while((m=re.exec(source))!==null)blocks.push({start:m.index,end:m.index+m[0].length,text:m[0]});
  const norm=s=>(s||'').toLowerCase().replace(/[`*_>#~\-\[\]()]/g,' ').replace(/\s+/g,' ').trim();
  const nt=norm(target);if(!nt)return null;
  let best=null;
  for(const b of blocks){
    const nb=norm(b.text);if(!nb)continue;
    let sc=0;
    if(nb===nt)sc=1;
    else if(nb.includes(nt)||nt.includes(nb))sc=Math.min(nb.length,nt.length)/Math.max(nb.length,nt.length);
    else{const tw=new Set(nt.split(' '));const bw=new Set(nb.split(' '));sc=[...tw].filter(w=>bw.has(w)).length/Math.max(tw.size,bw.size,1);}
    if(!best||sc>best.score)best={start:b.start,end:b.end,score:sc};
  }
  return best&&best.score>=.5?best:null;
}

// === Section Parser ===
function parseSections(text){
  const sections=[];let curSec=null;
  text.split('\n').forEach((line,i)=>{
    const m=line.match(/^(#{2,3})\s+(.+)/);
    if(m){if(curSec)curSec.end=i;curSec={level:m[1].length,title:m[2],start:i,end:0};sections.push(curSec);}
  });
  if(curSec)curSec.end=text.split('\n').length;
  return sections;
}

// === Simple Hash ===
function simpleHash(s){let h=0;for(let i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h|=0;}return h.toString(36);}

// Export to global
const engine={parseBibTeX,splitSentences,detectKoreanStyle,calcVocabDiversity,checkAbstractQuality,checkTermConsistency,findBestRange,parseSections,simpleHash};
global.paperEngine=engine;
// Also export individually for backward compat
Object.assign(global,engine);

})(window);
