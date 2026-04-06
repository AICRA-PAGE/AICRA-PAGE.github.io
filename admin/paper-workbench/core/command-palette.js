/**
 * command-palette.js -- Ctrl+K 범용 명령 팔레트
 *
 * 80+ 함수를 Phase 경계 없이 검색/실행하는 중앙 허브.
 * 한국어 + 영어 이중 퍼지 검색. 최근 명령 10개 localStorage 저장.
 * 슬래시 명령 ('/') 입력 시에도 동일 레지스트리 사용.
 */

import { bus, EVT } from './event-bus.js';

/* ══════════════════════════════════════════
 * Feature Registry -- 모든 명령의 단일 목록
 * ══════════════════════════════════════════ */

const _commands = [];
let _state = null;
let _bus = null;
let _router = null;
let _overlayEl = null;
let _inputEl = null;
let _listEl = null;
let _selectedIdx = -1;
let _filtered = [];
let _visible = false;

const RECENT_KEY = 'aicra.workbench.recentCmds';
const MAX_RECENT = 10;

/* ── 기본 명령 등록 ── */
const DEFAULT_COMMANDS = [
  /* Research */
  { id:'research.search', nameKo:'논문 검색', nameEn:'Search Papers', phase:'research', tags:['search','scholar','find','검색'] },
  { id:'research.queryMatrix', nameKo:'쿼리 확장', nameEn:'Expand Queries', phase:'research', tags:['query','expand','확장'] },
  { id:'research.addManual', nameKo:'수동 논문 추가', nameEn:'Add Paper Manually', phase:'research', tags:['add','manual','추가'] },
  { id:'research.matrix', nameKo:'비교 매트릭스', nameEn:'Literature Matrix', phase:'research', tags:['compare','matrix','비교','매트릭스'] },
  { id:'research.gaps', nameKo:'연구 갭 분석', nameEn:'Gap Analysis', phase:'research', tags:['gap','analysis','갭'] },
  { id:'research.rq', nameKo:'연구 질문 추가', nameEn:'Add Research Question', phase:'research', tags:['rq','question','질문'] },
  { id:'research.relevance', nameKo:'관련성 순위', nameEn:'Relevance Ranking', phase:'research', tags:['relevance','rank','순위'] },
  { id:'research.exportLR', nameKo:'Related Work 초안', nameEn:'Export Literature Review', phase:'research', tags:['export','related','literature','관련연구'] },
  /* Plan */
  { id:'plan.autoOutline', nameKo:'아웃라인 자동 생성', nameEn:'Auto Generate Outline', phase:'plan', tags:['outline','auto','아웃라인'] },
  { id:'plan.addSection', nameKo:'섹션 추가', nameEn:'Add Section', phase:'plan', tags:['section','add','섹션'] },
  { id:'plan.addArgument', nameKo:'논증 추가 (Toulmin)', nameEn:'Add Argument', phase:'plan', tags:['argument','toulmin','논증'] },
  { id:'plan.experiment', nameKo:'실험 설계 매트릭스', nameEn:'Experiment Design', phase:'plan', tags:['experiment','design','실험'] },
  { id:'plan.milestones', nameKo:'일정 역산', nameEn:'Calculate Milestones', phase:'plan', tags:['milestone','schedule','일정'] },
  { id:'plan.estimate', nameKo:'분량 예측', nameEn:'Estimate Scope', phase:'plan', tags:['estimate','scope','pages','분량'] },
  { id:'plan.validate', nameKo:'계획 완성도 검증', nameEn:'Validate Plan', phase:'plan', tags:['validate','completeness','검증'] },
  { id:'plan.export', nameKo:'계획서 내보내기', nameEn:'Export Plan', phase:'plan', tags:['export','plan','내보내기'] },
  /* Draft */
  { id:'draft.bold', nameKo:'굵게', nameEn:'Bold', phase:'draft', shortcut:'Ctrl+B', tags:['format','bold','굵게'] },
  { id:'draft.italic', nameKo:'기울임', nameEn:'Italic', phase:'draft', shortcut:'Ctrl+I', tags:['format','italic','기울임'] },
  { id:'draft.heading', nameKo:'제목 삽입', nameEn:'Insert Heading', phase:'draft', tags:['heading','section','제목'] },
  { id:'draft.footnote', nameKo:'각주 삽입', nameEn:'Insert Footnote', phase:'draft', tags:['footnote','note','각주'] },
  { id:'draft.cite', nameKo:'인용 삽입', nameEn:'Insert Citation', phase:'draft', tags:['cite','reference','인용'] },
  { id:'draft.table', nameKo:'표 삽입', nameEn:'Insert Table', phase:'draft', tags:['table','insert','표'] },
  { id:'draft.figure', nameKo:'그림 삽입', nameEn:'Insert Figure', phase:'draft', tags:['figure','image','그림'] },
  { id:'draft.equation', nameKo:'수식 삽입', nameEn:'Insert Equation', phase:'draft', shortcut:'Ctrl+M', tags:['equation','math','수식'] },
  { id:'draft.codeblock', nameKo:'코드 블록', nameEn:'Code Block', phase:'draft', tags:['code','block','코드'] },
  { id:'draft.find', nameKo:'찾기/바꾸기', nameEn:'Find & Replace', phase:'draft', shortcut:'Ctrl+H', tags:['find','replace','search','찾기','바꾸기'] },
  { id:'draft.wordTarget', nameKo:'목표 단어수 설정', nameEn:'Set Word Target', phase:'draft', tags:['word','target','count','단어수'] },
  { id:'draft.twoColumn', nameKo:'2단 레이아웃', nameEn:'Two Column Layout', phase:'draft', tags:['column','layout','two','2단'] },
  { id:'draft.zoomIn', nameKo:'프리뷰 확대', nameEn:'Zoom In Preview', phase:'draft', tags:['zoom','in','preview','확대'] },
  { id:'draft.zoomOut', nameKo:'프리뷰 축소', nameEn:'Zoom Out Preview', phase:'draft', tags:['zoom','out','preview','축소'] },
  /* Refine */
  { id:'refine.claims', nameKo:'주장-근거 검증', nameEn:'Verify Claims', phase:'refine', tags:['claims','verify','evidence','주장','검증'] },
  { id:'refine.argument', nameKo:'논증 흐름 분석', nameEn:'Argument Flow', phase:'refine', tags:['argument','flow','logic','논증'] },
  { id:'refine.statistics', nameKo:'통계 검증', nameEn:'Audit Statistics', phase:'refine', tags:['statistics','pvalue','audit','통계'] },
  { id:'refine.readability', nameKo:'가독성 분석', nameEn:'Readability Score', phase:'refine', tags:['readability','score','가독성'] },
  { id:'refine.reproducibility', nameKo:'재현성 체크리스트', nameEn:'Reproducibility Checklist', phase:'refine', tags:['reproducibility','checklist','재현성'] },
  { id:'refine.definitions', nameKo:'용어 일관성 검사', nameEn:'Definition Drift', phase:'refine', tags:['definition','consistency','terms','용어'] },
  { id:'refine.coverage', nameKo:'근거 밀도 분석', nameEn:'Evidence Coverage', phase:'refine', tags:['evidence','coverage','density','근거'] },
  { id:'refine.figureRefs', nameKo:'그림/표 참조 검사', nameEn:'Figure/Table Ref Check', phase:'refine', tags:['figure','table','reference','참조'] },
  { id:'refine.anonymization', nameKo:'익명성 린트', nameEn:'Anonymization Lint', phase:'refine', tags:['anonymization','blind','lint','익명'] },
  { id:'refine.report', nameKo:'검증 종합 보고서', nameEn:'Validation Report', phase:'refine', tags:['report','validation','summary','보고서'] },
  /* Review */
  { id:'review.simulate', nameKo:'심사 시뮬레이션', nameEn:'Simulate Review', phase:'review', tags:['review','simulate','peer','심사'] },
  { id:'review.cluster', nameKo:'의견 군집화', nameEn:'Cluster Comments', phase:'review', tags:['cluster','comments','군집'] },
  { id:'review.priority', nameKo:'수정 우선순위', nameEn:'Revision Priority', phase:'review', tags:['revision','priority','우선순위'] },
  { id:'review.mapComments', nameKo:'의견-섹션 매핑', nameEn:'Map Comments', phase:'review', tags:['map','comments','sections','매핑'] },
  { id:'review.rebuttal', nameKo:'반박문 생성', nameEn:'Draft Rebuttal', phase:'review', tags:['rebuttal','response','반박'] },
  { id:'review.responseDoc', nameKo:'심사응답서', nameEn:'Response Document', phase:'review', tags:['response','document','응답서'] },
  { id:'review.addComment', nameKo:'심사 의견 입력', nameEn:'Add Review Comment', phase:'review', tags:['add','comment','review','의견'] },
  { id:'review.diff', nameKo:'수정 이력 비교', nameEn:'Diff Highlights', phase:'review', tags:['diff','revision','track','이력'] },
  { id:'review.saveVersion', nameKo:'버전 저장', nameEn:'Save Version', phase:'review', tags:['version','snapshot','save','버전'] },
  /* Submit */
  { id:'submit.preflight', nameKo:'투고 규격 체크', nameEn:'Submission Preflight', phase:'submit', tags:['preflight','check','submission','투고'] },
  { id:'submit.blindCheck', nameKo:'블라인드 검증', nameEn:'Blind Check', phase:'submit', tags:['blind','anonymous','블라인드'] },
  { id:'submit.coverLetter', nameKo:'커버레터 생성', nameEn:'Cover Letter', phase:'submit', tags:['cover','letter','커버레터'] },
  { id:'submit.venueRecommend', nameKo:'학회 추천', nameEn:'Recommend Venues', phase:'submit', tags:['venue','recommend','journal','학회'] },
  { id:'submit.ethics', nameKo:'윤리 체크리스트', nameEn:'Ethics Checklist', phase:'submit', tags:['ethics','checklist','윤리'] },
  { id:'submit.credit', nameKo:'CRediT 기여도', nameEn:'CRediT Contributions', phase:'submit', tags:['credit','contribution','author','기여도'] },
  { id:'submit.exportMD', nameKo:'Markdown 내보내기', nameEn:'Export Markdown', phase:'submit', tags:['export','markdown','md'] },
  { id:'submit.exportTeX', nameKo:'LaTeX 내보내기', nameEn:'Export LaTeX', phase:'submit', tags:['export','latex','tex'] },
  { id:'submit.exportAll', nameKo:'전체 내보내기', nameEn:'Export All', phase:'submit', tags:['export','all','전체'] },
  /* Post-pub */
  { id:'postpub.citations', nameKo:'피인용 추적', nameEn:'Track Citations', phase:'postpub', tags:['citation','track','doi','피인용'] },
  { id:'postpub.slides', nameKo:'발표 슬라이드', nameEn:'Slide Outline', phase:'postpub', tags:['slides','presentation','발표'] },
  { id:'postpub.poster', nameKo:'포스터 레이아웃', nameEn:'Poster Layout', phase:'postpub', tags:['poster','layout','포스터'] },
  { id:'postpub.followup', nameKo:'후속 연구 아이디어', nameEn:'Follow-up Ideas', phase:'postpub', tags:['followup','idea','next','후속'] },
  { id:'postpub.media', nameKo:'홍보 링크', nameEn:'Media Links', phase:'postpub', tags:['media','link','press','홍보'] },
  { id:'postpub.dashboard', nameKo:'영향력 대시보드', nameEn:'Impact Dashboard', phase:'postpub', tags:['impact','dashboard','영향력'] },
  /* Global */
  { id:'global.save', nameKo:'저장', nameEn:'Save', phase:null, shortcut:'Ctrl+S', tags:['save','저장'] },
  { id:'global.saveAs', nameKo:'다른이름저장', nameEn:'Save As', phase:null, tags:['save','as','rename','다른이름'] },
  { id:'global.load', nameKo:'불러오기', nameEn:'Load Document', phase:null, tags:['load','open','불러오기'] },
  { id:'global.darkMode', nameKo:'다크 모드', nameEn:'Toggle Dark Mode', phase:null, tags:['dark','theme','mode','다크'] },
  { id:'global.abstract', nameKo:'초록 생성', nameEn:'Generate Abstract', phase:null, tags:['abstract','generate','초록'] },
  { id:'global.templates', nameKo:'템플릿 선택', nameEn:'Choose Template', phase:null, tags:['template','start','템플릿'] },
];

/* Phase 한국어 라벨 매핑 */
const PHASE_LABELS = {
  research: '조사', plan: '설계', draft: '집필',
  refine: '검증', review: '심사', submit: '투고', postpub: '출판후',
};
const PHASE_COLORS = {
  research: '#2196F3', plan: '#9C27B0', draft: '#2E7D32',
  refine: '#E65100', review: '#C62828', submit: '#1565C0', postpub: '#546E7A',
};


/* ══════════════════════════════════════════
 * 퍼지 검색 -- 한국어+영어 이중 매칭
 * ══════════════════════════════════════════ */

function _fuzzyScore(query, cmd) {
  if (!query) return 1;
  const q = query.toLowerCase();
  const targets = [
    cmd.nameKo, cmd.nameEn, cmd.id,
    ...(cmd.tags || []),
    cmd.shortcut || '',
  ].map(s => (s || '').toLowerCase());

  let best = 0;
  for (const t of targets) {
    if (t === q) return 100;            /* 정확히 일치 */
    if (t.startsWith(q)) best = Math.max(best, 80);
    else if (t.includes(q)) best = Math.max(best, 60);
    else {
      /* 부분 문자 매칭 (퍼지) */
      let qi = 0;
      for (let ti = 0; ti < t.length && qi < q.length; ti++) {
        if (t[ti] === q[qi]) qi++;
      }
      if (qi === q.length) best = Math.max(best, 30 + (qi / t.length) * 20);
    }
  }
  return best;
}

function _search(query) {
  const scored = _commands
    .map(cmd => ({ cmd, score: _fuzzyScore(query, cmd) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.map(s => s.cmd);
}


/* ══════════════════════════════════════════
 * 최근 명령 관리
 * ══════════════════════════════════════════ */

function _loadRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').slice(0, MAX_RECENT);
  } catch { return []; }
}

function _saveRecent(cmdId) {
  const recent = _loadRecent().filter(r => r !== cmdId);
  recent.unshift(cmdId);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}


/* ══════════════════════════════════════════
 * DOM 생성 + 렌더링
 * ══════════════════════════════════════════ */

function _createOverlay() {
  if (_overlayEl) return;

  _overlayEl = document.createElement('div');
  _overlayEl.id = 'cmd-palette-overlay';
  _overlayEl.style.cssText = 'display:none;position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.35);align-items:flex-start;justify-content:center;padding-top:15vh';
  _overlayEl.addEventListener('click', (e) => { if (e.target === _overlayEl) hidePalette(); });

  const box = document.createElement('div');
  box.style.cssText = 'width:90%;max-width:560px;background:var(--panel);border:1px solid var(--line);border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.2);overflow:hidden;display:flex;flex-direction:column;max-height:60vh;animation:cmdIn .12s ease-out';

  /* 검색 입력 */
  _inputEl = document.createElement('input');
  _inputEl.type = 'text';
  _inputEl.placeholder = '명령 검색... (한/영)';
  _inputEl.style.cssText = 'width:100%;padding:12px 16px;border:none;border-bottom:1px solid var(--line);font-size:.82rem;background:var(--panel);color:var(--text);outline:none;font-family:inherit';
  _inputEl.addEventListener('input', () => { _selectedIdx = 0; _render(_inputEl.value); });
  _inputEl.addEventListener('keydown', _handleKey);

  /* 결과 목록 */
  _listEl = document.createElement('div');
  _listEl.style.cssText = 'overflow-y:auto;flex:1';

  box.appendChild(_inputEl);
  box.appendChild(_listEl);
  _overlayEl.appendChild(box);
  document.body.appendChild(_overlayEl);

  /* 애니메이션 CSS */
  if (!document.getElementById('cmd-palette-style')) {
    const style = document.createElement('style');
    style.id = 'cmd-palette-style';
    style.textContent = '@keyframes cmdIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}';
    document.head.appendChild(style);
  }
}

function _render(query) {
  if (!_listEl) return;

  const q = (query || '').trim();
  _filtered = q ? _search(q) : _getDefaultList();

  _listEl.innerHTML = '';

  if (!_filtered.length) {
    _listEl.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:.72rem">검색 결과 없음</div>';
    return;
  }

  /* 그룹 라벨 (검색어 없을 때만) */
  let lastGroup = '';
  _filtered.forEach((cmd, i) => {
    const group = !q ? (cmd._group || '') : '';
    if (group && group !== lastGroup) {
      lastGroup = group;
      const lbl = document.createElement('div');
      lbl.style.cssText = 'padding:4px 16px;font-size:.58rem;font-weight:700;color:var(--muted);background:var(--surface);text-transform:uppercase';
      lbl.textContent = group;
      _listEl.appendChild(lbl);
    }

    const row = document.createElement('div');
    row.dataset.idx = i;
    const isSelected = i === _selectedIdx;
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 16px;cursor:pointer;font-size:.72rem;transition:background .1s' +
      (isSelected ? ';background:rgba(47,93,80,.1)' : '');
    row.addEventListener('click', () => _execute(cmd));
    row.addEventListener('mouseenter', () => { _selectedIdx = i; _highlightSelected(); });

    /* Phase 배지 */
    if (cmd.phase) {
      const badge = document.createElement('span');
      badge.style.cssText = 'padding:1px 5px;border-radius:3px;font-size:.5rem;font-weight:700;color:#fff;background:' + (PHASE_COLORS[cmd.phase] || 'var(--muted)');
      badge.textContent = PHASE_LABELS[cmd.phase] || cmd.phase;
      row.appendChild(badge);
    }

    /* 명령 이름 */
    const name = document.createElement('span');
    name.style.cssText = 'flex:1;color:var(--text)';
    name.innerHTML = _esc(cmd.nameKo) + ' <span style="color:var(--muted);font-size:.62rem">' + _esc(cmd.nameEn) + '</span>';
    row.appendChild(name);

    /* 단축키 */
    if (cmd.shortcut) {
      const sc = document.createElement('span');
      sc.style.cssText = 'padding:1px 5px;border-radius:3px;font-size:.52rem;background:var(--surface);color:var(--muted);border:1px solid var(--line);font-family:monospace';
      sc.textContent = cmd.shortcut;
      row.appendChild(sc);
    }

    _listEl.appendChild(row);
  });
}

function _getDefaultList() {
  /* 최근 명령 + 현재 Phase 명령 */
  const recentIds = _loadRecent();
  const recentCmds = recentIds.map(id => _commands.find(c => c.id === id)).filter(Boolean);
  recentCmds.forEach(c => { c._group = 'Recent'; });

  const currentPhase = _router ? _router.getCurrentPhase() : 'draft';
  const phaseCmds = _commands.filter(c => c.phase === currentPhase && !recentIds.includes(c.id));
  phaseCmds.forEach(c => { c._group = PHASE_LABELS[currentPhase] || currentPhase; });

  const globalCmds = _commands.filter(c => !c.phase && !recentIds.includes(c.id));
  globalCmds.forEach(c => { c._group = 'Global'; });

  return [...recentCmds, ...phaseCmds, ...globalCmds];
}

function _highlightSelected() {
  if (!_listEl) return;
  _listEl.querySelectorAll('[data-idx]').forEach((el, i) => {
    el.style.background = parseInt(el.dataset.idx) === _selectedIdx ? 'rgba(47,93,80,.1)' : '';
  });
  /* 스크롤 */
  const sel = _listEl.querySelector(`[data-idx="${_selectedIdx}"]`);
  if (sel) sel.scrollIntoView({ block: 'nearest' });
}


/* ══════════════════════════════════════════
 * 키보드 핸들러
 * ══════════════════════════════════════════ */

function _handleKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); hidePalette(); return; }
  if (e.key === 'ArrowDown') { e.preventDefault(); _selectedIdx = Math.min(_selectedIdx + 1, _filtered.length - 1); _highlightSelected(); return; }
  if (e.key === 'ArrowUp') { e.preventDefault(); _selectedIdx = Math.max(_selectedIdx - 1, 0); _highlightSelected(); return; }
  if (e.key === 'Enter') {
    e.preventDefault();
    if (_filtered[_selectedIdx]) _execute(_filtered[_selectedIdx]);
    return;
  }
}


/* ══════════════════════════════════════════
 * 명령 실행
 * ══════════════════════════════════════════ */

function _execute(cmd) {
  hidePalette();
  _saveRecent(cmd.id);

  /* Phase 전환이 필요한 경우 */
  if (cmd.phase && _router && _router.getCurrentPhase() !== cmd.phase) {
    _router.navigateTo(cmd.phase).then(() => {
      bus.emit(EVT.CMD_EXECUTED, { commandId: cmd.id, phase: cmd.phase });
    });
  } else {
    bus.emit(EVT.CMD_EXECUTED, { commandId: cmd.id, phase: cmd.phase });
  }

  /* action 함수가 있으면 직접 실행 */
  if (typeof cmd.action === 'function') {
    try { cmd.action(); } catch (err) { console.error('[CommandPalette] action error:', err); }
  }
}

function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }


/* ══════════════════════════════════════════
 * Public API
 * ══════════════════════════════════════════ */

export function initCommandPalette(state, eventBus, router) {
  _state = state;
  _bus = eventBus;
  _router = router;
  _createOverlay();

  /* 기본 명령 등록 */
  registerCommands(DEFAULT_COMMANDS);

  /* global.save, global.darkMode 등에 action 연결 */
  const saveCmd = _commands.find(c => c.id === 'global.save');
  if (saveCmd) saveCmd.action = () => { if (window.app) window.app.save(); };
  const darkCmd = _commands.find(c => c.id === 'global.darkMode');
  if (darkCmd) darkCmd.action = () => { if (window.app) window.app.toggleDark(); };
  const tplCmd = _commands.find(c => c.id === 'global.templates');
  if (tplCmd) tplCmd.action = () => { if (window.showTemplateChooser) window.showTemplateChooser(); };
}

export function showPalette() {
  if (!_overlayEl) _createOverlay();
  _visible = true;
  _overlayEl.style.display = 'flex';
  _inputEl.value = '';
  _selectedIdx = 0;
  _render('');
  setTimeout(() => _inputEl.focus(), 50);
  bus.emit(EVT.CMD_PALETTE_OPEN, {});
}

export function hidePalette() {
  if (!_overlayEl) return;
  _visible = false;
  _overlayEl.style.display = 'none';
  _inputEl.value = '';
  bus.emit(EVT.CMD_PALETTE_CLOSE, {});
}

export function registerCommands(commands) {
  for (const cmd of commands) {
    if (!_commands.find(c => c.id === cmd.id)) {
      _commands.push(cmd);
    }
  }
}

/**
 * handleSlashInput -- 에디터 textarea에서 '/' 입력 시 호출
 * @param {string} query - '/' 이후 입력된 문자열
 */
export function handleSlashInput(query) {
  if (!_overlayEl) _createOverlay();
  _visible = true;
  _overlayEl.style.display = 'flex';
  _inputEl.value = query || '';
  _selectedIdx = 0;
  _render(query || '');
  setTimeout(() => _inputEl.focus(), 50);
}
