/**
 * AICRA Auth Guard - Collaborator Access Control
 * Checks if current user is a GitHub repo collaborator.
 * Supports: Sveltia CMS token, manual PAT input, URL hash token.
 */
(function(){
  const REPO_OWNER='AICRA-PAGE';
  const REPO_NAME='AICRA-PAGE.github.io';
  const CACHE_KEY='aicra.auth';
  const TOKEN_KEY='aicra.token';
  const CACHE_TTL=600000; // 10 minutes

  // Token sources: CMS token, manual PAT, or direct storage
  function getToken(){
    // 1. Direct stored token (from manual login)
    const direct=localStorage.getItem(TOKEN_KEY);
    if(direct&&direct.length>10)return direct;
    // 2. Sveltia CMS / Netlify CMS token
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
    // 3. URL hash token (e.g. #token=ghp_xxx)
    try{
      const hash=window.location.hash;
      if(hash&&hash.indexOf('token=')!==-1){
        const t=hash.split('token=')[1].split('&')[0];
        if(t&&t.length>10){
          localStorage.setItem(TOKEN_KEY,t);
          window.location.hash='';
          return t;
        }
      }
    }catch(e){}
    return null;
  }

  function simpleHash(s){let h=0;for(let i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h|=0;}return h.toString(36);}

  function getCached(){
    try{
      const raw=localStorage.getItem(CACHE_KEY);
      if(!raw)return null;
      const d=JSON.parse(raw);
      if(Date.now()-d.at>CACHE_TTL)return null;
      const currentToken=getToken();
      if(!currentToken||d.tokenHash!==simpleHash(currentToken))return null;
      return d;
    }catch(e){}
    return null;
  }

  function setCache(login,isCollab){
    const token=getToken();
    localStorage.setItem(CACHE_KEY,JSON.stringify({login:login,collab:isCollab,at:Date.now(),tokenHash:token?simpleHash(token):''}));
  }

  // Manual token login UI
  function showTokenLogin(container,onSuccess,onDenied){
    if(!container)return;
    container.style.display='block';
    // Check if login form already exists
    if(document.getElementById('aicra-token-form'))return;
    const form=document.createElement('div');
    form.id='aicra-token-form';
    form.style.cssText='margin-top:16px;text-align:center;';
    form.innerHTML=
      '<p style="font-size:.75rem;color:#6b665c;margin-bottom:8px;">GitHub Personal Access Token (repo scope)으로 로그인:</p>'+
      '<input id="aicra-token-input" type="password" placeholder="ghp_xxxxxxxxxxxx" style="padding:8px 12px;border:1px solid #ddd;border-radius:6px;width:260px;font-size:.8rem;margin-bottom:8px;"><br>'+
      '<button id="aicra-token-btn" style="padding:8px 20px;background:#2f5d50;color:#fff;border:none;border-radius:6px;font-size:.8rem;cursor:pointer;">로그인</button>'+
      '<p id="aicra-token-err" style="font-size:.7rem;color:#c53030;margin-top:8px;display:none;"></p>'+
      '<p style="font-size:.65rem;color:#999;margin-top:12px;">'+
        '<a href="https://github.com/settings/tokens/new?scopes=repo&description=AICRA+Editor" target="_blank" style="color:#2f5d50;">토큰 생성하기</a>'+
        ' (repo scope 필요)'+
      '</p>';
    container.appendChild(form);

    document.getElementById('aicra-token-btn').onclick=function(){
      const token=document.getElementById('aicra-token-input').value.trim();
      const errEl=document.getElementById('aicra-token-err');
      if(!token||token.length<10){
        errEl.textContent='유효한 토큰을 입력해주세요.';
        errEl.style.display='block';
        return;
      }
      errEl.style.display='none';
      document.getElementById('aicra-token-btn').textContent='확인 중...';
      // Save and verify
      localStorage.setItem(TOKEN_KEY,token);
      fetch('https://api.github.com/user',{headers:{'Authorization':'token '+token}})
        .then(function(r){return r.ok?r.json():Promise.reject('invalid token');})
        .then(function(user){
          var login=user.login;
          return fetch('https://api.github.com/repos/'+REPO_OWNER+'/'+REPO_NAME+'/collaborators/'+login,{
            headers:{'Authorization':'token '+token}
          }).then(function(r){
            if(r.status===204){
              setCache(login,true);
              onSuccess(login);
            }else{
              // Not collaborator but valid token - check push permission
              return fetch('https://api.github.com/repos/'+REPO_OWNER+'/'+REPO_NAME,{
                headers:{'Authorization':'token '+token}
              }).then(function(r2){return r2.json();}).then(function(repo){
                if(repo.permissions&&repo.permissions.push){
                  setCache(login,true);
                  onSuccess(login);
                }else{
                  setCache(login,false);
                  onDenied(login);
                }
              });
            }
          });
        })
        .catch(function(e){
          localStorage.removeItem(TOKEN_KEY);
          errEl.textContent='토큰이 유효하지 않거나 만료되었습니다.';
          errEl.style.display='block';
          document.getElementById('aicra-token-btn').textContent='로그인';
        });
    };
  }

  window.aicraAuth={
    getToken:getToken,

    checkAccess:function(onSuccess,onDenied,onNoLogin){
      // Check cache first
      const cached=getCached();
      if(cached){
        if(cached.collab)return onSuccess(cached.login);
        else return onDenied(cached.login);
      }
      // Get token
      const token=getToken();
      if(!token){
        // No token - show login UI
        if(onNoLogin)onNoLogin();
        // Auto-show token login form
        setTimeout(function(){
          var actions=document.getElementById('gate-actions');
          showTokenLogin(actions,onSuccess,onDenied||onNoLogin);
        },100);
        return;
      }
      // Verify token
      fetch('https://api.github.com/user',{headers:{'Authorization':'token '+token}})
        .then(function(r){return r.ok?r.json():Promise.reject('no user');})
        .then(function(user){
          var login=user.login;
          return fetch('https://api.github.com/repos/'+REPO_OWNER+'/'+REPO_NAME+'/collaborators/'+login,{
            headers:{'Authorization':'token '+token}
          }).then(function(r){
            if(r.status===204){
              setCache(login,true);
              onSuccess(login);
            }else{
              setCache(login,false);
              onDenied(login);
            }
          });
        })
        .catch(function(){
          fetch('https://api.github.com/repos/'+REPO_OWNER+'/'+REPO_NAME,{
            headers:{'Authorization':'token '+token}
          }).then(function(r){
            if(r.ok)return r.json().then(function(repo){
              if(repo.permissions&&repo.permissions.push){
                setCache(repo.owner.login||'user',true);
                onSuccess('user');
              }else{onDenied();}
            });
            else{
              // Token invalid - clear and show login
              localStorage.removeItem(TOKEN_KEY);
              if(onNoLogin)onNoLogin();
              setTimeout(function(){
                var actions=document.getElementById('gate-actions');
                showTokenLogin(actions,onSuccess,onDenied||onNoLogin);
              },100);
            }
          }).catch(function(){
            localStorage.removeItem(TOKEN_KEY);
            if(onNoLogin)onNoLogin();
            setTimeout(function(){
              var actions=document.getElementById('gate-actions');
              showTokenLogin(actions,onSuccess,onDenied||onNoLogin);
            },100);
          });
        });
    },

    checkButton:function(btnSelector){
      var btn=document.querySelector(btnSelector);
      if(!btn)return;
      btn.style.display='none';
      var token=getToken();
      if(!token){
        var hint=document.createElement('p');
        hint.style.cssText='font-size:0.75rem;color:#8b8580;margin-top:10px;';
        hint.textContent='Collaborator 로그인 후 작성 버튼이 표시됩니다.';
        btn.parentNode.insertBefore(hint,btn.nextSibling);
        return;
      }
      var cached=getCached();
      if(cached&&cached.collab){btn.style.display='';return;}
      this.checkAccess(
        function(){btn.style.display='';},
        function(){
          var hint=document.createElement('p');
          hint.style.cssText='font-size:0.75rem;color:#8b8580;margin-top:10px;';
          hint.textContent='Collaborator 권한이 필요합니다.';
          btn.parentNode.insertBefore(hint,btn.nextSibling);
        }
      );
    },

    // Logout: clear all tokens and cache
    logout:function(){
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem('sveltia-cms.user');
      localStorage.removeItem('netlify-cms-user');
      location.reload();
    }
  };
})();
