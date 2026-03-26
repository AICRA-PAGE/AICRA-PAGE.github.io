/**
 * AICRA Document Manager - GitHub-based Save/Load/Lock System
 * Stores papers as individual files in _drafts/{author}/{slug}.md
 * Uses GitHub Contents API (client-side, no server needed)
 */
(function(){
  const OWNER='AICRA-PAGE',REPO='AICRA-PAGE.github.io';
  const API='https://api.github.com/repos/'+OWNER+'/'+REPO+'/contents/';

  let _token=null,_user=null,_currentFile=null,_currentSha=null,_lastHash='',_autoSaveTimer=null;

  // Retry wrapper for API calls
  async function fetchRetry(url,opts,retries=2,delay=1000){
    for(let i=0;i<=retries;i++){
      try{
        const r=await fetch(url,opts);
        if(r.status===403&&r.headers.get('x-ratelimit-remaining')==='0'){
          const reset=parseInt(r.headers.get('x-ratelimit-reset')||'0')*1000-Date.now();
          if(reset>0&&reset<60000)await new Promise(ok=>setTimeout(ok,reset+1000));
          continue;
        }
        if(r.status>=500&&i<retries){await new Promise(ok=>setTimeout(ok,delay*(i+1)));continue;}
        return r;
      }catch(e){
        if(i<retries){await new Promise(ok=>setTimeout(ok,delay*(i+1)));continue;}
        throw e;
      }
    }
  }

  function getToken(){
    if(_token)return _token;
    // Strict token sources only (no arbitrary localStorage scanning)
    const keys=['sveltia-cms.user','netlify-cms-user'];
    for(const k of keys){
      const raw=localStorage.getItem(k);
      if(!raw)continue;
      try{
        const d=JSON.parse(raw);
        const t=d.token||d.access_token;
        if(t&&typeof t==='string'&&t.length>10){_token=t;return _token;}
      }catch(e){
        if(typeof raw==='string'&&raw.length>20&&raw.length<200&&/^[a-zA-Z0-9_-]+$/.test(raw)){_token=raw;return _token;}
      }
    }
    return null;
  }

  async function getUser(){
    if(_user)return _user;
    const token=getToken();if(!token)return null;
    const r=await fetchRetry('https://api.github.com/user',{headers:{'Authorization':'token '+token}});
    if(!r.ok)return null;
    _user=await r.json();return _user;
  }

  function headers(){return{'Authorization':'token '+getToken(),'Content-Type':'application/json'};}

  // Base64 encode/decode for Unicode
  function b64encode(str){return btoa(unescape(encodeURIComponent(str)));}
  function b64decode(str){return decodeURIComponent(escape(atob(str)));}

  function slugify(text){
    return text.toLowerCase().replace(/[^a-z0-9가-힣]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').substring(0,60)||'untitled';
  }

  function simpleHash(str){let h=0;for(let i=0;i<str.length;i++){h=((h<<5)-h)+str.charCodeAt(i);h|=0;}return h.toString(36);}

  // Parse front matter from markdown
  function parseFrontMatter(md){
    const m=md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if(!m)return{meta:{},body:md};
    const meta={};
    m[1].split('\n').forEach(line=>{
      const kv=line.match(/^(\w[\w-]*):\s*(.+)$/);
      if(kv){
        let v=kv[2].trim();
        if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1);
        if(v.startsWith('[')&&v.endsWith(']')){
          try{v=JSON.parse(v.replace(/'/g,'"'));}catch(e){v=v.slice(1,-1).split(',').map(s=>s.trim().replace(/"/g,''));}
        }
        if(v==='true')v=true;if(v==='false')v=false;
        meta[kv[1]]=v;
      }
    });
    return{meta:meta,body:m[2]};
  }

  // === SAVE ===
  async function saveToGitHub(title,body,meta,opts){
    const user=await getUser();if(!user)throw new Error('Not logged in');
    const slug=opts&&opts.fileName?opts.fileName:slugify(title);
    const folder=opts&&opts.publish?'_papers':'_drafts/'+user.login;
    const path=folder+'/'+slug+'.md';
    const content=buildContent(title,body,meta,user.login);
    const encoded=b64encode(content);

    // Check if file exists (get SHA)
    let sha=_currentFile===path?_currentSha:null;
    if(!sha){
      try{
        const r=await fetchRetry(API+path,{headers:headers()});
        if(r.ok){const d=await r.json();sha=d.sha;}
      }catch(e){}
    }

    const payload={message:(sha?'update':'create')+': '+title,content:encoded};
    if(sha)payload.sha=sha;

    const r=await fetchRetry(API+path,{method:'PUT',headers:headers(),body:JSON.stringify(payload)});
    if(!r.ok){
      if(r.status===409)throw new Error('CONFLICT');
      throw new Error('Save failed: '+r.status);
    }
    const d=await r.json();
    _currentFile=path;
    _currentSha=d.content.sha;
    _lastHash=simpleHash(content);
    return{path:path,sha:_currentSha};
  }

  function yamlEscape(s){if(!s)return'""';s=String(s);if(/[:"'\n\r\\{}[\],&*?|>!%@`#]/.test(s)||s.trim()!==s)return'"'+s.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n')+'"';return'"'+s+'"';}
  function buildContent(title,body,meta,login){
    let fm='---\nlayout: paper\ntitle: '+yamlEscape(title)+'\nauthor: '+(meta.author||login);
    if(meta.coauthors)fm+='\nauthors: ['+meta.coauthors.split(',').map(s=>yamlEscape(s.trim())).join(', ')+']';
    if(meta.corresponding)fm+='\ncorresponding_author: '+yamlEscape(meta.corresponding);
    fm+='\ndate: '+new Date().toISOString().split('T')[0];
    if(meta.status)fm+='\nstatus: '+meta.status;
    if(meta.domain)fm+='\ndomain: '+yamlEscape(meta.domain);
    if(meta.keywords)fm+='\nkeywords: ['+meta.keywords.split(',').map(s=>yamlEscape(s.trim())).join(', ')+']';
    if(meta.abstract)fm+='\nabstract: '+yamlEscape(meta.abstract);
    if(meta.collaborative)fm+='\ncollaborative: true';
    if(meta.reviewers)fm+='\nreviewers: ['+meta.reviewers.split(',').map(s=>yamlEscape(s.trim())).join(', ')+']';
    if(meta.locked)fm+='\nlocked: true\nlocked_by: '+yamlEscape(login);
    fm+='\nlang: ko\n---\n\n';
    return fm+body;
  }

  // === LOAD LIST ===
  async function listDrafts(){
    const user=await getUser();if(!user)return[];
    const results=[];
    // Get user's own drafts
    try{
      const r=await fetchRetry(API+'_drafts/'+user.login,{headers:headers()});
      if(r.ok){
        const files=await r.json();
        for(const f of files){
          if(f.name.endsWith('.md'))results.push({path:f.path,name:f.name,sha:f.sha,own:true});
        }
      }
    }catch(e){}
    // Get shared drafts (all _drafts subfolders)
    try{
      const r=await fetchRetry(API+'_drafts',{headers:headers()});
      if(r.ok){
        const dirs=await r.json();
        for(const d of dirs){
          if(d.type==='dir'&&d.name!==user.login){
            try{
              const r2=await fetchRetry(API+d.path,{headers:headers()});
              if(r2.ok){
                const files=await r2.json();
                for(const f of files){
                  if(f.name.endsWith('.md'))results.push({path:f.path,name:f.name,sha:f.sha,own:false,folder:d.name});
                }
              }
            }catch(e){}
          }
        }
      }
    }catch(e){}
    return results;
  }

  // === LOAD FILE ===
  async function loadFile(path){
    const r=await fetchRetry(API+path,{headers:headers()});
    if(!r.ok)throw new Error('Load failed: '+r.status);
    const d=await r.json();
    const content=b64decode(d.content);
    _currentFile=path;
    _currentSha=d.sha;
    _lastHash=simpleHash(content);
    const parsed=parseFrontMatter(content);
    // Check ACL
    const user=await getUser();
    const acl=checkACL(parsed.meta,user.login);
    return{meta:parsed.meta,body:parsed.body,path:path,sha:d.sha,acl:acl};
  }

  // === ACL ===
  function checkACL(meta,login){
    const lc=login.toLowerCase();
    const author=(meta.author||'').toLowerCase();
    const coauthors=Array.isArray(meta.authors)?meta.authors.map(a=>(typeof a==='string'?a:a.id||'').toLowerCase()):[];
    const corresponding=(meta.corresponding_author||'').toLowerCase();
    if(lc===author)return'owner';
    if(lc===corresponding)return'corresponding';
    if(coauthors.includes(lc))return'coauthor';
    if(meta.collaborative)return'collaborator';
    // Check reviewer role
    const reviewers=Array.isArray(meta.reviewers)?meta.reviewers.map(r=>(typeof r==='string'?r:r).toLowerCase()):[];
    if(reviewers.includes(lc))return'reviewer';
    return'readonly';
  }

  // === REVIEW SYSTEM ===
  async function createReview(paperPath,reviewerLogin){
    const user=await getUser();if(!user)throw new Error('Not logged in');
    // Load original paper
    const r=await fetchRetry(API+paperPath,{headers:headers()});
    if(!r.ok)throw new Error('Paper not found');
    const d=await r.json();
    const content=b64decode(d.content);
    // Create review copy
    const slug=paperPath.split('/').pop().replace('.md','');
    const reviewPath='_reviews/'+slug+'/'+reviewerLogin+'.md';
    const encoded=b64encode(content);
    // Check if already exists
    let sha=null;
    try{const r2=await fetchRetry(API+reviewPath,{headers:headers()});if(r2.ok){const d2=await r2.json();sha=d2.sha;}}catch(e){}
    const payload={message:'review: create copy for '+reviewerLogin,content:encoded};
    if(sha)payload.sha=sha;
    await fetchRetry(API+reviewPath,{method:'PUT',headers:headers(),body:JSON.stringify(payload)});
    // Create empty annotations file
    const annPath='_reviews/'+slug+'/'+reviewerLogin+'-annotations.json';
    let annSha=null;
    try{const r3=await fetchRetry(API+annPath,{headers:headers()});if(r3.ok){const d3=await r3.json();annSha=d3.sha;}}catch(e){}
    if(!annSha){
      const annPayload={message:'review: init annotations for '+reviewerLogin,content:b64encode('[]')};
      await fetchRetry(API+annPath,{method:'PUT',headers:headers(),body:JSON.stringify(annPayload)});
    }
    return reviewPath;
  }

  async function loadAnnotations(paperPath,reviewerLogin){
    const slug=paperPath.split('/').pop().replace('.md','');
    const annPath='_reviews/'+slug+'/'+reviewerLogin+'-annotations.json';
    try{
      const r=await fetchRetry(API+annPath,{headers:headers()});
      if(!r.ok)return[];
      const d=await r.json();
      return JSON.parse(b64decode(d.content));
    }catch(e){return[];}
  }

  async function saveAnnotation(paperPath,reviewerLogin,annotation){
    const slug=paperPath.split('/').pop().replace('.md','');
    const annPath='_reviews/'+slug+'/'+reviewerLogin+'-annotations.json';
    // Load current
    const r=await fetchRetry(API+annPath,{headers:headers()});
    let annotations=[],sha=null;
    if(r.ok){const d=await r.json();sha=d.sha;try{annotations=JSON.parse(b64decode(d.content));}catch(e){}}
    // Add new annotation
    annotation.id=Date.now().toString(36);
    annotation.reviewer=reviewerLogin;
    annotation.timestamp=new Date().toISOString();
    annotation.status='pending';
    annotations.push(annotation);
    // Save
    const payload={message:'review: annotation by '+reviewerLogin,content:b64encode(JSON.stringify(annotations,null,2))};
    if(sha)payload.sha=sha;
    await fetchRetry(API+annPath,{method:'PUT',headers:headers(),body:JSON.stringify(payload)});
    return annotation;
  }

  async function updateAnnotationStatus(paperPath,reviewerLogin,annotationId,status){
    const slug=paperPath.split('/').pop().replace('.md','');
    const annPath='_reviews/'+slug+'/'+reviewerLogin+'-annotations.json';
    const r=await fetchRetry(API+annPath,{headers:headers()});
    if(!r.ok)return;
    const d=await r.json();
    const sha=d.sha;
    const annotations=JSON.parse(b64decode(d.content));
    const ann=annotations.find(a=>a.id===annotationId);
    if(ann)ann.status=status;
    const payload={message:'review: '+status+' annotation',content:b64encode(JSON.stringify(annotations,null,2)),sha:sha};
    await fetchRetry(API+annPath,{method:'PUT',headers:headers(),body:JSON.stringify(payload)});
    return ann;
  }

  async function listReviewers(paperPath){
    const slug=paperPath.split('/').pop().replace('.md','');
    const reviewDir='_reviews/'+slug;
    try{
      const r=await fetchRetry(API+reviewDir,{headers:headers()});
      if(!r.ok)return[];
      const files=await r.json();
      return files.filter(f=>f.name.endsWith('.md')).map(f=>f.name.replace('.md',''));
    }catch(e){return[];}
  }

  // === LOCK ===
  async function toggleLock(path,lock){
    const data=await loadFile(path);
    const user=await getUser();
    if(data.acl!=='owner')throw new Error('Only the author can lock/unlock');
    // Modify front matter
    let content;
    if(lock){
      data.meta.locked=true;data.meta.locked_by=user.login;
    }else{
      delete data.meta.locked;delete data.meta.locked_by;
    }
    content=rebuildContent(data.meta,data.body);
    const encoded=b64encode(content);
    const r=await fetchRetry(API+path,{method:'PUT',headers:headers(),body:JSON.stringify({
      message:(lock?'lock':'unlock')+': '+data.meta.title,content:encoded,sha:data.sha
    })});
    if(!r.ok)throw new Error('Lock failed');
    const d=await r.json();
    _currentSha=d.content.sha;
    return lock;
  }

  function rebuildContent(meta,body){
    let fm='---\n';
    for(const[k,v]of Object.entries(meta)){
      if(v===undefined||v===null)continue;
      if(Array.isArray(v))fm+=k+': ['+v.map(s=>'"'+s+'"').join(', ')+']\n';
      else if(typeof v==='boolean')fm+=k+': '+v+'\n';
      else fm+=k+': "'+String(v).replace(/"/g,"'")+'"\n';
    }
    fm+='---\n\n';
    return fm+body;
  }

  // === DELETE ===
  async function deleteFile(path,sha){
    const r=await fetchRetry(API+path,{method:'DELETE',headers:headers(),body:JSON.stringify({
      message:'delete: '+path.split('/').pop(),sha:sha
    })});
    if(!r.ok)throw new Error('Delete failed');
    if(_currentFile===path){_currentFile=null;_currentSha=null;}
  }

  // === AUTO-SAVE ===
  function startAutoSave(getContentFn,getMetaFn,statusFn,interval){
    if(_autoSaveTimer)clearInterval(_autoSaveTimer);
    _autoSaveTimer=setInterval(async()=>{
      const token=getToken();if(!token)return;
      const content=getContentFn();if(!content||!content.trim())return;
      const title=getMetaFn().title;if(!title)return;
      const hash=simpleHash(buildContent(title,content,getMetaFn(),(await getUser()).login));
      if(hash===_lastHash)return; // No changes
      try{
        statusFn('자동 저장 중...');
        await saveToGitHub(title,content,getMetaFn());
        statusFn('자동 저장됨 ('+new Date().toLocaleTimeString()+')');
      }catch(e){
        if(e.message==='CONFLICT')statusFn('충돌 감지! 수동 저장 필요');
        else statusFn('자동 저장 실패');
      }
    },interval||30000);
  }

  function stopAutoSave(){if(_autoSaveTimer){clearInterval(_autoSaveTimer);_autoSaveTimer=null;}}

  // === CONFLICT CHECK ===
  async function checkConflict(path){
    if(!path||!_currentSha)return false;
    try{
      const r=await fetchRetry(API+path,{headers:headers()});
      if(!r.ok)return false;
      const d=await r.json();
      return d.sha!==_currentSha;
    }catch(e){return false;}
  }

  // Expose public API
  window.docManager={
    getUser:getUser,
    getToken:getToken,
    save:saveToGitHub,
    listDrafts:listDrafts,
    loadFile:loadFile,
    deleteFile:deleteFile,
    toggleLock:toggleLock,
    startAutoSave:startAutoSave,
    stopAutoSave:stopAutoSave,
    checkConflict:checkConflict,
    getCurrentFile:function(){return _currentFile;},
    getCurrentSha:function(){return _currentSha;},
    setCurrentSha:function(sha){_currentSha=sha;},
    slugify:slugify,
    createReview:createReview,
    loadAnnotations:loadAnnotations,
    saveAnnotation:saveAnnotation,
    updateAnnotationStatus:updateAnnotationStatus,
    listReviewers:listReviewers
  };
})();
