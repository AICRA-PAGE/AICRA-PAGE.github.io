/**
 * AICRA Auth Guard - Collaborator Access Control
 * Checks if current user is a GitHub repo collaborator.
 * Usage: include this script, then call checkAccess(onSuccess, onDenied)
 */
(function(){
  const REPO_OWNER='AICRA-PAGE';
  const REPO_NAME='AICRA-PAGE.github.io';
  const CACHE_KEY='aicra.auth';
  const CACHE_TTL=600000; // 10 minutes

  // Note: Source protection (contextmenu/F12/selectstart blocks) removed for accessibility.
  // These blocks hurt keyboard users and screen readers more than they protect code.

  // Strict token sources only (matches doc-manager.js)
  function getToken(){
    const keys=['sveltia-cms.user','netlify-cms-user'];
    for(const k of keys){
      const raw=localStorage.getItem(k);
      if(!raw)continue;
      try{
        const d=JSON.parse(raw);
        const t=d.token||d.access_token;
        if(t&&typeof t==='string'&&t.length>10)return t;
      }catch(e){
        if(typeof raw==='string'&&raw.length>20&&raw.length<200&&/^[a-zA-Z0-9_-]+$/.test(raw))return raw;
      }
    }
    return null;
  }

  // Token-bound cache (prevents forged cache or stale user)
  function getCached(){
    try{
      const raw=localStorage.getItem(CACHE_KEY);
      if(!raw)return null;
      const d=JSON.parse(raw);
      if(Date.now()-d.at>CACHE_TTL)return null;
      // Verify cache is bound to current token
      const currentToken=getToken();
      if(!currentToken||d.tokenHash!==simpleHash(currentToken))return null;
      return d;
    }catch(e){}
    return null;
  }
  function simpleHash(s){let h=0;for(let i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h|=0;}return h.toString(36);}

  function setCache(login,isCollab){
    const token=getToken();
    localStorage.setItem(CACHE_KEY,JSON.stringify({login:login,collab:isCollab,at:Date.now(),tokenHash:token?simpleHash(token):''}));
  }

  window.aicraAuth={
    checkAccess:function(onSuccess,onDenied,onNoLogin){
      // Check cache first
      const cached=getCached();
      if(cached){
        if(cached.collab)return onSuccess(cached.login);
        else return onDenied(cached.login);
      }
      // Get token
      const token=getToken();
      if(!token){return (onNoLogin||onDenied)();}
      // Get user
      fetch('https://api.github.com/user',{headers:{'Authorization':'token '+token}})
        .then(r=>r.ok?r.json():Promise.reject('no user'))
        .then(user=>{
          const login=user.login;
          // Check collaborator
          return fetch('https://api.github.com/repos/'+REPO_OWNER+'/'+REPO_NAME+'/collaborators/'+login,{
            headers:{'Authorization':'token '+token}
          }).then(r=>{
            if(r.status===204){
              setCache(login,true);
              onSuccess(login);
            }else{
              setCache(login,false);
              onDenied(login);
            }
          });
        })
        .catch(()=>{
          // API error - try repo access as fallback
          fetch('https://api.github.com/repos/'+REPO_OWNER+'/'+REPO_NAME,{
            headers:{'Authorization':'token '+token}
          }).then(r=>{
            if(r.ok)return r.json().then(repo=>{
              if(repo.permissions&&repo.permissions.push){
                setCache(repo.owner.login||'user',true);
                onSuccess('user');
              }else{onDenied();}
            });
            else onDenied();
          }).catch(()=>onDenied());
        });
    },

    // For public pages: check if logged-in collaborator
    checkButton:function(btnSelector){
      const btn=document.querySelector(btnSelector);
      if(!btn)return;
      btn.style.display='none';
      const token=getToken();
      if(!token){
        // Show login hint instead
        const hint=document.createElement('p');
        hint.style.cssText='font-size:0.75rem;color:#8b8580;margin-top:10px;';
        hint.textContent='Collaborator 로그인 후 작성 버튼이 표시됩니다.';
        btn.parentNode.insertBefore(hint,btn.nextSibling);
        return;
      }
      // Has token - check collaborator
      const cached=getCached();
      if(cached&&cached.collab){btn.style.display='';return;}
      this.checkAccess(
        function(){btn.style.display='';},
        function(){
          const hint=document.createElement('p');
          hint.style.cssText='font-size:0.75rem;color:#8b8580;margin-top:10px;';
          hint.textContent='Collaborator 권한이 필요합니다.';
          btn.parentNode.insertBefore(hint,btn.nextSibling);
        }
      );
    }
  };
})();
