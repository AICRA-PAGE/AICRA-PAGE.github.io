/**
 * author.js -- 저자/협업자 관리 모듈
 *
 * 기존 paper-editor.html 함수 매핑 (17개):
 *   loadNameMap(3279)              -> loadNameMap()
 *   saveNameMap(3283)              -> saveNameMap()
 *   getDisplayName(3287)           -> getDisplayName()
 *   setNameMapping(3292)           -> setNameMapping()
 *   showNameMapModal(3297)         -> (UI -- Phase에서 처리)
 *   applyNameMap(3324)             -> applyNameMap()
 *   fetchCollaborators(3338)       -> fetchCollaborators()
 *   populateAuthorUI(3354)         -> populateAuthorDropdowns()
 *   updateAuthorDropdowns(3363)    -> updateAuthorDropdowns()
 *   addCoauthor(3383)              -> addCoauthor()
 *   removeCoauthor(3392)           -> removeCoauthor()
 *   addCorrespondingAuthor(3403)   -> addCorrespondingAuthor()
 *   removeCorrespondingAuthor(3412)-> removeCorrespondingAuthor()
 *   renderChips(3420)              -> renderChips()
 *   addExternalAuthor(3439)        -> addExternalAuthor()
 *   addReviewer(3453)              -> addReviewer()
 *   removeReviewer(3461)           -> removeReviewer()
 */

import { bus } from '../core/event-bus.js';
import { escHtml } from './ui.js';

/** localStorage 키: GitHub login -> 실명/소속 매핑 */
const NAME_MAP_KEY = 'aicra.paper.nameMap';


/* ═══════════════════════════════════════════
 * 이름 매핑 (GitHub login -> 실명/소속/이메일)
 * ═══════════════════════════════════════════ */

/**
 * loadNameMap -- localStorage에서 이름 매핑 로드
 * @returns {Object} { login: { name, affiliation, email } }
 */
export function loadNameMap() {
  try {
    const raw = localStorage.getItem(NAME_MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

/**
 * saveNameMap -- 이름 매핑을 localStorage에 저장
 * @param {Object} nameMap
 */
export function saveNameMap(nameMap) {
  try { localStorage.setItem(NAME_MAP_KEY, JSON.stringify(nameMap)); }
  catch { /* 저장 실패 무시 */ }
}

/**
 * getDisplayName -- login에서 표시 이름 반환
 * @param {string} login
 * @param {Object} nameMap
 * @returns {string}
 */
export function getDisplayName(login, nameMap) {
  const m = nameMap[login];
  return m && m.name ? m.name : login;
}

/**
 * setNameMapping -- 특정 login의 이름/소속/이메일 설정
 * @param {Object} nameMap
 * @param {string} login
 * @param {string} name
 * @param {string} affiliation
 * @param {string} email
 * @returns {Object} 갱신된 nameMap
 */
export function setNameMapping(nameMap, login, name, affiliation, email) {
  nameMap[login] = { name: name || login, affiliation: affiliation || '', email: email || '' };
  saveNameMap(nameMap);
  return nameMap;
}

/**
 * applyNameMap -- Paper Object의 nameMap 필드를 localStorage와 동기화
 * @param {import('../core/state.js').StateManager} state
 */
export function applyNameMap(state) {
  const localMap = loadNameMap();
  const stateMap = state.get('nameMap') || {};
  const merged = { ...localMap, ...stateMap };
  state.set('nameMap', merged);
  saveNameMap(merged);
}


/* ═══════════════════════════════════════════
 * GitHub Collaborator 조회
 * ═══════════════════════════════════════════ */

/**
 * fetchCollaborators -- GitHub repo의 collaborator 목록 조회
 * @returns {Promise<Array<{login, avatar_url}>>}
 */
export async function fetchCollaborators() {
  /* auth-guard.js와 동일한 토큰 소스 */
  const tokenKeys = ['sveltia-cms.user', 'netlify-cms-user'];
  let token = null;
  for (const key of tokenKeys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const d = JSON.parse(raw);
      token = d.token || d.access_token;
      if (token) break;
    } catch { /* 무시 */ }
  }
  if (!token) return [];

  try {
    const res = await fetch('https://api.github.com/repos/AICRA-PAGE/AICRA-PAGE.github.io/collaborators', {
      headers: { 'Authorization': 'token ' + token },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}


/* ═══════════════════════════════════════════
 * 공동저자 관리
 * ═══════════════════════════════════════════ */

/**
 * addCoauthor -- 공동저자 추가
 * @param {import('../core/state.js').StateManager} state
 * @param {string} login
 */
export function addCoauthor(state, login) {
  if (!login) return;
  const current = (state.get('meta.coauthors') || '').split(',').map(s => s.trim()).filter(Boolean);
  if (current.includes(login)) return;
  current.push(login);
  state.set('meta.coauthors', current.join(', '));
}

/**
 * removeCoauthor -- 공동저자 제거
 * @param {import('../core/state.js').StateManager} state
 * @param {string} login
 */
export function removeCoauthor(state, login) {
  const current = (state.get('meta.coauthors') || '').split(',').map(s => s.trim()).filter(Boolean);
  state.set('meta.coauthors', current.filter(a => a !== login).join(', '));
}


/* ═══════════════════════════════════════════
 * ���신저자 관리
 * ═══════════════════════════════════════════ */

/**
 * addCorrespondingAuthor -- 교신저자 설정
 * @param {import('../core/state.js').StateManager} state
 * @param {string} login
 */
export function addCorrespondingAuthor(state, login) {
  state.set('meta.corresponding', login);
}

/**
 * removeCorrespondingAuthor -- 교신저자 해제
 * @param {import('../core/state.js').StateManager} state
 */
export function removeCorrespondingAuthor(state) {
  state.set('meta.corresponding', '');
}


/* ═══════════════════════════════════════════
 * 외부 저자 (GitHub 계정 없는 저자)
 * ═══════════════════════════════════════════ */

/**
 * addExternalAuthor -- 외부 저자 추가 (이름 기반)
 * @param {import('../core/state.js').StateManager} state
 * @param {string} name
 * @param {string} [affiliation]
 * @param {string} [email]
 */
export function addExternalAuthor(state, name, affiliation, email) {
  if (!name) return;
  const login = 'ext-' + name.toLowerCase().replace(/\s+/g, '-');

  /* nameMap에 등록 */
  const nameMap = state.get('nameMap') || {};
  nameMap[login] = { name, affiliation: affiliation || '', email: email || '' };
  state.set('nameMap', nameMap);
  saveNameMap(nameMap);

  /* 공동저자에 추가 */
  addCoauthor(state, login);
}


/* ═══════════════════════════════════════════
 * 검토자 관리
 * ═══════════════════════════════════════════ */

/**
 * addReviewer -- 검토자 추가
 * @param {import('../core/state.js').StateManager} state
 * @param {string} login
 */
export function addReviewer(state, login) {
  if (!login) return;
  const current = (state.get('meta.reviewers') || '').split(',').map(s => s.trim()).filter(Boolean);
  if (current.includes(login)) return;
  current.push(login);
  state.set('meta.reviewers', current.join(', '));
}

/**
 * removeReviewer -- 검토자 제거
 * @param {import('../core/state.js').StateManager} state
 * @param {string} login
 */
export function removeReviewer(state, login) {
  const current = (state.get('meta.reviewers') || '').split(',').map(s => s.trim()).filter(Boolean);
  state.set('meta.reviewers', current.filter(r => r !== login).join(', '));
}


/* ═══════════════════════════════════════════
 * UI 렌더링 헬퍼
 * ═══════════════════════════════════════════ */

/**
 * renderChips -- 저자/검토자 chip UI 렌더링
 *
 * 기존: paper-editor.html line 3420
 *
 * @param {HTMLElement} container - chip을 렌더링할 DOM 요소
 * @param {Array<string>} list - login 목록
 * @param {Object} nameMap - 이름 매핑
 * @param {Function} onRemove - 제거 콜백 (login) => void
 * @param {Object} [opts] - { isExternal: boolean }
 */
export function renderChips(container, list, nameMap, onRemove, opts = {}) {
  if (!container) return;
  container.innerHTML = '';

  list.forEach(login => {
    const chip = document.createElement('span');
    chip.className = 'chip' + (opts.isExternal || login.startsWith('ext-') ? ' ext' : '');
    chip.style.cssText = 'display:inline-flex;align-items:center;gap:2px;padding:1px 6px;border-radius:10px;font-size:.58rem;background:var(--brand);color:#fff;margin:1px';

    const name = getDisplayName(login, nameMap);
    chip.textContent = name;

    /* 삭제 버튼 */
    const x = document.createElement('span');
    x.className = 'x';
    x.style.cssText = 'cursor:pointer;font-weight:700;margin-left:3px;opacity:.7';
    x.textContent = 'x';
    x.addEventListener('click', () => {
      if (onRemove) onRemove(login);
    });
    chip.appendChild(x);

    container.appendChild(chip);
  });
}

/**
 * populateAuthorDropdowns -- collaborator 목록으로 드롭다운 채우기
 *
 * @param {Array<{login, avatar_url}>} collaborators
 * @param {Object} nameMap
 * @param {string[]} selectIds - 채울 select 요소 ID 배열
 */
export function populateAuthorDropdowns(collaborators, nameMap, selectIds) {
  selectIds.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    /* 기존 옵션 유지 (첫 번째 placeholder) */
    const placeholder = sel.options[0];
    sel.innerHTML = '';
    if (placeholder) sel.appendChild(placeholder);

    collaborators.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.login;
      opt.textContent = getDisplayName(c.login, nameMap) + ' (' + c.login + ')';
      sel.appendChild(opt);
    });
  });
}
