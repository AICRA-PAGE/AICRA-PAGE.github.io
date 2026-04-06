/**
 * storage.js -- 저장/불러오기 추상화 레이어
 *
 * 설계 의도:
 * - localStorage (즉시 저장) + GitHub API (영구 저장)의 이중 저장소
 * - 기존 에디터의 save/restore, saveToGitHub/loadFromGitHub/executeSave,
 *   saveSnapshot/showSnapshots/restoreSnapshot, deleteDocument,
 *   toggleDocLock/conflictResolve/initAutoSave를 이 모듈로 통합
 * - 기존 doc-manager.js (외부 스크립트)의 GitHub API 호출을 재사용
 *
 * 기존 에디터 함수 매핑:
 *   save(2922)           -> storage.saveLocal()
 *   restore(2924)        -> storage.loadLocal()
 *   saveToGitHub(4293)   -> storage.saveToGitHub()
 *   executeSave(4313)    -> storage.executeSave()
 *   loadFromGitHub(4594) -> storage.loadFromGitHub()
 *   loadDoc(4624)        -> storage.loadDocument()
 *   deleteDocument(4673) -> storage.deleteDocument()
 *   toggleDocLock(4694)  -> storage.toggleLock()
 *   conflictResolve(4714)-> storage.resolveConflict()
 *   saveSnapshot(1588)   -> storage.createSnapshot()
 *   showSnapshots(2446)  -> (UI 전용 -- Phase 모듈에서 처리)
 *   restoreSnapshot(2466)-> storage.restoreSnapshot()
 *   initAutoSave(4740)   -> storage.startAutoSave()
 *   getEditorMeta(4276)  -> state.getAll().meta (state.js로 이동됨)
 */

import { bus, EVT } from './event-bus.js';


/* ═══════════════════════════════════════════
 * 상수
 * ═══════════════════════════════════════════ */

/** localStorage 저장 키 -- Paper Workbench v2 */
const LOCAL_KEY = 'aicra.paper-workbench.v2';

/** 기존 에디터 localStorage 키 -- 마이그레이션 소스 */
const LEGACY_KEY = 'aicra.paper.v4';

/** GitHub API 기본 URL */
const GITHUB_API = 'https://api.github.com/repos/AICRA-PAGE/AICRA-PAGE.github.io/contents/';

/** 자동 저장 간격 (밀리초) */
const AUTO_SAVE_INTERVAL = 30000;

/** 스냅샷 최대 보관 수 */
const MAX_SNAPSHOTS = 50;


/* ═══════════════════════════════════════════
 * GitHub 토큰 관리
 *
 * 기존 auth-guard.js / doc-manager.js와 동일한 토큰 소스:
 * - 'sveltia-cms.user' (Sveltia CMS PKCE 인증)
 * - 'netlify-cms-user' (Netlify CMS 인증)
 * ═══════════════════════════════════════════ */

/** 캐시된 토큰 */
let _cachedToken = null;

/**
 * getToken -- GitHub OAuth 토큰 조회
 *
 * Sveltia CMS / Netlify CMS가 localStorage에 저장한 토큰을 읽는다.
 * 기존 auth-guard.js:16, doc-manager.js:31과 동일한 로직.
 *
 * @returns {string|null} GitHub 토큰 또는 null
 */
export function getToken() {
  if (_cachedToken) return _cachedToken;

  const tokenKeys = ['sveltia-cms.user', 'netlify-cms-user'];
  for (const key of tokenKeys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const token = parsed.token || parsed.access_token;
      if (token && typeof token === 'string' && token.length > 10) {
        _cachedToken = token;
        return token;
      }
    } catch {
      /* JSON 파싱 실패 -- raw 문자열이 토큰일 수 있음 */
      if (typeof raw === 'string' && raw.length > 20 && raw.length < 200 && /^[a-zA-Z0-9_-]+$/.test(raw)) {
        _cachedToken = raw;
        return raw;
      }
    }
  }
  return null;
}


/* ═══════════════════════════════════════════
 * GitHub API 헬퍼
 * ═══════════════════════════════════════════ */

/**
 * fetchGH -- GitHub API 호출 (재시도 + 레이트 리밋 대응)
 *
 * 기존 doc-manager.js의 fetchRetry()와 동일한 패턴.
 *
 * @param {string} url     API URL
 * @param {Object} [opts]  fetch 옵션
 * @param {number} [retries=2] 최대 재시도 횟수
 * @returns {Promise<Response>}
 */
async function fetchGH(url, opts = {}, retries = 2) {
  const token = getToken();
  if (!opts.headers) opts.headers = {};
  if (token) opts.headers['Authorization'] = 'token ' + token;
  opts.headers['Accept'] = 'application/vnd.github+json';

  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, opts);

      /* 레이트 리밋 도달 -- 리셋까지 대기 후 재시도 */
      if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
        const resetTime = parseInt(res.headers.get('x-ratelimit-reset') || '0') * 1000 - Date.now();
        if (resetTime > 0 && resetTime < 60000) {
          await _sleep(resetTime + 1000);
          continue;
        }
      }

      /* 서버 오류 -- 재시도 */
      if (res.status >= 500 && i < retries) {
        await _sleep(1000 * (i + 1));
        continue;
      }

      return res;
    } catch (err) {
      if (i < retries) {
        await _sleep(1000 * (i + 1));
        continue;
      }
      throw err;
    }
  }
}


/* ═══════════════════════════════════════════
 * localStorage 저장/불러오기
 * ═══════════════════════════════════════════ */

/**
 * saveLocal -- Paper Object를 localStorage에 저장
 *
 * 기존 에디터의 save() (line 2922) 대체.
 * 기존: flat JSON {ti,au,coau,ab,kw,dm,status,collab,body,refs,at}
 * 신규: 전체 Paper Object를 직렬화
 *
 * @param {Object} paperData - Paper Object 전체
 */
export function saveLocal(paperData) {
  try {
    paperData._updatedAt = new Date().toISOString();
    localStorage.setItem(LOCAL_KEY, JSON.stringify(paperData));
  } catch (e) {
    console.warn('[Storage] localStorage 저장 실패:', e.message);
  }
}

/**
 * loadLocal -- localStorage에서 Paper Object 불러오기
 *
 * 기존 에디터의 restore() (line 2924) 대체.
 * 레거시 데이터 감지 시 자동 마이그레이션 수행.
 *
 * @returns {Object|null} Paper Object 또는 null
 */
export function loadLocal() {
  /* 1. 새 형식 시도 */
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* 파싱 실패 -- 계속 진행 */ }

  /* 2. 레거시 형식 감지 -> 자동 마이그레이션 */
  try {
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      const legacyData = JSON.parse(legacyRaw);
      /* 7일 이내 데이터만 마이그레이션 (기존 에디터와 동일한 TTL) */
      if (Date.now() - legacyData.at <= 604800000) {
        console.info('[Storage] 기존 paper-editor v4 데이터 감지 -- 마이그레이션 수행');
        /* state.js의 migrateLegacyV4를 동적 import */
        return { _migrationSource: 'v4', _legacyData: legacyData };
      }
    }
  } catch { /* 레거시 데이터 없음 또는 파싱 실패 */ }

  return null;
}


/* ═══════════════════════════════════════════
 * GitHub 저장/불러오기
 *
 * 기존 에디터의 GitHub 저장 경로:
 *   _drafts/{author}/{slug}.md
 *
 * Paper Workbench의 저장 경로:
 *   _papers/{author}/{slug}.json  (전체 Paper Object)
 *   _drafts/{author}/{slug}.md    (하위 호환 -- MD 내보내기 겸용)
 * ═══════════════════════════════════════════ */

/** 현재 열린 파일 경로 + SHA (충돌 감지용) */
let _currentFile = null;
let _currentSha = null;

/**
 * saveToGitHub -- Paper Object를 GitHub에 저장
 *
 * 기존 에디터의 saveToGitHub(4293) + executeSave(4313) 통합.
 *
 * @param {Object} paperData - Paper Object 전체
 * @param {string} fileName  - 파일명 (확장자 제외)
 * @param {Object} [opts]    - { forceSaveAs: boolean }
 * @returns {Promise<{path:string, sha:string}>}
 */
export async function saveToGitHub(paperData, fileName, opts = {}) {
  const token = getToken();
  if (!token) throw new Error('GitHub 인증이 필요합니다.');

  /* 저자 login 가져오기 */
  const user = await _getUser();
  const author = user?.login || 'unknown';

  /* 저장 경로 결정 */
  const cleanName = fileName.replace(/\.json$/, '').replace(/[^a-z0-9가-힣_-]/gi, '-').replace(/-+/g, '-');
  const path = `_papers/${author}/${cleanName}.json`;

  /* 직렬화 */
  paperData._updatedAt = new Date().toISOString();
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(paperData, null, 2))));

  /* GitHub Contents API 호출 */
  const body = {
    message: `[Paper Workbench] ${paperData.meta.title || cleanName}`,
    content: content,
  };

  /* SHA가 있으면 업데이트, 없으면 생성 */
  if (_currentSha && _currentFile === path && !opts.forceSaveAs) {
    body.sha = _currentSha;
  }

  const res = await fetchGH(GITHUB_API + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    /* 409 Conflict -- 충돌 감지 */
    if (res.status === 409) {
      bus.emit('ui:toast', { message: '문서 충돌이 감지되었습니다.', type: 'error' });
      throw new Error('conflict');
    }
    throw new Error(`GitHub 저장 실패: ${res.status}`);
  }

  const result = await res.json();
  _currentFile = path;
  _currentSha = result.content.sha;

  bus.emit(EVT.PROJECT_SAVED, { path, sha: _currentSha });

  return { path, sha: _currentSha };
}

/**
 * loadFromGitHub -- GitHub에서 논문 목록 조회
 *
 * 기존 에디터의 loadFromGitHub(4594) 대체.
 *
 * @returns {Promise<Array<{name:string, path:string, sha:string}>>}
 */
export async function loadFromGitHub() {
  const token = getToken();
  if (!token) throw new Error('GitHub 인증이 필요합니다.');

  const user = await _getUser();
  const author = user?.login || 'unknown';

  /* _papers/{author}/ 디렉토리 목록 조회 */
  const res = await fetchGH(GITHUB_API + `_papers/${author}`);
  if (!res.ok) {
    if (res.status === 404) return []; // 디렉토리 없음 = 저장된 논문 없음
    throw new Error(`GitHub 목록 조회 실패: ${res.status}`);
  }

  const files = await res.json();
  return (Array.isArray(files) ? files : [])
    .filter(f => f.name.endsWith('.json'))
    .map(f => ({ name: f.name.replace(/\.json$/, ''), path: f.path, sha: f.sha }));
}

/**
 * loadDocument -- GitHub에서 특정 논문 불러오기
 *
 * 기존 에디터의 loadDoc(4624) 대체.
 *
 * @param {string} path - GitHub 파일 경로
 * @returns {Promise<Object>} Paper Object
 */
export async function loadDocument(path) {
  const res = await fetchGH(GITHUB_API + path);
  if (!res.ok) throw new Error(`문서 불러오기 실패: ${res.status}`);

  const data = await res.json();
  _currentFile = path;
  _currentSha = data.sha;

  /* Base64 디코딩 */
  const decoded = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
  const paperData = JSON.parse(decoded);

  bus.emit(EVT.PROJECT_LOADED, { path, data: paperData });
  return paperData;
}

/**
 * deleteDocument -- GitHub에서 논문 삭제
 *
 * 기존 에디터의 deleteDocument(4673) 대체.
 *
 * @param {string} path - GitHub 파일 경로
 * @param {string} sha  - 파일 SHA
 * @returns {Promise<void>}
 */
export async function deleteDocument(path, sha) {
  const res = await fetchGH(GITHUB_API + path, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `[Paper Workbench] Delete ${path}`,
      sha: sha,
    }),
  });

  if (!res.ok) throw new Error(`문서 삭제 실패: ${res.status}`);

  /* 현재 파일이 삭제된 경우 참조 해제 */
  if (_currentFile === path) {
    _currentFile = null;
    _currentSha = null;
  }
}


/* ═══════════════════════════════════════════
 * 스냅샷 관리
 *
 * 기존 에디터의 IndexedDB 'PaperDB' -> 'snapshots' store를
 * Paper Object 내부 배열로 통합한다.
 * ═══════════════════════════════════════════ */

/**
 * createSnapshot -- 현재 상태의 스냅샷 생성
 *
 * 기존 에디터의 saveSnapshot(1588) 대체.
 *
 * @param {Object} paperData - Paper Object 전체
 * @param {string} [label]   - 스냅샷 레이블 (기본: 'auto')
 * @returns {Object} 갱신된 Paper Object
 */
export function createSnapshot(paperData, label = 'auto') {
  if (!paperData.snapshots) paperData.snapshots = [];

  const snapshot = {
    date: new Date().toISOString(),
    label: label,
    body: paperData.draft.body,
    refs: paperData.references.map(r => r.raw),
    meta: {
      title: paperData.meta.title,
      author: paperData.meta.firstAuthor,
      wordCount: (paperData.draft.body || '').split(/\s+/).length,
    },
  };

  paperData.snapshots.push(snapshot);

  /* 최대 수량 초과 시 오래된 것부터 제거 */
  if (paperData.snapshots.length > MAX_SNAPSHOTS) {
    paperData.snapshots = paperData.snapshots.slice(-MAX_SNAPSHOTS);
  }

  bus.emit(EVT.SNAPSHOT_CREATED, { snapshot });
  return paperData;
}

/**
 * restoreSnapshot -- 스냅샷에서 본문/참고문헌 복원
 *
 * 기존 에디터의 restoreSnapshot(2466) 대체.
 *
 * @param {Object} paperData - Paper Object
 * @param {number} index     - 복원할 스냅샷 인덱스
 * @returns {Object} 복원된 Paper Object
 */
export function restoreFromSnapshot(paperData, index) {
  const snaps = paperData.snapshots || [];
  if (index < 0 || index >= snaps.length) throw new Error('유효하지 않은 스냅샷 인덱스');

  const snap = snaps[index];
  paperData.draft.body = snap.body || '';

  /* 참고문헌 복원 */
  if (snap.refs) {
    paperData.references = snap.refs.map((raw, i) => ({
      id: i + 1,
      raw: raw,
      bibtex: '',
      parsed: null,
      source: 'snapshot',
      tags: [],
      formatted: '',
    }));
  }

  return paperData;
}


/* ═══════════════════════════════════════════
 * 자동 저장
 *
 * 기존 에디터의 initAutoSave(4740) + setInterval(save,30000) 대체.
 * ═══════════════════════════════════════════ */

let _autoSaveTimer = null;

/**
 * startAutoSave -- 자동 저장 시작
 *
 * @param {Function} getState  - 현재 Paper Object를 반환하는 함수
 * @param {number} [interval]  - 저장 간격 (밀리초, 기본 30초)
 */
export function startAutoSave(getState, interval = AUTO_SAVE_INTERVAL) {
  stopAutoSave(); // 기존 타이머 정리
  _autoSaveTimer = setInterval(() => {
    const data = getState();
    if (data) {
      saveLocal(data);
      bus.emit('ui:toast', { message: '자동 저장됨', type: 'info' });
    }
  }, interval);
}

/**
 * stopAutoSave -- 자동 저장 중지
 */
export function stopAutoSave() {
  if (_autoSaveTimer) {
    clearInterval(_autoSaveTimer);
    _autoSaveTimer = null;
  }
}


/* ═══════════════════════════════════════════
 * 문서 잠금
 *
 * 기존 에디터의 toggleDocLock(4694) + updateLockUI(4707) 대체.
 * doc-manager.js의 toggleLock API를 사용.
 * ═══════════════════════════════════════════ */

/**
 * toggleLock -- 문서 잠금/해제 전환
 *
 * @param {Object} paperData - Paper Object
 * @returns {Object} 갱신된 Paper Object
 */
export function toggleLock(paperData) {
  paperData.submit.documentLocked = !paperData.submit.documentLocked;
  return paperData;
}


/* ═══════════════════════════════════════════
 * 접근자 (현재 파일 정보)
 * ═══════════════════════════════════════════ */

/** 현재 열린 파일 경로 반환 */
export function getCurrentFile() { return _currentFile; }

/** 현재 파일 SHA 반환 */
export function getCurrentSha() { return _currentSha; }

/** 현재 파일 SHA 수동 설정 (충돌 해결 시) */
export function setCurrentSha(sha) { _currentSha = sha; }


/* ═══════════════════════════════════════════
 * 내부 유틸리티
 * ═══════════════════════════════════════════ */

/** 현재 사용자 정보 캐시 */
let _userCache = null;

/**
 * _getUser -- GitHub 사용자 정보 조회 (캐시)
 * @private
 * @returns {Promise<{login:string,name:string}|null>}
 */
async function _getUser() {
  if (_userCache) return _userCache;
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': 'token ' + token },
    });
    if (res.ok) {
      _userCache = await res.json();
      return _userCache;
    }
  } catch { /* 네트워크 오류 */ }
  return null;
}

/**
 * _sleep -- 지정 시간 대기 (재시도 간격용)
 * @private
 * @param {number} ms 밀리초
 */
function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * slugify -- 파일명 생성용 슬러그 변환
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);
}
