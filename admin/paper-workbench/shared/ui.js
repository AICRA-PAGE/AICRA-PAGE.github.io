/**
 * ui.js -- 공통 UI 유틸리티 함수
 *
 * 기존 paper-editor.html에서 추출한 범용 유틸리티.
 * 모든 Phase 모듈과 shared 모듈에서 import하여 사용한다.
 *
 * 기존 함수 매핑:
 *   escHtml(1531)        -> escHtml()
 *   escAttr(1533)        -> escAttr()
 *   sanitizeHtml(1634)   -> sanitizeHtml()
 *   debounce(1614)       -> debounce()
 *   closeModal(3065)     -> closeModal()
 *   _addCrClose(1549)    -> addCloseButton()
 *   simpleHash           -> simpleHash()  (sectionCache 용)
 */

/* ═══════════════════════════════════════════
 * HTML 이스케이프
 * ═══════════════════════════════════════════ */

/**
 * escHtml -- XSS 방지용 HTML 텍스트 이스케이프
 *
 * 기존: paper-editor.html line 1531
 *
 * @param {string} s - 이스케이프할 문자열
 * @returns {string} 이스케이프된 문자열
 */
export function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/**
 * escAttr -- HTML 속성값 이스케이프
 *
 * 기존: paper-editor.html line 1533
 *
 * @param {string} s - 이스케이프할 문자열
 * @returns {string} 이스케이프된 문자열
 */
export function escAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;');
}


/* ═══════════════════════════════════════════
 * HTML 새니타이징
 * ═══════════════════════════════════════════ */

/**
 * sanitizeHtml -- DOMPurify 기반 HTML 새니타이징 (XSS 방지)
 *
 * 기존: paper-editor.html line 1634
 * 학술 에디터에 필요한 태그/속성을 허용 목록에 추가.
 *
 * @param {string} html - 새니타이징할 HTML
 * @returns {string} 새니타이징된 HTML
 */
export function sanitizeHtml(html) {
  if (window.DOMPurify) {
    return DOMPurify.sanitize(html, {
      ADD_TAGS: ['section', 'nav'],
      ADD_ATTR: ['data-start', 'data-end', 'data-target', 'data-ref-target', 'data-fn', 'data-fn-back'],
      ALLOW_DATA_ATTR: true,
    });
  }
  /* DOMPurify 미로드 시 fallback -- 텍스트로 변��� */
  const d = document.createElement('div');
  d.textContent = html;
  return d.innerHTML;
}


/* ═══════════════════════════════════════════
 * 디바운스
 * ═══════════════════════════════════════════ */

/**
 * debounce -- 연속 호출 시 마지막 호출만 실행
 *
 * 기존: paper-editor.html line 1614
 *
 * @param {Function} fn - 디바운스할 함수
 * @param {number} ms - 지연 시간(밀리초)
 * @returns {Function} 디바운스된 함수
 */
export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}


/* ═══════════════════════════════════════════
 * 모달 관리
 * ═══════════════════════════════════════════ */

/**
 * closeModal -- 모달 오버레이 닫기
 *
 * 기존: paper-editor.html line 3065
 *
 * @param {string} id - 모달 요소 ID
 */
export function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
}

/**
 * openModal -- 모달 오버레이 열기
 * @param {string} id - 모달 요소 ID
 */
export function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('show');
}

/**
 * addCloseButton -- 패널/카드 요소에 닫기(X) 버튼 추가
 *
 * 기존: paper-editor.html line 1549 (_addCrClose)
 *
 * @param {HTMLElement} container - 닫기 버튼을 추가할 컨테이너
 */
export function addCloseButton(container) {
  const btn = document.createElement('button');
  btn.style.cssText = 'position:absolute;right:8px;top:8px;border:none;background:none;cursor:pointer;font-size:.8rem;color:var(--muted)';
  btn.textContent = 'X';
  btn.setAttribute('aria-label', '닫기');
  btn.addEventListener('click', () => { container.style.display = 'none'; });
  container.insertBefore(btn, container.firstChild);
}


/* ═══════════════════════════════════════════
 * 해시 함수 (섹션 캐시용)
 * ═══════════════════════════════════════════ */

/**
 * simpleHash -- 문자열의 간단한 해시값 생성
 *
 * 렌더링 섹션 캐시에서 변경 감지용으로 사용.
 * 암호학적 보안이 아닌 성능용.
 *
 * @param {string} s - 해시할 문자열
 * @returns {string} 해시값 (36진수 문자열)
 */
export function simpleHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0; /* 32비트 정수 범위 유지 */
  }
  return h.toString(36);
}


/* ═══════════════════════════════════════════
 * 토스트 메시지
 * ═══════════════════════════════════════════ */

/**
 * showToast -- 화면 우하단에 토스트 메시지 표시
 *
 * @param {string} message - 표시할 메시지
 * @param {string} [type='info'] - 유형: 'info' | 'warn' | 'error'
 * @param {number} [duration=3000] - 표시 시간(밀리초)
 */
export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = 'toast ' + (type === 'warn' ? 'warn' : type === 'error' ? 'error' : '');
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => { el.remove(); }, duration);
}


/* ═══════════════════════════════════════════
 * 편집기 디바운스 지연 계산
 * ═══════════════════════════════════════════ */

/**
 * getDebounceMs -- 문서 길이에 따른 디바운스 지연시간 계산
 *
 * 기존: paper-editor.html line 1608
 * 짧은 문서: 빠른 반응 (150ms)
 * 긴 문서: 느린 반응으로 성능 보호 (400ms)
 *
 * @param {number} charCount - 문서 문자 수
 * @returns {number} 디바운스 지연 시간(밀리초)
 */
export function getDebounceMs(charCount) {
  if (charCount > 100000) return 400;
  if (charCount > 30000) return 250;
  return 150;
}


/* ═══════════════════════════════════════════
 * 페이지 수 추정
 * ═══════════════════════════════════════════ */

/**
 * estimatePages -- 학회 양식별 예상 페이지 수 계산
 *
 * 기존: paper-editor.html line 1535 (_estimatePages)
 *
 * @param {number} wordCount - 단어 수
 * @param {string} body - 본문 Markdown
 * @param {string} [venueTemplate=''] - 학회 양식 코드
 * @returns {number} 예상 페이지 수
 */
export function estimatePages(wordCount, body, venueTemplate = '') {
  /* 학회별 한 페이지당 단어 수 (2단=많음, 1단=적음) */
  const wordsPerPage = {
    'sp': 750, 'ccs': 800, 'neurips_en': 600,
    'ieee_en': 650, 'acm_en': 700, 'tdsc': 750,
    'tifs': 750, 'ndss': 700, 'usenix': 700,
  }[venueTemplate] || 500;

  /* 시각 요소에 의한 추가 페이지 (그림, 표, Mermaid) */
  const figs = (body.match(/!\[/g) || []).length;
  const tbls = (body.match(/^\|/gm) || []).length / 4;
  const merm = (body.match(/```mermaid/g) || []).length;
  const visualPages = (figs + tbls + merm) * 0.3;

  return Math.ceil(wordCount / wordsPerPage + visualPages);
}
