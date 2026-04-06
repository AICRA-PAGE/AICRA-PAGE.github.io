/**
 * citation.js -- 인용/참고문헌 관리 모듈
 *
 * 여러 Phase에서 공유되는 인용 관리 기능:
 * - Research: 논문 검색 + 참고문헌 수집
 * - Draft: 인용 삽입 + BibTeX 임포트
 * - Refine: 중복 검사 + 순서 재정렬
 *
 * 기존 paper-editor.html 함수 매핑:
 *   addRef(2375)              -> addReference()
 *   removeRef(2377)           -> removeReference()
 *   renderRefs(2379)          -> renderReferenceList()
 *   insertExistingCite(2392)  -> insertCitation()
 *   handleCiteInsert(2182)    -> handleCiteInsert()
 *   _completeCiteInsert(2198) -> completeCiteInsert()
 *   _cancelPendingCite(2211)  -> cancelPendingCite()
 *   importBibTeX(2411)        -> importBibTeX()
 *   reorderCitations(3810)    -> reorderCitations()
 *   checkRefDuplicates(3868)  -> checkRefDuplicates()
 *   searchScholar(3885)       -> searchScholar()
 *   addScholarRef(3948)       -> addScholarRef()
 *   openGScholar(3956)        -> openGScholar()
 *   openAcademicDB(3961)      -> openAcademicDB()
 *   formatRef(4189)           -> formatReference()
 *   addFormattedRef(4218)     -> addFormattedRef()
 *   showRefGuide(4229)        -> (UI 전용 -- Phase에서 처리)
 */

import { bus, EVT } from '../core/event-bus.js';
import { escHtml, escAttr } from './ui.js';


/* ═══════════════════════════════════════════
 * 참고문헌 CRUD
 * ═══════════════════════════════════════════ */

/**
 * addReference -- 참고문헌 추가
 *
 * 기존: addRef(2375) -- refs.push(v)
 *
 * @param {import('../core/state.js').StateManager} state - 상태 관리자
 * @param {string} rawText - 참고문헌 원본 텍스트
 * @param {Object} [opts] - 추가 옵션 { source, bibtex, tags }
 * @returns {number} 할당된 참고문헌 번호 (1-based)
 */
export function addReference(state, rawText, opts = {}) {
  const refs = state.get('references') || [];
  const newRef = {
    id: refs.length + 1,
    raw: rawText.trim(),
    bibtex: opts.bibtex || '',
    parsed: null,
    source: opts.source || 'manual',
    tags: opts.tags || [],
    formatted: opts.formatted || '',
  };
  state.push('references', newRef);
  bus.emit(EVT.CITATION_ADDED, { ref: newRef });
  return newRef.id;
}

/**
 * removeReference -- 참고문헌 제거
 *
 * 기존: removeRef(2377) -- refs.splice(idx,1)
 *
 * @param {import('../core/state.js').StateManager} state
 * @param {number} index - 제거할 인덱스 (0-based)
 */
export function removeReference(state, index) {
  state.removeAt('references', index);
  /* 제거 후 id 재할당 */
  const refs = state.get('references') || [];
  refs.forEach((r, i) => { r.id = i + 1; });
  state.set('references', refs);
  bus.emit(EVT.CITATION_REMOVED, { index });
}


/* ═══════════════════════════════════════════
 * 참고문헌 목록 UI 렌더링
 * ═══════════════════════════════════════════ */

/**
 * renderReferenceList -- 참고문헌 사이드 패널 목록 렌더링
 *
 * 기존: renderRefs(2379) -- DOM 직접 조작
 *
 * @param {Array} refs - 참고문헌 배열
 * @param {HTMLElement} listEl - 목록을 렌더링할 DOM 요소
 * @param {Object} callbacks - { onCiteInsert(num), onRemove(idx) }
 */
export function renderReferenceList(refs, listEl, callbacks = {}) {
  if (!listEl) return;
  listEl.innerHTML = '';

  refs.forEach((ref, i) => {
    const div = document.createElement('div');
    div.className = 'ref-item';
    div.style.cursor = 'pointer';
    div.title = '클릭하여 [cite:' + (i + 1) + '] 삽입';

    /* 클릭: 인용 삽입 */
    div.addEventListener('click', () => {
      if (callbacks.onCiteInsert) callbacks.onCiteInsert(i + 1);
    });

    /* 번호 */
    const b = document.createElement('b');
    b.textContent = '[' + (i + 1) + ']';
    div.appendChild(b);

    /* 참고문헌 텍스트 */
    const rawText = typeof ref === 'string' ? ref : (ref.raw || ref.formatted || '');
    div.appendChild(document.createTextNode(' ' + rawText + ' '));

    /* 삭제 버튼 */
    const x = document.createElement('span');
    x.style.cssText = 'cursor:pointer;color:#b42318;float:right';
    x.textContent = 'x';
    x.addEventListener('click', e => {
      e.stopPropagation();
      if (callbacks.onRemove) callbacks.onRemove(i);
    });
    div.appendChild(x);

    listEl.appendChild(div);
  });
}


/* ═══════════════════════════════════════════
 * 인용 삽입 워크플로우
 *
 * 기존 흐름:
 * 1. insertBlock('cite') -> handleCiteInsert() -- 커서 위치 저장 + 패널 열기
 * 2. 사용자가 참고문헌 선택/추가
 * 3. addRef() or addScholarRef() -> _completeCiteInsert() -- [cite:N] 삽입
 * ═══════════════════════════════════════════ */

/** 인용 삽입 대기 상태 */
let _pendingCite = false;
let _citeSelStart = 0;
let _citeSelEnd = 0;

/**
 * handleCiteInsert -- 인용 삽입 시작 (커서 위치 저장)
 *
 * 기존: handleCiteInsert(2182)
 *
 * @param {HTMLTextAreaElement} inputEl - 편집기 textarea
 */
export function handleCiteInsert(inputEl) {
  _citeSelStart = inputEl.selectionStart;
  _citeSelEnd = inputEl.selectionEnd;
  _pendingCite = true;
}

/**
 * completeCiteInsert -- 참고문헌 추가 후 [cite:N] 자동 삽입
 *
 * 기존: _completeCiteInsert(2198)
 *
 * @param {HTMLTextAreaElement} inputEl - 편집기 textarea
 * @param {number} refNum - 참고문헌 번호 (1-based)
 */
export function completeCiteInsert(inputEl, refNum) {
  if (!_pendingCite) return;
  _pendingCite = false;

  inputEl.focus();
  inputEl.setSelectionRange(_citeSelStart, _citeSelEnd);
  document.execCommand('insertText', false, '[cite:' + refNum + ']');
  inputEl.dispatchEvent(new Event('input'));
}

/**
 * cancelPendingCite -- 대기 중인 인용 삽입 취소
 *
 * 기존: _cancelPendingCite(2211)
 */
export function cancelPendingCite() {
  _pendingCite = false;
}

/**
 * isPendingCite -- 인용 삽입 대기 중인지 확인
 * @returns {boolean}
 */
export function isPendingCite() {
  return _pendingCite;
}


/* ═══════════════════════════════════════════
 * BibTeX 임포트
 *
 * 기존: importBibTeX(2411)
 * ═══════════════════════════════════════════ */

/**
 * importBibTeX -- .bib 파일을 파싱하여 참고문헌 일괄 등록
 *
 * @param {File} file - BibTeX 파일
 * @param {import('../core/state.js').StateManager} state
 * @returns {Promise<number>} 추가된 항목 수
 */
export function importBibTeX(file, state) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const entries = parseBibTeX(text);
      let added = 0;

      entries.forEach(ent => {
        const formatted = ent.authors + ', "' + ent.title + '," ' +
          (ent.venue ? ent.venue + ', ' : '') + ent.year + '.' +
          (ent.doi ? ' DOI: ' + ent.doi : '');
        addReference(state, formatted, { source: 'bibtex', bibtex: ent.raw || '' });
        added++;
      });

      resolve(added);
    };
    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsText(file);
  });
}

/**
 * parseBibTeX -- BibTeX 텍스트를 구조화된 항목 배열로 파싱
 *
 * 기존: parseBibTeX (paper-engine.js에서 제공)
 * 여기서 직접 구현하여 외부 의존성 제거.
 *
 * @param {string} text - BibTeX 텍스트
 * @returns {Array<{key, type, title, authors, year, venue, doi, raw}>}
 */
export function parseBibTeX(text) {
  const entries = [];
  /* @type{key, ... } 패턴 매칭 */
  const re = /@(\w+)\s*\{([^,]*),\s*([\s\S]*?)\n\s*\}/g;
  let m;

  while ((m = re.exec(text))) {
    const type = m[1].toLowerCase();
    const key = m[2].trim();
    const body = m[3];

    /* 필드 추출 */
    const fields = {};
    body.replace(/(\w+)\s*=\s*[{"](.+?)[}"]/g, (fm, fk, fv) => {
      fields[fk.toLowerCase()] = fv.trim();
    });

    entries.push({
      key,
      type,
      title: fields.title || '',
      authors: fields.author || '',
      year: fields.year || '',
      venue: fields.journal || fields.booktitle || '',
      doi: fields.doi || '',
      raw: m[0],
    });
  }
  return entries;
}


/* ═══════════════════════════════════════════
 * 인용 순서 재정렬
 *
 * 기존: reorderCitations(3810)
 * ═══════════════════════════════════════════ */

/**
 * reorderCitations -- 본문 등장 순서대로 참고문헌 번호 재할당
 *
 * 1. 본문에서 [cite:N] 등장 순서 추출
 * 2. 참고문헌을 등장 순서로 재배치 (미인용 항목은 뒤로)
 * 3. 본문의 인용 번호를 새 번호로 갱신
 *
 * @param {import('../core/state.js').StateManager} state
 * @returns {{ success: boolean, message: string, newBody: string|null }}
 */
export function reorderCitations(state) {
  const body = state.get('draft.body') || '';
  const refs = state.get('references') || [];

  /* 등장 순서 추출 */
  const citeOrder = [];
  body.replace(/\[cite:(\d+)\]/g, (m, n) => {
    const num = parseInt(n);
    if (!citeOrder.includes(num)) citeOrder.push(num);
  });

  if (!citeOrder.length) {
    return { success: false, message: '본문에 인용이 없습니다.', newBody: null };
  }
  if (citeOrder.some(n => n > refs.length)) {
    return { success: false, message: '본문에 존재하지 않는 참고문헌 번호가 있습니다.', newBody: null };
  }

  /* 재배치: 인용된 것 먼저 (등장 순), 미인용은 뒤 */
  const citedRefs = citeOrder.map(n => refs[n - 1]).filter(Boolean);
  const uncitedRefs = refs.filter((r, i) => !citeOrder.includes(i + 1));
  const newRefs = [...citedRefs, ...uncitedRefs];

  /* 번호 매핑 */
  const mapping = {};
  citeOrder.forEach((oldN, i) => { mapping[oldN] = i + 1; });

  /* 본문 인용 번호 갱신 */
  const newBody = body.replace(/\[cite:(\d+)\]/g, (m, n) => '[cite:' + mapping[parseInt(n)] + ']');

  /* id 재할당 */
  newRefs.forEach((r, i) => { r.id = i + 1; });

  /* state 갱신 */
  state.set('references', newRefs);
  state.set('draft.body', newBody);

  return { success: true, message: '인용 순서 재정렬 완료 (' + refs.length + '편)', newBody };
}


/* ═══════════════════════════════════════════
 * 참고문헌 중복 검사
 *
 * 기존: checkRefDuplicates(3868)
 * ═══════════════════════════════════════════ */

/**
 * checkRefDuplicates -- 유사한 제목/DOI의 중복 참고문헌 탐지
 *
 * @param {Array} refs - 참고문헌 배열
 * @returns {Array<{refA: number, refB: number, text: string}>} 중복 의심 목록
 */
export function checkRefDuplicates(refs) {
  const dupes = [];
  const norm = s => (typeof s === 'string' ? s : s.raw || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '').substring(0, 60);

  refs.forEach((r, i) => {
    refs.forEach((r2, j) => {
      if (i < j && norm(r) === norm(r2)) {
        const text = typeof r === 'string' ? r : (r.raw || '');
        dupes.push({
          refA: i + 1,
          refB: j + 1,
          text: '[' + (i + 1) + ']와 [' + (j + 1) + '] 중복 의심: ' + text.substring(0, 50) + '...',
        });
      }
    });
  });
  return dupes;
}


/* ═══════════════════════════════════════════
 * 학술 DB 검색
 *
 * 기존: searchScholar(3885)
 * ═══════════════════════════════════════════ */

/** 검색 페이지네이션 상태 */
let _searchOffset = 0;
let _lastQuery = '';

/**
 * searchScholar -- Semantic Scholar / CrossRef API로 논문 검색
 *
 * @param {string} query - 검색어
 * @param {Object} [opts] - { append: boolean, offset: number }
 * @returns {Promise<Array<{title, authors, year, venue, citationCount, refText}>>}
 */
export async function searchScholar(query, opts = {}) {
  if (!query.trim()) return [];

  if (query !== _lastQuery) { _searchOffset = 0; _lastQuery = query; }
  if (opts.offset !== undefined) _searchOffset = opts.offset;

  try {
    /* Semantic Scholar API (1차) */
    const res = await fetch(
      'https://api.semanticscholar.org/graph/v1/paper/search?query=' +
      encodeURIComponent(query) + '&limit=20&offset=' + _searchOffset +
      '&fields=title,authors,year,venue,citationCount'
    );

    if (!res.ok) throw new Error('Semantic Scholar API error');

    const data = await res.json();
    _searchOffset += 20;

    if (!data.data || !data.data.length) return [];

    return data.data.map(p => {
      const authors = (p.authors || []).map(a => a.name).join(', ');
      return {
        title: p.title || '',
        authors,
        year: p.year || '',
        venue: p.venue || '',
        citationCount: p.citationCount || 0,
        refText: authors + '. "' + p.title + '." ' + (p.venue || '') + ', ' + (p.year || '') + '.',
        total: data.total || 0,
      };
    });

  } catch {
    /* CrossRef API (fallback) */
    try {
      const res = await fetch('https://api.crossref.org/works?query=' + encodeURIComponent(query) + '&rows=10');
      if (!res.ok) throw new Error();
      const data = await res.json();

      return (data.message.items || []).map(p => {
        const authors = (p.author || []).map(a => (a.family || '') + ' ' + (a.given || '')).join(', ');
        const title = (p.title || [''])[0];
        const year = p.published && p.published['date-parts'] ? p.published['date-parts'][0][0] : '';
        const venue = (p['container-title'] || [''])[0];
        return {
          title,
          authors,
          year: String(year),
          venue,
          citationCount: p['is-referenced-by-count'] || 0,
          refText: authors + '. "' + title + '." ' + venue + ', ' + year + '.',
          total: data.message['total-results'] || 0,
        };
      });
    } catch {
      return [];
    }
  }
}

/**
 * openGScholar -- Google Scholar 검색 페이지 열기
 *
 * 기존: openGScholar(3956)
 *
 * @param {string} query - 검색어
 */
export function openGScholar(query) {
  if (query.trim()) {
    window.open('https://scholar.google.com/scholar?q=' + encodeURIComponent(query), '_blank');
  }
}

/**
 * openAcademicDB -- 외부 학술 데이터베이스 열기
 *
 * 기존: openAcademicDB(3961)
 *
 * @param {string} db - 데이터베이스 코드: riss|kci|dbpia|kiss|scienceon|dblp|acl|ieee|arxiv
 * @param {string} query - 검색어
 */
export function openAcademicDB(db, query) {
  if (!query.trim()) return;
  const q = encodeURIComponent(query);

  const urls = {
    riss: 'https://www.riss.kr/search/Search.do?queryText=' + q,
    kci: 'https://www.kci.go.kr/kciportal/po/search/poSearList.kci?searchBean.query=' + q,
    dbpia: 'https://www.dbpia.co.kr/search/topSearch?searchOption=all&query=' + q,
    kiss: 'https://kiss.kstudy.com/ExternalLink/ExternalLink?pub=KSTUDY&key=search&type=keyword&query=' + q,
    scienceon: 'https://scienceon.kisti.re.kr/srch/selectPORSrchArticle.do?query=' + q,
    dblp: 'https://dblp.org/search?q=' + q,
    acl: 'https://aclanthology.org/search/?q=' + q,
    ieee: 'https://ieeexplore.ieee.org/search/searchresult.jsp?queryText=' + q,
    arxiv: 'https://arxiv.org/search/?query=' + q + '&searchtype=all',
  };

  const url = urls[db];
  if (url) window.open(url, '_blank');
}
