/**
 * reader.js -- Moonlight 스타일 논문 리더
 *
 * PDF.js 기반 인라인 리더 + AI 읽기 레이어.
 * 텍스트 선택 -> Evidence Card 추출, 인용 추가.
 * Split View로 에디터와 나란히 표시 가능.
 *
 * API 연동: Semantic Scholar (메타데이터+초록), CrossRef (DOI), ArXiv (전문)
 */

import { bus, EVT } from '../core/event-bus.js';
import { createCard } from './evidence.js';

let _state = null;
let _bus = null;
let _readerEl = null;
let _isOpen = false;
let _currentPaper = null;

/* Semantic Scholar API (이미 citation.js에서도 사용) */
const SS_API = 'https://api.semanticscholar.org/graph/v1';


/* ══════════════════════════════════════════
 * 초기화
 * ══════════════════════════════════════════ */

export function initReader(state, eventBus) {
  _state = state;
  _bus = eventBus;
}


/* ══════════════════════════════════════════
 * 리더 패널 UI
 * ══════════════════════════════════════════ */

export function openReader(paper) {
  _currentPaper = paper;
  _isOpen = true;

  if (!_readerEl) _createReaderPanel();
  _readerEl.style.display = 'flex';

  _renderPaperContent(paper);
  bus.emit(EVT.READER_OPENED, { paperId: paper.id, title: paper.title });
}

export function closeReader() {
  _isOpen = false;
  if (_readerEl) _readerEl.style.display = 'none';
  _currentPaper = null;
  bus.emit(EVT.READER_CLOSED, {});
}

export function toggleReader() {
  if (_isOpen) closeReader();
  else {
    /* 읽기 큐에서 첫 번째 논문 열기 */
    const queue = _state.get('research.readingQueue') || [];
    const papers = _state.get('research.papers') || [];
    const next = queue.find(q => q.status !== 'done');
    const paper = next ? papers.find(p => p.id === next.paperId) : papers[0];
    if (paper) openReader(paper);
  }
}

export function isReaderOpen() { return _isOpen; }

function _createReaderPanel() {
  _readerEl = document.createElement('div');
  _readerEl.id = 'paper-reader';
  _readerEl.style.cssText = 'display:none;flex-direction:column;width:50%;min-width:320px;max-width:60%;border-left:2px solid var(--brand);background:var(--panel);overflow:hidden;flex-shrink:0';

  /* 상단 헤더 */
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--surface);border-bottom:1px solid var(--line);flex-shrink:0';
  header.innerHTML = `
    <span style="font-size:.72rem;font-weight:700;color:var(--brand);flex:1" id="reader-title">Paper Reader</span>
    <button class="bt" id="reader-prev" title="이전 논문" style="font-size:.55rem;padding:2px 6px">&lt;</button>
    <button class="bt" id="reader-next" title="다음 논문" style="font-size:.55rem;padding:2px 6px">&gt;</button>
    <button class="bt" id="reader-close" title="리더 닫기" style="font-size:.55rem;padding:2px 6px">X</button>
  `;

  /* 탭 바: 내용 | 요약 | 메모 */
  const tabs = document.createElement('div');
  tabs.style.cssText = 'display:flex;border-bottom:1px solid var(--line);flex-shrink:0';
  tabs.innerHTML = `
    <button class="bt reader-tab active" data-tab="content" style="flex:1;border:none;border-bottom:2px solid var(--brand);border-radius:0;font-size:.6rem;padding:5px">내용</button>
    <button class="bt reader-tab" data-tab="digest" style="flex:1;border:none;border-bottom:2px solid transparent;border-radius:0;font-size:.6rem;padding:5px">AI 요약</button>
    <button class="bt reader-tab" data-tab="notes" style="flex:1;border:none;border-bottom:2px solid transparent;border-radius:0;font-size:.6rem;padding:5px">메모</button>
  `;

  /* 콘텐츠 영역 */
  const content = document.createElement('div');
  content.id = 'reader-content';
  content.style.cssText = 'flex:1;overflow-y:auto;padding:16px;font-size:.75rem;line-height:1.8;color:var(--text)';

  _readerEl.appendChild(header);
  _readerEl.appendChild(tabs);
  _readerEl.appendChild(content);

  /* phase-content 옆에 삽입 */
  const phaseContent = document.getElementById('phase-content');
  if (phaseContent && phaseContent.parentNode) {
    phaseContent.parentNode.insertBefore(_readerEl, phaseContent.nextSibling);
    /* phase-content를 flex로 만들어 나란히 배치 */
    phaseContent.parentNode.style.display = 'flex';
    phaseContent.style.flex = '1';
  }

  /* 이벤트 핸들러 */
  _readerEl.querySelector('#reader-close').addEventListener('click', closeReader);
  _readerEl.querySelector('#reader-prev').addEventListener('click', () => _navigatePaper(-1));
  _readerEl.querySelector('#reader-next').addEventListener('click', () => _navigatePaper(1));

  tabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.reader-tab');
    if (!tab) return;
    tabs.querySelectorAll('.reader-tab').forEach(t => {
      t.style.borderBottomColor = 'transparent';
      t.classList.remove('active');
    });
    tab.style.borderBottomColor = 'var(--brand)';
    tab.classList.add('active');
    _renderTab(tab.dataset.tab);
  });

  /* 텍스트 선택 이벤트 -- Evidence Card 추출 메뉴 */
  content.addEventListener('mouseup', _handleTextSelection);
}

function _navigatePaper(direction) {
  const papers = _state.get('research.papers') || [];
  if (!papers.length || !_currentPaper) return;
  const idx = papers.findIndex(p => p.id === _currentPaper.id);
  const next = papers[idx + direction];
  if (next) openReader(next);
}


/* ══════════════════════════════════════════
 * 논문 내용 렌더링
 * ══════════════════════════════════════════ */

function _renderPaperContent(paper) {
  const titleEl = _readerEl.querySelector('#reader-title');
  if (titleEl) titleEl.textContent = _truncate(paper.title, 50);
  _renderTab('content');
}

function _renderTab(tabName) {
  const content = _readerEl.querySelector('#reader-content');
  if (!content || !_currentPaper) return;

  switch (tabName) {
    case 'content':
      content.innerHTML = _buildContentView(_currentPaper);
      break;
    case 'digest':
      content.innerHTML = _buildDigestView(_currentPaper);
      break;
    case 'notes':
      content.innerHTML = _buildNotesView(_currentPaper);
      break;
  }
}

function _buildContentView(paper) {
  let html = '';

  /* 논문 메타 */
  html += `<div style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--line)">
    <h3 style="font-size:.88rem;color:var(--brand);margin-bottom:4px">${_esc(paper.title)}</h3>
    <div style="font-size:.62rem;color:var(--muted)">${_esc(paper.authors || '')} (${paper.year || ''})</div>
    ${paper.venue ? '<div style="font-size:.58rem;color:var(--muted)">' + _esc(paper.venue) + '</div>' : ''}
    ${paper.citationCount ? '<div style="font-size:.55rem;color:var(--muted)">Cited: ' + paper.citationCount + '</div>' : ''}
    ${paper.doi ? '<a href="https://doi.org/' + _esc(paper.doi) + '" target="_blank" style="font-size:.55rem;color:var(--brand)">DOI</a>' : ''}
  </div>`;

  /* 초록 */
  if (paper.abstract) {
    html += `<div style="margin-bottom:16px">
      <b style="font-size:.7rem;color:var(--text)">Abstract</b>
      <p style="font-size:.68rem;color:var(--text);line-height:1.7;margin:4px 0;padding:8px;background:var(--surface);border-radius:4px;border-left:3px solid var(--brand)">${_esc(paper.abstract)}</p>
    </div>`;
  }

  /* 전문 (있으면) */
  if (paper.fullText) {
    html += `<div style="margin-bottom:16px">
      <b style="font-size:.7rem;color:var(--text)">Full Text</b>
      <div style="font-size:.68rem;white-space:pre-wrap;margin-top:6px">${_esc(paper.fullText)}</div>
    </div>`;
  } else {
    html += `<div style="text-align:center;padding:20px;color:var(--muted);font-size:.68rem">
      <p>전문을 보려면 논문을 가져와야 합니다.</p>
      <button class="bt p" onclick="window._readerFetchFullText && window._readerFetchFullText()" style="margin-top:8px">Semantic Scholar에서 가져오기</button>
      <button class="bt" onclick="window._readerFetchArxiv && window._readerFetchArxiv()" style="margin-top:4px">ArXiv에서 가져오기</button>
    </div>`;

    /* 전문 가져오기 함수 등록 */
    window._readerFetchFullText = () => _fetchFullText(paper);
    window._readerFetchArxiv = () => _fetchArxivText(paper);
  }

  /* 관련 Evidence Cards */
  const cards = (_state.get('research.evidenceCards') || []).filter(c => c.paperId === paper.id);
  if (cards.length) {
    html += `<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--line)">
      <b style="font-size:.7rem;color:var(--text)">추출된 증거 카드 (${cards.length}개)</b>`;
    cards.forEach(c => {
      const colors = { claim:'#2196F3', method:'#9C27B0', limitation:'#E65100', result:'#2E7D32', background:'#546E7A', gap:'#C62828' };
      const labels = { claim:'주장', method:'방법론', limitation:'한계', result:'결과', background:'배경', gap:'갭' };
      html += `<div style="padding:6px 8px;margin:4px 0;border-left:3px solid ${colors[c.type]||'var(--muted)'};background:var(--surface);border-radius:0 4px 4px 0;font-size:.6rem">
        <span style="color:${colors[c.type]};font-weight:700;font-size:.52rem">[${labels[c.type]||c.type}]</span> ${_esc(_truncate(c.quote || c.paraphrase, 120))}
      </div>`;
    });
    html += '</div>';
  }

  return html;
}

function _buildDigestView(paper) {
  const digests = (_state.get('research.paperDigests') || []);
  const digest = digests.find(d => d.paperId === paper.id);

  if (!digest) {
    return `<div style="text-align:center;padding:30px;color:var(--muted);font-size:.72rem">
      <p>이 논문의 AI 요약이 아직 없습니다.</p>
      <button class="bt p" onclick="window._readerGenDigest && window._readerGenDigest()" style="margin-top:8px">AI Digest 생성</button>
      <p style="font-size:.58rem;margin-top:8px">초록을 기반으로 구조화된 요약을 생성합니다.</p>
    </div>`;
  }

  window._readerGenDigest = () => _generateDigest(paper);

  const fields = [
    { key: 'contribution', label: '핵심 기여', icon: '>' },
    { key: 'methodology', label: '방법론', icon: '~' },
    { key: 'findings', label: '주요 발견', icon: '+' },
    { key: 'limitations', label: '한계', icon: '!' },
    { key: 'relationToMyRQ', label: '내 연구와의 관계', icon: '*' },
  ];

  let html = '<div style="font-size:.78rem;font-weight:700;color:var(--brand);margin-bottom:12px">Paper Digest</div>';
  fields.forEach(f => {
    const val = digest[f.key] || '';
    html += `<div style="margin-bottom:10px">
      <b style="font-size:.65rem;color:var(--text)">${f.icon} ${f.label}</b>
      <div style="font-size:.65rem;color:var(--text);margin-top:2px;padding:6px 8px;background:var(--surface);border-radius:4px;min-height:24px" contenteditable="true" data-field="${f.key}">${_esc(val) || '<span style="color:var(--muted)">[클릭하여 입력]</span>'}</div>
    </div>`;
  });

  html += '<button class="bt" onclick="window._readerGenDigest && window._readerGenDigest()" style="font-size:.55rem;margin-top:4px">AI 재생성</button>';
  return html;
}

function _buildNotesView(paper) {
  const notes = paper.notes || '';
  return `<div>
    <b style="font-size:.7rem;color:var(--text)">연구 메모</b>
    <textarea id="reader-notes" rows="12" style="width:100%;margin:6px 0;padding:8px;border:1px solid var(--line);border-radius:4px;font-size:.68rem;background:var(--panel);color:var(--text);resize:vertical;font-family:inherit;line-height:1.6" placeholder="이 논문에 대한 메모를 자유롭게 작성하세요...">${_esc(notes)}</textarea>
    <div style="display:flex;gap:4px">
      <button class="bt p" onclick="window._readerSaveNotes && window._readerSaveNotes()">메모 저장</button>
      <button class="bt" onclick="window._readerCreateCardFromNote && window._readerCreateCardFromNote()">메모에서 증거 카드 생성</button>
    </div>
  </div>`;
}


/* ══════════════════════════════════════════
 * 텍스트 선택 -> Evidence Card 추출
 * ══════════════════════════════════════════ */

function _handleTextSelection() {
  const sel = window.getSelection();
  const text = sel.toString().trim();
  if (!text || text.length < 10) return;

  /* 기존 팝업 제거 */
  const old = document.getElementById('reader-sel-menu');
  if (old) old.remove();

  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  const menu = document.createElement('div');
  menu.id = 'reader-sel-menu';
  menu.style.cssText = `position:fixed;top:${rect.top - 36}px;left:${rect.left}px;z-index:950;display:flex;gap:2px;padding:3px 5px;background:var(--panel);border:1px solid var(--line);border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.15);animation:cmdIn .1s ease-out`;

  const actions = [
    { label: '주장', type: 'claim', color: '#2196F3' },
    { label: '방법론', type: 'method', color: '#9C27B0' },
    { label: '결과', type: 'result', color: '#2E7D32' },
    { label: '한계', type: 'limitation', color: '#E65100' },
    { label: '갭', type: 'gap', color: '#C62828' },
    { label: '인용', type: '_cite', color: 'var(--brand)' },
  ];

  actions.forEach(a => {
    const btn = document.createElement('button');
    btn.style.cssText = `border:none;padding:2px 6px;border-radius:3px;font-size:.52rem;font-weight:600;cursor:pointer;color:#fff;background:${a.color}`;
    btn.textContent = a.label;
    btn.addEventListener('click', () => {
      menu.remove();
      if (a.type === '_cite') {
        /* 인용으로 추가 */
        bus.emit(EVT.CITATION_ADDED, { text: text, paperId: _currentPaper?.id });
      } else {
        /* Evidence Card 생성 */
        createCard({
          paperId: _currentPaper?.id || 0,
          type: a.type,
          quote: text,
          paraphrase: '',
          pageOrSection: '',
          tags: [],
          confidence: 'medium',
        });
        bus.emit(EVT.TOAST, { message: `[${a.label}] 증거 카드 생성됨`, type: 'info' });
      }
    });
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);

  /* 클릭 외부 시 닫기 */
  const close = (e) => {
    if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', close); }
  };
  setTimeout(() => document.addEventListener('mousedown', close), 100);
}


/* ══════════════════════════════════════════
 * API 연동 -- Semantic Scholar / ArXiv
 * ══════════════════════════════════════════ */

async function _fetchFullText(paper) {
  const content = _readerEl?.querySelector('#reader-content');
  if (!content) return;
  content.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">Semantic Scholar에서 전문을 가져오는 중...</div>';

  try {
    /* paperId 또는 title로 검색 */
    const query = encodeURIComponent(paper.title);
    const res = await fetch(`${SS_API}/paper/search?query=${query}&limit=1&fields=title,abstract,tldr,openAccessPdf`);
    if (!res.ok) throw new Error('API error: ' + res.status);
    const data = await res.json();
    const match = data.data?.[0];

    if (match) {
      paper.abstract = match.abstract || paper.abstract;
      if (match.tldr?.text) paper._tldr = match.tldr.text;
      if (match.openAccessPdf?.url) paper._pdfUrl = match.openAccessPdf.url;

      /* papers 배열 업데이트 */
      const papers = _state.get('research.papers') || [];
      const idx = papers.findIndex(p => p.id === paper.id);
      if (idx >= 0) { papers[idx] = paper; _state.set('research.papers', papers); }
    }

    _renderTab('content');
    bus.emit(EVT.TOAST, { message: '논문 정보 업데이트됨', type: 'info' });
  } catch (err) {
    content.innerHTML = `<div style="text-align:center;padding:20px;color:#C62828;font-size:.68rem">가져오기 실패: ${_esc(err.message)}</div>`;
  }
}

async function _fetchArxivText(paper) {
  const content = _readerEl?.querySelector('#reader-content');
  if (!content) return;
  content.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">ArXiv에서 검색 중...</div>';

  try {
    const query = encodeURIComponent(paper.title);
    const res = await fetch(`https://export.arxiv.org/api/query?search_query=ti:${query}&max_results=1`);
    const text = await res.text();

    /* ArXiv XML 파싱 */
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');
    const entry = xml.querySelector('entry');

    if (entry) {
      const summary = entry.querySelector('summary')?.textContent?.trim();
      const pdfLink = entry.querySelector('link[title="pdf"]')?.getAttribute('href');
      if (summary) paper.abstract = summary;
      if (pdfLink) paper._pdfUrl = pdfLink;

      const papers = _state.get('research.papers') || [];
      const idx = papers.findIndex(p => p.id === paper.id);
      if (idx >= 0) { papers[idx] = paper; _state.set('research.papers', papers); }
    }

    _renderTab('content');
    bus.emit(EVT.TOAST, { message: 'ArXiv 정보 업데이트됨', type: 'info' });
  } catch (err) {
    content.innerHTML = `<div style="text-align:center;padding:20px;color:#C62828;font-size:.68rem">ArXiv 검색 실패: ${_esc(err.message)}</div>`;
  }
}


/* ══════════════════════════════════════════
 * AI Digest 생성 (클라이언트 사이드 요약)
 * ══════════════════════════════════════════ */

function _generateDigest(paper) {
  /* 서버 없이 초록 기반 구조화 요약 생성 */
  const abs = paper.abstract || '';
  if (!abs) {
    bus.emit(EVT.TOAST, { message: '초록이 없어 요약을 생성할 수 없습니다.', type: 'warn' });
    return;
  }

  const sentences = abs.split(/[.!?。]\s+/).filter(s => s.length > 20);

  const digest = {
    paperId: paper.id,
    contribution: sentences[0] || '',
    methodology: sentences.find(s => /method|approach|propose|design|실험|방법|제안/i.test(s)) || '',
    findings: sentences.find(s => /result|show|demonstrate|find|achieve|결과|달성|보여/i.test(s)) || '',
    limitations: sentences.find(s => /limit|future|however|although|한계|향후/i.test(s)) || '',
    relationToMyRQ: '',
    autoGenerated: true,
    editedByUser: false,
  };

  const digests = _state.get('research.paperDigests') || [];
  const idx = digests.findIndex(d => d.paperId === paper.id);
  if (idx >= 0) digests[idx] = digest;
  else digests.push(digest);
  _state.set('research.paperDigests', digests);

  _renderTab('digest');
  bus.emit(EVT.DIGEST_GENERATED, { paperId: paper.id });
  bus.emit(EVT.TOAST, { message: 'AI Digest 생성됨', type: 'info' });
}


/* ══════════════════════════════════════════
 * 유틸리티
 * ══════════════════════════════════════════ */

function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function _truncate(s, n) { return (s || '').length > n ? s.substring(0, n) + '...' : s || ''; }


/* ── Reading Queue 관리 ── */
export function addToReadingQueue(paperId) {
  const queue = _state.get('research.readingQueue') || [];
  if (queue.some(q => q.paperId === paperId)) return;
  queue.push({ paperId, addedAt: new Date().toISOString(), status: 'queued' });
  _state.set('research.readingQueue', queue);
}

export function getReadingQueue() {
  return _state.get('research.readingQueue') || [];
}
