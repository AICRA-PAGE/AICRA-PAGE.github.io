/**
 * draft.js -- Phase 3: 집필 (전체 편집기 구현)
 *
 * 기존 paper-editor.html의 핵심 편집 기능을 모듈화한 것.
 * 모든 기존 편집 기능이 여기에 매핑됨.
 *
 * 기존 함수 매핑:
 *   insertBlock(2113)        -> insertBlock()
 *   typeText(2022)           -> typeText()
 *   replaceAll(2024)         -> replaceAll()
 *   wrapSelection(2063)      -> wrapSelection()
 *   insertFootnote(2067)     -> insertFootnote()
 *   toggleFindPanel(2223)    -> (인라인 구현)
 *   findNext(2234)           -> findNext()
 *   replaceOne(2249)         -> replaceOne()
 *   replaceAllFind(2257)     -> replaceAllFind()
 *   updateStats(2704)        -> updateStats()
 *   _estimatePages(1535)     -> estimatePages (shared/ui.js)
 *   getDebounceMs(1608)      -> getDebounceMs (shared/ui.js)
 *   updateWordTarget(2432)   -> updateWordTarget()
 *   toggleColumnLayout(2920) -> toggleColumnLayout()
 *   zoomPreview(3832)        -> zoomPreview()
 *   buildFigureTableList(3840) -> buildFigureTableList()
 *   parseSections(2971)      -> parseSections()
 *   genAbstract(3012)        -> genAbstract()
 *   insertAbstract(3040)     -> insertAbstract()
 *   splitSentences(2980)     -> splitSentences()
 *   matchSection(2989)       -> matchSection()
 *   scoreSentence(2997)      -> scoreSentence()
 *   getBestSentence(3006)    -> getBestSentence()
 *   키보드 단축키 (2026-2061) -> _setupKeyboardShortcuts()
 *   스크롤 동기화 (1616-1629) -> _setupScrollSync()
 *   자동 들여쓰기 (2029-2048) -> (키보드 핸들러 내)
 */

import { bus, EVT } from '../../core/event-bus.js';
import { escHtml, getDebounceMs, estimatePages } from '../../shared/ui.js';
import { renderDraft, createRenderContext } from '../../shared/render.js';
import { addReference, removeReference, renderReferenceList, handleCiteInsert as _handleCiteInsert, completeCiteInsert, cancelPendingCite, isPendingCite, searchScholar, openGScholar, openAcademicDB, importBibTeX, reorderCitations, checkRefDuplicates } from '../../shared/citation.js';

/** @type {import('../../core/state.js').StateManager} */
let _state = null;
let _bus = null;

/** DOM 참조 (activate 시 바인딩) */
let _inputEl = null;   /* 편집기 textarea */
let _previewEl = null;  /* 프리뷰 패널 */

/** 렌더 토큰 (stale render 방지) */
let _renderToken = 0;
/** 디바운스 타이머 */
let _renderTimer = null;
/** 프리뷰 확대/축소 */
let _pvZoom = 100;
/** 이벤트 리스너 해제 함수 목록 */
let _cleanups = [];


/* ═══════════════════════════════════════════
 * Phase 인터페이스 구현
 * ═══════════════════════════════════════════ */

export function init(state, eventBus) {
  _state = state;
  _bus = eventBus;
}

export function activate() {
  const el = document.getElementById('phase-content');
  if (!el) return;

  const body = _state.get('draft.body') || '';
  const settings = _state.get('draft.editorSettings') || {};
  _pvZoom = settings.previewZoom || 100;

  /* ── 전체 에디터 레이아웃 렌더링 ── */
  el.innerHTML = _buildEditorHTML();

  /* DOM 참조 바인딩 */
  _inputEl = document.getElementById('draft-input');
  _previewEl = document.getElementById('draft-preview');

  /* 초기 본문 설정 */
  if (_inputEl) _inputEl.value = body;

  /* 이벤트 설정 */
  _setupInputHandler();
  _setupKeyboardShortcuts();
  _setupScrollSync();
  _setupInsertBarHandlers();
  _setupReferencePanel();

  /* 초기 렌더링 */
  if (body) _scheduleRender();

  /* 초기 통계 */
  _updateStats();
}

export function deactivate() {
  /* 본문 저장 */
  if (_inputEl) {
    _state.set('draft.body', _inputEl.value);
  }
  /* 에디터 설정 저장 */
  _state.set('draft.editorSettings.previewZoom', _pvZoom);
  /* 이벤트 정리 */
  _cleanups.forEach(fn => fn());
  _cleanups = [];
  clearTimeout(_renderTimer);
  _inputEl = null;
  _previewEl = null;
}

export function getStatus() {
  const body = _state.get('draft.body') || '';
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const sections = (body.match(/^#{2,3}\s/gm) || []).length;
  const progress = Math.min(100, Math.round(words / 50));
  return { progress, summary: `${words}단어, ${sections}섹션` };
}


/* ═══════════════════════════════════════════
 * 에디터 HTML 생성
 * ═══════════════════════════════════════════ */

function _buildEditorHTML() {
  return `
    <!-- 삽입 도구 바 (기존 .ins 바 재현) -->
    <div class="ins-bar" id="draft-insert-bar" style="display:flex;gap:2px;padding:3px 12px;background:var(--panel);border-bottom:1px solid var(--line);flex-shrink:0;flex-wrap:wrap;align-items:center">
      <span style="font-size:.5rem;color:var(--brand);font-weight:700;padding:0 3px">구조</span>
      <button class="bt ins-btn" data-block="sec" title="섹션 제목">섹션</button>
      <button class="bt ins-btn" data-block="subsec" title="하위 섹션">소제목</button>
      <button class="bt ins-btn" data-block="eq" title="번호 매김 수식">수식</button>
      <button class="bt ins-btn" data-block="fig" title="그림 삽입">그림</button>
      <button class="bt ins-btn" data-block="tbl" title="표 삽입">표</button>
      <button class="bt ins-btn" data-block="code" title="코드 블록">코드</button>
      <button class="bt ins-btn" data-block="cite" title="인용 삽입">인용</button>
      <button class="bt ins-btn" data-block="fn" title="각주 삽입">각주</button>
      <span style="font-size:.5rem;color:var(--brand);font-weight:700;padding:0 3px;border-left:2px solid var(--brand);margin-left:3px">학술</span>
      <button class="bt ins-btn" data-block="thm" title="정리">정리</button>
      <button class="bt ins-btn" data-block="lem" title="보조정리">보조정리</button>
      <button class="bt ins-btn" data-block="def" title="정의">정의</button>
      <button class="bt ins-btn" data-block="proof" title="증명">증명</button>
      <button class="bt ins-btn" data-block="algo" title="알고리즘">알고리즘</button>
      <span style="font-size:.5rem;color:var(--brand);font-weight:700;padding:0 3px;border-left:2px solid var(--brand);margin-left:3px">보안</span>
      <button class="bt ins-btn" data-block="threat" title="위협 모델">위협모델</button>
      <button class="bt ins-btn" data-block="eval" title="평가 결과 표">평가표</button>
      <button class="bt ins-btn" data-block="framework" title="프레임워크 매핑">FW매핑</button>
      <span style="font-size:.5rem;color:var(--brand);font-weight:700;padding:0 3px;border-left:2px solid var(--brand);margin-left:3px">차트</span>
      <button class="bt ins-btn" data-block="arch" title="아키텍처 다이어그램">아키텍처</button>
      <button class="bt ins-btn" data-block="flowchart" title="시퀀스 다이어그램">흐름도</button>
      <button class="bt ins-btn" data-block="barchart" title="막대 차트">막대</button>
      <button class="bt ins-btn" data-block="linechart" title="꺾은선 차트">꺾은선</button>
      <span style="flex:1"></span>
      <button class="bt" id="draft-reorder-btn" title="인용 순서 재정렬" style="font-size:.52rem">재정렬</button>
      <button class="bt" id="draft-abstract-btn" title="초록 자동 생성" style="font-size:.52rem">초록생성</button>
      <button class="bt" id="draft-figlist-btn" title="그림/표 목록" style="font-size:.52rem">목록</button>
    </div>

    <!-- 편집기 + 프리뷰 2단 레이아웃 -->
    <div style="display:flex;flex:1;overflow:hidden">
      <!-- 편집 패널 -->
      <div style="flex:1;display:flex;flex-direction:column;overflow:hidden">
        <div style="padding:3px 12px;font-size:.56rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;background:var(--surface);border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center">
          <span>EDITOR</span>
          <span style="display:flex;gap:4px;align-items:center">
            <button class="bt" id="draft-find-btn" style="font-size:.5rem;padding:1px 5px" title="찾기/바꾸기 (Ctrl+H)">찾기</button>
          </span>
        </div>
        <!-- 찾기/바꾸기 패널 (기존 findPanel 재현) -->
        <div id="draft-find-panel" style="display:none;padding:4px 12px;background:var(--surface);border-bottom:1px solid var(--line);gap:4px;align-items:center">
          <input id="draft-find-input" type="text" placeholder="찾을 텍스트" style="flex:1;padding:3px 6px;border:1px solid var(--line);border-radius:3px;font-size:.65rem;background:var(--panel);color:var(--text)">
          <input id="draft-replace-input" type="text" placeholder="바꿀 텍스트" style="flex:1;padding:3px 6px;border:1px solid var(--line);border-radius:3px;font-size:.65rem;background:var(--panel);color:var(--text)">
          <label style="font-size:.5rem;display:flex;align-items:center;gap:2px"><input type="checkbox" id="draft-find-regex"> 정규식</label>
          <label style="font-size:.5rem;display:flex;align-items:center;gap:2px"><input type="checkbox" id="draft-find-case"> 대소문자</label>
          <button class="bt" id="draft-find-next" style="font-size:.5rem;padding:1px 5px">다음</button>
          <button class="bt" id="draft-replace-one" style="font-size:.5rem;padding:1px 5px">바꾸기</button>
          <button class="bt" id="draft-replace-all" style="font-size:.5rem;padding:1px 5px">모두</button>
          <button class="bt" id="draft-find-close" style="font-size:.5rem;padding:1px 3px">X</button>
        </div>
        <textarea id="draft-input" style="flex:1;padding:12px;border:none;resize:none;font-size:13px;line-height:1.7;font-family:'JetBrains Mono',monospace;background:var(--panel);color:var(--text);outline:none;tab-size:2"></textarea>
      </div>

      <!-- 구분선 -->
      <div style="width:3px;background:var(--line);cursor:col-resize;flex-shrink:0"></div>

      <!-- 프리뷰 패널 -->
      <div style="flex:1;display:flex;flex-direction:column;overflow:hidden">
        <div style="padding:3px 12px;font-size:.56rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;background:var(--surface);border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center">
          <span>PREVIEW</span>
          <span style="display:flex;gap:4px;align-items:center">
            <button class="bt" id="col1btn" style="font-size:.48rem;padding:1px 4px" title="1단">1단</button>
            <button class="bt" id="col2btn" style="font-size:.48rem;padding:1px 4px" title="2단">2단</button>
            <button class="bt" style="font-size:.48rem;padding:1px 4px" onclick="document.getElementById('draft-preview').style.fontSize=Math.max(50,(_pvZoom=((_pvZoom||100)-10)))/100*.9+'rem'">-</button>
            <button class="bt" style="font-size:.48rem;padding:1px 4px" onclick="document.getElementById('draft-preview').style.fontSize=Math.min(200,(_pvZoom=((_pvZoom||100)+10)))/100*.9+'rem'">+</button>
          </span>
        </div>
        <div id="draft-preview" style="flex:1;padding:28px 36px;overflow-y:auto;overflow-x:hidden;background:#fff;font-family:'Noto Serif KR',Georgia,'Times New Roman',serif;font-size:.9rem;line-height:1.85;color:#1a1a1a;max-width:100%;box-sizing:border-box">
          <p style="color:#999;text-align:center;padding:40px;font-size:.85rem">양식을 선택하거나 직접 작성을 시작하세요</p>
        </div>
      </div>

      <!-- 참고문헌 사이드 패널 -->
      <div id="draft-ref-panel" class="ref-panel" style="width:0;overflow:hidden;transition:width .2s;border-left:1px solid var(--line);background:var(--panel);display:flex;flex-direction:column">
        <div style="padding:6px 8px;font-size:.68rem;font-weight:700;color:var(--brand);border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center">
          <span>참고문헌</span>
          <button class="bt" id="draft-ref-close" style="font-size:.52rem;padding:1px 4px">X</button>
        </div>
        <!-- 검색 -->
        <div style="padding:4px;border-bottom:1px solid var(--line)">
          <div style="display:flex;gap:2px">
            <input id="draft-sch-query" type="text" placeholder="논문 검색..." style="flex:1;padding:3px 6px;border:1px solid var(--line);border-radius:3px;font-size:.6rem;background:var(--panel);color:var(--text)">
            <button class="bt" id="draft-sch-btn" style="font-size:.5rem;padding:2px 5px">검색</button>
          </div>
          <div id="draft-sch-results" style="display:none;max-height:200px;overflow-y:auto;font-size:.6rem"></div>
        </div>
        <!-- 참고문헌 목록 -->
        <div id="draft-ref-list" style="flex:1;overflow-y:auto;padding:4px"></div>
        <!-- 참고문헌 추가 입력 -->
        <div style="display:flex;gap:3px;padding:5px;border-top:1px solid var(--line)">
          <input id="draft-ref-input" type="text" placeholder="참고문헌 직접 입력..." style="flex:1;padding:3px 6px;border:1px solid var(--line);border-radius:3px;font-size:.6rem;background:var(--panel);color:var(--text)">
          <button class="bt" id="draft-ref-add" style="font-size:.52rem;padding:2px 5px;background:var(--brand);color:#fff;border-color:var(--brand)">추가</button>
        </div>
        <!-- BibTeX 임포트 -->
        <div style="padding:3px 5px;border-top:1px solid var(--line)">
          <input type="file" id="draft-bib-import" accept=".bib" style="font-size:.52rem;width:100%">
        </div>
      </div>
    </div>

    <!-- 상태바 -->
    <div id="draft-stats" style="display:flex;gap:10px;padding:3px 12px;font-size:.58rem;color:var(--muted);background:var(--surface);border-top:1px solid var(--line);flex-shrink:0;align-items:center">
      <span><b id="ds-chars">0</b>자 <b id="ds-words">0</b>단어</span>
      <span>섹션:<b id="ds-secs">0</b></span>
      <span>수식:<b id="ds-eqs">0</b></span>
      <span>참고:<b id="ds-refs">0</b></span>
      <span>~<b id="ds-pages">0</b>쪽</span>
      <span style="display:flex;align-items:center;gap:3px">
        <input id="ds-word-target" type="number" placeholder="목표" style="width:50px;padding:1px 3px;border:1px solid var(--line);border-radius:3px;font-size:.55rem;background:var(--panel);color:var(--text)">
        <div style="width:60px;height:6px;background:var(--line);border-radius:3px;overflow:hidden"><div id="ds-target-bar" style="height:100%;width:0;background:var(--brand);transition:width .3s;border-radius:3px"></div></div>
      </span>
      <span style="margin-left:auto"><span class="score" id="ds-quality" style="padding:1px 6px;border-radius:8px;color:#fff;font-size:.55rem">0</span></span>
      <span id="ds-msg" style="color:var(--brand)"></span>
    </div>
  `;
}


/* ═══════════════════════════════════════════
 * 입력 핸들러
 * ═══════════════════════════════════════════ */

function _setupInputHandler() {
  if (!_inputEl) return;

  const handler = () => {
    _state.set('draft.body', _inputEl.value);
    _scheduleRender();
    _updateStats();
    bus.emit(EVT.BODY_CHANGED, { length: _inputEl.value.length });
  };

  _inputEl.addEventListener('input', handler);
  _cleanups.push(() => _inputEl.removeEventListener('input', handler));
}


/* ═══════════════════════════════════════════
 * 키보드 단축키
 *
 * 기존: paper-editor.html line 2026-2061
 * ═══════════════════════════════════════════ */

function _setupKeyboardShortcuts() {
  if (!_inputEl) return;

  const handler = (e) => {
    /* Tab -> 2칸 들여쓰기 */
    if (e.key === 'Tab') { e.preventDefault(); typeText('  '); }

    /* Enter -> 자동 들여쓰기 (목록, 인용 블록 계속) */
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      const pos = _inputEl.selectionStart;
      const before = _inputEl.value.substring(0, pos);
      const lastLine = before.split('\n').pop();
      const indent = lastLine.match(/^((?:\s*>\s*)*\s*(?:[-*+]\s|\d+\.\s)?)/);
      if (indent && indent[1] && indent[1].length > 0) {
        const prefix = indent[1];
        const content = lastLine.substring(prefix.length);
        if (content.trim() === '') return; /* 빈 줄이면 블록 탈출 */
        const numMatch = prefix.match(/^((?:\s*>\s*)*\s*)(\d+)(\.\s)$/);
        if (numMatch) {
          e.preventDefault();
          typeText('\n' + numMatch[1] + (parseInt(numMatch[2]) + 1) + numMatch[3]);
        } else {
          e.preventDefault();
          typeText('\n' + prefix);
        }
      }
    }

    /* Ctrl+B: 볼드 */
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); wrapSelection('**', '**'); }
    /* Ctrl+I: 이탤릭 */
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); wrapSelection('*', '*'); }
    /* Ctrl+K: 링크 */
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); wrapSelection('[', '](url)'); }
    /* Ctrl+M: 인라인 수식 */
    if ((e.ctrlKey || e.metaKey) && e.key === 'm') { e.preventDefault(); wrapSelection('$', '$'); }
    /* Ctrl+H: 찾기/바꾸기 */
    if ((e.ctrlKey || e.metaKey) && e.key === 'h') { e.preventDefault(); _toggleFindPanel(); }
    /* Alt+N: 각주 */
    if (e.altKey && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); insertFootnote(); }
    /* Alt+C: 인용 */
    if (e.altKey && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); _openRefPanel(); }
  };

  _inputEl.addEventListener('keydown', handler);
  _cleanups.push(() => _inputEl.removeEventListener('keydown', handler));
}


/* ═══════════════════════════════════════════
 * 스크롤 동기화
 *
 * 기존: paper-editor.html line 1616-1629
 * ═══════════════════════════════════════════ */

function _setupScrollSync() {
  if (!_inputEl || !_previewEl) return;
  let syncLock = false;

  const syncFromInput = () => {
    if (syncLock) return;
    syncLock = true;
    const ratio = _inputEl.scrollHeight > _inputEl.clientHeight
      ? _inputEl.scrollTop / (_inputEl.scrollHeight - _inputEl.clientHeight) : 0;
    _previewEl.scrollTop = ratio * (_previewEl.scrollHeight - _previewEl.clientHeight);
    setTimeout(() => { syncLock = false; }, 60);
  };

  const syncFromPreview = () => {
    if (syncLock) return;
    syncLock = true;
    const ratio = _previewEl.scrollHeight > _previewEl.clientHeight
      ? _previewEl.scrollTop / (_previewEl.scrollHeight - _previewEl.clientHeight) : 0;
    _inputEl.scrollTop = ratio * (_inputEl.scrollHeight - _inputEl.clientHeight);
    setTimeout(() => { syncLock = false; }, 60);
  };

  _inputEl.addEventListener('scroll', syncFromInput);
  _previewEl.addEventListener('scroll', syncFromPreview);
  _cleanups.push(() => {
    _inputEl.removeEventListener('scroll', syncFromInput);
    _previewEl.removeEventListener('scroll', syncFromPreview);
  });
}


/* ═══════════════════════════════════════════
 * 삽입 바 이벤트
 * ═══════════════════════════════════════════ */

function _setupInsertBarHandlers() {
  /* 블록 삽입 버튼들 */
  document.querySelectorAll('.ins-btn[data-block]').forEach(btn => {
    btn.addEventListener('click', () => insertBlock(btn.dataset.block));
  });

  /* 재정렬 */
  const reorderBtn = document.getElementById('draft-reorder-btn');
  if (reorderBtn) reorderBtn.addEventListener('click', () => {
    const result = reorderCitations(_state);
    _showMsg(result.message);
    if (result.success && _inputEl) {
      _inputEl.value = _state.get('draft.body') || '';
      _scheduleRender();
    }
  });

  /* 초록 생성 */
  const absBtn = document.getElementById('draft-abstract-btn');
  if (absBtn) absBtn.addEventListener('click', () => genAbstract());

  /* 찾기 패널 토글 */
  const findBtn = document.getElementById('draft-find-btn');
  if (findBtn) findBtn.addEventListener('click', _toggleFindPanel);

  /* 찾기 패널 내부 버튼 */
  const findClose = document.getElementById('draft-find-close');
  if (findClose) findClose.addEventListener('click', _toggleFindPanel);
  const findNext = document.getElementById('draft-find-next');
  if (findNext) findNext.addEventListener('click', _findNext);
  const replOne = document.getElementById('draft-replace-one');
  if (replOne) replOne.addEventListener('click', _replaceOne);
  const replAll = document.getElementById('draft-replace-all');
  if (replAll) replAll.addEventListener('click', _replaceAll);
}


/* ═══════════════════════════════════════════
 * 참고문헌 패널
 * ═══════════════════════════════════════════ */

function _setupReferencePanel() {
  const panel = document.getElementById('draft-ref-panel');
  const closeBtn = document.getElementById('draft-ref-close');
  if (closeBtn) closeBtn.addEventListener('click', _closeRefPanel);

  /* 참고문헌 추가 */
  const addBtn = document.getElementById('draft-ref-add');
  if (addBtn) addBtn.addEventListener('click', () => {
    const input = document.getElementById('draft-ref-input');
    const val = input.value.trim();
    if (!val) return;
    const num = addReference(_state, val);
    input.value = '';
    _refreshRefList();
    if (isPendingCite()) completeCiteInsert(_inputEl, num);
    _scheduleRender();
  });

  /* 검색 */
  const schBtn = document.getElementById('draft-sch-btn');
  if (schBtn) schBtn.addEventListener('click', async () => {
    const query = document.getElementById('draft-sch-query').value.trim();
    if (!query) return;
    const resultsEl = document.getElementById('draft-sch-results');
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = '<p style="padding:4px;color:var(--muted)">검색 중...</p>';
    const results = await searchScholar(query);
    resultsEl.innerHTML = '';
    if (!results.length) { resultsEl.innerHTML = '<p style="padding:4px;color:var(--muted)">결과 없음</p>'; return; }
    results.forEach(p => {
      const div = document.createElement('div');
      div.style.cssText = 'padding:4px 6px;border-bottom:1px dotted var(--line);cursor:pointer;font-size:.58rem';
      div.innerHTML = '<b style="color:var(--brand)">' + escHtml(p.title) + '</b><br><span style="color:var(--muted);font-size:.5rem">' + escHtml(p.authors) + ' (' + p.year + ') | 인용:' + p.citationCount + '</span>';
      div.addEventListener('click', () => {
        const num = addReference(_state, p.refText, { source: 'scholar' });
        div.style.opacity = '.5';
        _refreshRefList();
        if (isPendingCite()) completeCiteInsert(_inputEl, num);
        _scheduleRender();
      });
      resultsEl.appendChild(div);
    });
  });

  /* BibTeX 임포트 */
  const bibInput = document.getElementById('draft-bib-import');
  if (bibInput) bibInput.addEventListener('change', async () => {
    const file = bibInput.files[0];
    if (!file) return;
    const count = await importBibTeX(file, _state);
    _showMsg('BibTeX: ' + count + '개 참고문헌 가져옴');
    _refreshRefList();
    _scheduleRender();
    bibInput.value = '';
  });

  /* 초기 목록 렌더링 */
  _refreshRefList();
}

function _refreshRefList() {
  const listEl = document.getElementById('draft-ref-list');
  const refs = _state.get('references') || [];
  renderReferenceList(refs, listEl, {
    onCiteInsert: (num) => {
      if (_inputEl) { _inputEl.focus(); typeText('[cite:' + num + ']'); _inputEl.dispatchEvent(new Event('input')); }
      _showMsg('[cite:' + num + '] 삽입됨');
    },
    onRemove: (idx) => {
      removeReference(_state, idx);
      _refreshRefList();
      _scheduleRender();
    },
  });
}

function _openRefPanel() {
  const panel = document.getElementById('draft-ref-panel');
  if (panel) { panel.style.width = '260px'; if (_inputEl) _handleCiteInsert(_inputEl); }
}

function _closeRefPanel() {
  const panel = document.getElementById('draft-ref-panel');
  if (panel) panel.style.width = '0';
  cancelPendingCite();
}


/* ═══════════════════════════════════════════
 * 텍스트 편집 헬퍼
 *
 * 기존: typeText(2022), replaceAll(2024), wrapSelection(2063)
 * execCommand 사용으로 Ctrl+Z/Y 유지
 * ═══════════════════════════════════════════ */

/** 에디터에 텍스트 삽입 (Undo 가능) */
function typeText(text) {
  if (!_inputEl) return;
  _inputEl.focus();
  document.execCommand('insertText', false, text);
}

/** 에디터 전체 내용 교체 */
function replaceAll(text) {
  if (!_inputEl) return;
  _inputEl.focus();
  _inputEl.select();
  document.execCommand('insertText', false, text);
}

/** 선택 텍스트를 접두사/접미사로 감싸기 */
function wrapSelection(prefix, suffix) {
  if (!_inputEl) return;
  const s = _inputEl.selectionStart, e = _inputEl.selectionEnd;
  const sel = _inputEl.value.substring(s, e);
  _inputEl.focus();
  _inputEl.setSelectionRange(s, e);
  document.execCommand('insertText', false, prefix + sel + suffix);
  _inputEl.dispatchEvent(new Event('input'));
}


/* ═══════════════════════════════════════════
 * 블록 삽입 (30+종)
 *
 * 기존: insertBlock(2113) -- 모든 학술 블록 템플릿
 * ═══════════════════════════════════════════ */

function insertBlock(type) {
  if (type === 'cite') { _openRefPanel(); return; }

  const T = {
    sec: '## [Section Title]\n\n',
    subsec: '### [Subsection Title]\n\n',
    eq: '\n$$\n\n$$\n\n',
    thm: ':::theorem [Name]\n[Formal statement of the theorem.]\n:::\n\n',
    lem: ':::lemma [Name]\n[Statement of the lemma.]\n:::\n\n',
    def: ':::definition [Term]\n[Formal definition.]\n:::\n\n',
    proof: ':::proof\n[Proof content.]\n:::\n\n',
    algo: ':::algorithm [Name]\nInput: [description]\nOutput: [description]\n1. [Step]\n2. [Step]\n3. Return [result]\n:::\n\n',
    fig: '![Alt text](/assets/img/papers/figure.pdf)\n*Fig. N. [Caption describing what the figure shows.]*\n\n',
    tbl: '*Table N. [Caption describing what the table compares.]*\n| Column A | Column B | Column C |\n|----------|----------|----------|\n|  |  |  |\n\n',
    code: '```python\n# code\n```\n',
    fn: '[^1]\n\n[^1]: [각주 내용]\n',
    threat: '### Threat Model\n\n**Assets**\n- [What needs protection]\n\n**Adversary**\n- **Goal:** [objective]\n- **Access:** [black-box / white-box]\n- **Capabilities:** [what the adversary can do]\n\n**Assumptions**\n- [assumption 1]\n\n',
    eval: '*Table N. Evaluation results.*\n| Method | Metric A | Metric B | Overhead |\n|--------|----------|----------|----------|\n| Baseline | | | |\n| Proposed | | | |\n\n',
    framework: '*Table N. Framework mapping.*\n| Finding | Framework | ID | Notes |\n|---------|-----------|-----|-------|\n| | | | |\n\n',
    arch: '```mermaid\ngraph LR\n  A[Input] --> B[Processing]\n  B --> C[Security Check]\n  C --> D[Output]\n```\n*Fig. N. [Architecture overview.]*\n\n',
    flowchart: '```mermaid\nsequenceDiagram\n    participant C as Client\n    participant S as Server\n    C->>S: Request\n    S->>C: Response\n```\n*Fig. N. [Protocol flow.]*\n\n',
    barchart: '```mermaid\nxychart-beta\n    title "Comparison"\n    x-axis ["A", "B", "C", "Ours"]\n    y-axis "Accuracy (%)" 0 --> 100\n    bar [75, 82, 78, 94]\n```\n*Fig. N. [Results comparison.]*\n\n',
    linechart: '```mermaid\nxychart-beta\n    title "Convergence"\n    x-axis "Epoch" [1, 5, 10, 15, 20]\n    y-axis "Loss" 0 --> 2.0\n    line [1.8, 1.2, 0.8, 0.5, 0.2]\n```\n*Fig. N. [Training convergence.]*\n\n',
    perf: '*Table N. Performance comparison.*\n| Method | Accuracy | Precision | Recall | F1 | Latency (ms) |\n|--------|----------|-----------|--------|-----|-------------|\n| A | | | | | |\n| B | | | | | |\n\n',
    subfig: '```figgrid caption="Fig. N. [Caption]" cols=2\n![A](figures/a.png){sub="a" cap="[A]"}\n![B](figures/b.png){sub="b" cap="[B]"}\n```\n\n',
    ethics: '### Ethics and Responsible Disclosure\n\n- **Dual-use considerations:**\n- **Data / human subjects:**\n- **Responsible disclosure:**\n- **Compliance:** [ISO 27001 / IRB / other]\n\n',
  };

  typeText(T[type] || '');
  if (_inputEl) _inputEl.dispatchEvent(new Event('input'));
}


/* ═══════════════════════════════════════════
 * 각주 삽입
 *
 * 기존: insertFootnote(2067)
 * ═══════════════════════════════════════════ */

function insertFootnote() {
  if (!_inputEl) return;
  const existing = (_inputEl.value.match(/\[\^\d+\]/g) || []);
  const nums = existing.map(m => parseInt(m.match(/\d+/)[0]));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  typeText('[^' + next + ']');
  const pos = _inputEl.value.length;
  _inputEl.setSelectionRange(pos, pos);
  typeText('\n\n[^' + next + ']: ');
}


/* ═══════════════════════════════════════════
 * 찾기/바꾸기
 *
 * 기존: toggleFindPanel(2223), findNext(2234), replaceOne(2249), replaceAllFind(2257)
 * ═══════════════════════════════════════════ */

function _toggleFindPanel() {
  const fp = document.getElementById('draft-find-panel');
  if (!fp) return;
  fp.style.display = fp.style.display === 'none' ? 'flex' : 'none';
  if (fp.style.display !== 'none') document.getElementById('draft-find-input').focus();
}

function _buildFindRegex() {
  const query = document.getElementById('draft-find-input').value;
  if (!query) return null;
  const isRegex = document.getElementById('draft-find-regex').checked;
  const caseSensitive = document.getElementById('draft-find-case').checked;
  const flags = 'g' + (caseSensitive ? '' : 'i');
  try {
    return new RegExp(isRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
  } catch { return null; }
}

function _findNext() {
  if (!_inputEl) return;
  const re = _buildFindRegex();
  if (!re) return;
  const text = _inputEl.value;
  re.lastIndex = _inputEl.selectionEnd;
  let m = re.exec(text);
  if (!m) { re.lastIndex = 0; m = re.exec(text); }
  if (m) {
    _inputEl.focus();
    _inputEl.setSelectionRange(m.index, m.index + m[0].length);
    _showMsg('찾음: ' + m.index);
  } else {
    _showMsg('찾을 수 없음');
  }
}

function _replaceOne() {
  if (!_inputEl) return;
  const re = _buildFindRegex();
  if (!re) return;
  const replacement = document.getElementById('draft-replace-input').value;
  const s = _inputEl.selectionStart, e = _inputEl.selectionEnd;
  if (s === e) { _findNext(); return; }
  const sel = _inputEl.value.substring(s, e);
  if (re.test(sel)) {
    _inputEl.focus();
    _inputEl.setSelectionRange(s, e);
    document.execCommand('insertText', false, sel.replace(re, replacement));
    _inputEl.dispatchEvent(new Event('input'));
  }
  _findNext();
}

function _replaceAll() {
  if (!_inputEl) return;
  const re = _buildFindRegex();
  if (!re) return;
  const replacement = document.getElementById('draft-replace-input').value;
  const count = (_inputEl.value.match(re) || []).length;
  replaceAll(_inputEl.value.replace(re, replacement));
  _inputEl.dispatchEvent(new Event('input'));
  _showMsg(count + '건 바꿈');
}


/* ═══════════════════════════════════════════
 * 렌더링 스케줄링
 * ═══════════════════════════════════════════ */

function _scheduleRender() {
  clearTimeout(_renderTimer);
  const body = _inputEl ? _inputEl.value : '';
  const delay = getDebounceMs(body.length);
  _renderTimer = setTimeout(() => _doRender(body), delay);
}

function _doRender(body) {
  if (!_previewEl) return;
  const token = ++_renderToken;
  const paper = _state.getAll();

  const ctx = createRenderContext({
    citeStyle: paper.draft?.editorSettings?.citeStyle || 'numeric',
    blindMode: paper.draft?.submissionOptions?.blindMode || false,
    references: (paper.references || []).map(r => typeof r === 'string' ? r : r.raw || ''),
    meta: paper.meta || {},
    nameMap: paper.nameMap || {},
    correspondingAuthors: paper.meta?.corresponding ? [paper.meta.corresponding] : [],
    venueTemplate: paper.meta?.venueTemplate || '',
    phase: 'draft',
  });

  renderDraft(body, _previewEl, ctx, token);
}


/* ═══════════════════════════════════════════
 * 통계 업데이트
 *
 * 기존: updateStats(2704)
 * ═══════════════════════════════════════════ */

function _updateStats() {
  const body = _inputEl ? _inputEl.value : '';
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const sections = (body.match(/^##\s/gm) || []).length;
  const eqs = Math.floor((body.match(/\$\$/g) || []).length / 2);
  const refs = (_state.get('references') || []).length;
  const pages = estimatePages(words, body, _state.get('meta.venueTemplate') || '');

  _setText('ds-chars', body.length);
  _setText('ds-words', words);
  _setText('ds-secs', sections);
  _setText('ds-eqs', eqs);
  _setText('ds-refs', refs);
  _setText('ds-pages', Math.max(1, pages));

  /* 품질 점수 (기존 에디터와 동일한 로직) */
  let sc = 0;
  sc += Math.min(sections * 3, 18);
  sc += Math.min(Math.floor(words / 80), 18);
  sc += (eqs > 0 ? 8 : 0) + (refs > 0 ? 8 : 0);
  sc += (/:::(theorem|definition|algorithm)/m.test(body) ? 6 : 0);
  sc += (sections >= 5 ? 6 : 0) + (/\[cite:\d+\]/m.test(body) ? 6 : 0);
  sc += (/threat|위협/i.test(body) ? 8 : 0);
  sc += (/ethic|disclosure|윤리/i.test(body) ? 6 : 0);
  sc += (/\*Table|\*표/m.test(body) ? 6 : 0);
  sc += (/\*Fig|\*그림/m.test(body) ? 5 : 0);
  sc = Math.min(sc, 100);

  const qEl = document.getElementById('ds-quality');
  if (qEl) {
    qEl.textContent = sc;
    qEl.style.background = sc >= 75 ? 'var(--brand)' : sc >= 50 ? 'var(--accent)' : '#b42318';
  }

  /* 목표 단어수 진행률 */
  _updateWordTarget(words);
}

function _updateWordTarget(currentWords) {
  const targetEl = document.getElementById('ds-word-target');
  const barEl = document.getElementById('ds-target-bar');
  if (!targetEl || !barEl) return;
  const target = parseInt(targetEl.value) || 0;
  if (target > 0) {
    barEl.style.width = Math.min(100, Math.round(currentWords / target * 100)) + '%';
  }
}


/* ═══════════════════════════════════════════
 * 초록 자동 생성
 *
 * 기존: genAbstract(3012), parseSections(2971),
 *       splitSentences(2980), matchSection(2989),
 *       scoreSentence(2997), getBestSentence(3006)
 * ═══════════════════════════════════════════ */

function genAbstract() {
  if (!_inputEl) return;
  const text = _inputEl.value;
  if (!text.trim()) { _showMsg('본문이 없습니다.'); return; }

  const secs = parseSections(text);
  const parts = [];

  /* 각 표준 섹션에서 대표 문장 추출 */
  const targets = [
    { aliases: ['introduction', '서론', 'background'], prefix: '' },
    { aliases: ['method', '방법', 'approach', 'methodology'], prefix: '' },
    { aliases: ['result', '결과', 'experiment', 'evaluation'], prefix: '' },
    { aliases: ['discussion', '논의', 'analysis'], prefix: '' },
    { aliases: ['conclusion', '결론'], prefix: '' },
  ];

  for (const t of targets) {
    const sec = secs.find(s => t.aliases.some(a => s.title.toLowerCase().includes(a)));
    if (sec) {
      const best = getBestSentence(sec.body);
      if (best) parts.push(best);
    }
  }

  if (!parts.length) { _showMsg('섹션을 인식할 수 없습니다.'); return; }

  const abstract = parts.join(' ');
  _state.set('meta.abstract', abstract);
  _showMsg('초록 생성됨 (' + abstract.split(/\s+/).length + '단어)');
}

function parseSections(text) {
  const result = [];
  const parts = text.split(/^(##\s+.+)$/gm);
  let curTitle = '';
  for (const part of parts) {
    if (/^##\s+/.test(part)) { curTitle = part.replace(/^##\s+/, '').trim(); }
    else if (curTitle) { result.push({ title: curTitle, body: part.trim() }); }
  }
  return result;
}

function splitSentences(text) {
  return text.split(/(?<=[.!?])\s+/).filter(s => s.length > 10);
}

function getBestSentence(text, n = 2) {
  const sentences = splitSentences(text);
  if (!sentences.length) return '';
  const scored = sentences.map(s => ({ s, score: scoreSentence(s) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, n).map(x => x.s).join(' ');
}

function scoreSentence(s) {
  let score = 0;
  if (/\d+%/.test(s)) score += 3;       /* 정량적 주장 */
  if (/\d+\.\d+/.test(s)) score += 2;   /* 수치 */
  if (s.length > 50 && s.length < 200) score += 2; /* 적절한 길이 */
  if (/propose|present|show|demonstrate|제안|보여|증명/.test(s)) score += 3; /* 핵심 동사 */
  if (/however|but|although|그러나|하지만/.test(s)) score += 1; /* 대조 */
  return score;
}


/* ═══════════════════════════════════════════
 * 유틸리티
 * ═══════════════════════════════════════════ */

function _setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function _showMsg(msg) {
  const el = document.getElementById('ds-msg');
  if (el) { el.textContent = msg; setTimeout(() => { el.textContent = ''; }, 3000); }
}
