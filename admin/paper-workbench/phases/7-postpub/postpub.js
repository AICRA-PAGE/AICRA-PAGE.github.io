/**
 * postpub.js -- Phase 7: 출판 후 (완전 구현)
 *
 * Claude+Codex 합의 함수:
 *  1. trackCitationsByDoi()     -- Semantic Scholar DOI 검색으로 피인용 추적
 *  2. updateCitationTimeline()  -- 피인용 시계열 데이터 관리
 *  3. generateSlideOutline()    -- 발표용 슬라이드 구조 생성
 *  4. generatePosterLayout()    -- 포스터 레이아웃 명세
 *  5. manageFollowupIdeas()     -- 후속 연구 아이디어 관리
 *  6. trackMediaLinks()         -- 홍보/언론 링크 추적
 *  7. buildImpactDashboard()    -- 영향력 대시보드
 *  8. exportImpactReport()      -- 영향력 보고서 내보내기
 */

import { bus, EVT } from '../../core/event-bus.js';
import { escHtml } from '../../shared/ui.js';

let _state = null;
let _bus = null;

export function init(state, b) { _state = state; _bus = b; }

export function activate() {
  const el = document.getElementById('phase-content');
  if (!el) return;
  el.innerHTML = _buildUI();
  _setupHandlers();
}

export function deactivate() {}

export function getStatus() {
  const pp = _state.get('postpub') || {};
  const hasDoi = (pp.doi || '').length > 0;
  const cites = pp.citationCount || 0;
  const ideas = (pp.followUpIdeas || []).length;
  return { progress: hasDoi ? 60 + Math.min(40, cites) : 0, summary: hasDoi ? `DOI 등록, ${cites}회 인용, ${ideas}개 아이디어` : '미게재' };
}

function _buildUI() {
  const pp = _state.get('postpub') || {};
  const meta = _state.get('meta') || {};

  return `
    <div style="display:flex;height:100%;overflow:hidden">
      <!-- 좌측 -->
      <div style="width:280px;border-right:1px solid var(--line);overflow-y:auto;padding:12px;background:var(--surface);flex-shrink:0">
        <h2 style="font-size:.88rem;color:var(--brand);margin-bottom:12px">출판 후</h2>

        <!-- DOI 입력 -->
        <div style="margin-bottom:12px">
          <b style="font-size:.68rem;color:var(--text)">게재 정보</b>
          <input id="pp-doi" type="text" value="${escHtml(pp.doi || '')}" placeholder="DOI (10.xxxx/xxxxx)" style="width:100%;margin:4px 0;padding:5px;border:1px solid var(--line);border-radius:4px;font-size:.68rem;background:var(--panel);color:var(--text)">
          <input id="pp-url" type="text" value="${escHtml(pp.publishedUrl || '')}" placeholder="게재 URL" style="width:100%;margin:2px 0;padding:5px;border:1px solid var(--line);border-radius:4px;font-size:.68rem;background:var(--panel);color:var(--text)">
          <button class="bt pp-action" data-action="saveDoi" style="width:100%;margin-top:4px">게재 정보 저장</button>
        </div>

        <!-- 도구 -->
        <div style="display:flex;flex-direction:column;gap:4px">
          <button class="bt p pp-action" data-action="trackCitations">피인용 추적</button>
          <button class="bt pp-action" data-action="slides">발표 슬라이드 구조</button>
          <button class="bt pp-action" data-action="poster">포스터 레이아웃</button>
          <button class="bt pp-action" data-action="addIdea">후속 연구 아이디어 추가</button>
          <button class="bt pp-action" data-action="addMedia">홍보 링크 추가</button>
          <button class="bt pp-action" data-action="dashboard">영향력 대시보드</button>
          <button class="bt pp-action" data-action="exportReport">영향력 보고서 내보내기</button>
        </div>
      </div>

      <!-- 우측 -->
      <div id="pp-results" style="flex:1;overflow-y:auto;padding:20px 24px;background:var(--bg)">
        ${_buildDashboard(pp, meta)}
      </div>
    </div>
  `;
}

function _setupHandlers() {
  document.querySelectorAll('.pp-action[data-action]').forEach(btn => {
    btn.addEventListener('click', () => _handleAction(btn.dataset.action));
  });
}

function _handleAction(action) {
  switch (action) {
    case 'saveDoi': _saveDoi(); break;
    case 'trackCitations': _trackCitations(); break;
    case 'slides': _show(_generateSlideOutline()); break;
    case 'poster': _show(_generatePosterLayout()); break;
    case 'addIdea': _addFollowupIdea(); break;
    case 'addMedia': _addMediaLink(); break;
    case 'dashboard': _show(_buildDashboard(_state.get('postpub') || {}, _state.get('meta') || {})); break;
    case 'exportReport': _exportImpactReport(); break;
  }
}


/* ═══════════════════════════════════════════
 * 함수 1-2: 피인용 추적
 * ═══════════════════════════════════════════ */

function _saveDoi() {
  const doi = document.getElementById('pp-doi').value.trim();
  const url = document.getElementById('pp-url').value.trim();
  _state.set('postpub.doi', doi);
  _state.set('postpub.publishedUrl', url);
  if (doi) _state.set('meta.status', 'published');
  _show('<div style="color:var(--brand);font-size:.78rem;text-align:center;padding:20px">[+] 게재 정보 저장됨</div>');
}

async function _trackCitations() {
  const doi = _state.get('postpub.doi');
  if (!doi) { _show('<p style="color:#b42318;font-size:.72rem">DOI를 먼저 입력하세요.</p>'); return; }

  _show('<p style="color:var(--muted);font-size:.72rem;text-align:center;padding:20px">Semantic Scholar API 조회 중...</p>');

  try {
    /* Semantic Scholar Paper Lookup by DOI */
    const res = await fetch('https://api.semanticscholar.org/graph/v1/paper/DOI:' + encodeURIComponent(doi) + '?fields=citationCount,influentialCitationCount,citations.title,citations.authors,citations.year,citations.venue');

    if (!res.ok) throw new Error('API ' + res.status);
    const data = await res.json();

    const citationCount = data.citationCount || 0;
    const influential = data.influentialCitationCount || 0;
    const citations = (data.citations || []).slice(0, 50);

    /* 상태 업데이트 */
    _state.set('postpub.citationCount', citationCount);

    /* 타임라인에 현재 시점 추가 */
    const history = _state.get('postpub.citationHistory') || [];
    const today = new Date().toISOString().split('T')[0];
    if (!history.some(h => h.date === today)) {
      history.push({ date: today, count: citationCount });
      _state.set('postpub.citationHistory', history);
    }

    /* 결과 표시 */
    let html = '<div style="text-align:center;padding:12px;border-bottom:2px solid var(--brand);margin-bottom:12px">';
    html += '<div style="font-size:2rem;font-weight:700;color:var(--brand)">' + citationCount + '</div>';
    html += '<div style="font-size:.72rem;color:var(--muted)">총 피인용 횟수 (Influential: ' + influential + ')</div>';
    html += '<div style="font-size:.6rem;color:var(--muted);margin-top:4px">DOI: ' + escHtml(doi) + ' | 조회: ' + today + '</div>';
    html += '</div>';

    /* 피인용 타임라인 */
    if (history.length > 1) {
      html += '<div style="font-size:.72rem;font-weight:700;color:var(--text);margin:8px 0 6px">피인용 추이</div>';
      html += '<div style="display:flex;align-items:end;gap:4px;height:80px;padding:4px 0">';
      const maxCount = Math.max(...history.map(h => h.count), 1);
      history.forEach(h => {
        const pct = Math.round(h.count / maxCount * 100);
        html += '<div style="flex:1;display:flex;flex-direction:column;align-items:center">';
        html += '<div style="background:var(--brand);width:100%;height:' + pct + '%;min-height:2px;border-radius:2px 2px 0 0"></div>';
        html += '<div style="font-size:.45rem;color:var(--muted);margin-top:2px">' + h.date.substring(5) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    /* 인용 논문 목록 */
    if (citations.length) {
      html += '<div style="font-size:.72rem;font-weight:700;color:var(--text);margin:12px 0 6px">인용 논문 (' + citations.length + '편)</div>';
      citations.slice(0, 20).forEach(c => {
        const authors = (c.authors || []).map(a => a.name).join(', ');
        html += '<div style="font-size:.6rem;padding:4px 8px;border:1px solid var(--line);border-radius:4px;margin:3px 0;background:var(--panel)">';
        html += '<b style="color:var(--brand)">' + escHtml(c.title || '') + '</b>';
        html += '<br><span style="color:var(--muted);font-size:.52rem">' + escHtml(authors).substring(0, 60) + ' (' + (c.year || '') + ') ' + escHtml(c.venue || '') + '</span>';
        html += '</div>';
      });
    }

    _show(html);

  } catch (err) {
    _show('<p style="color:#b42318;font-size:.72rem">피인용 조회 실패: ' + escHtml(err.message) + '</p><p style="font-size:.62rem;color:var(--muted)">DOI가 정확한지 확인하세요. Semantic Scholar에 등록되지 않은 논문일 수 있습니다.</p>');
  }
}


/* ═══════════════════════════════════════════
 * 함수 3: 발표 슬라이드 구조
 * ═══════════════════════════════════════════ */

function _generateSlideOutline() {
  const body = _state.get('draft.body') || '';
  const meta = _state.get('meta') || {};
  const rqs = _state.get('research.researchQuestions') || [];

  /* 섹션 파싱 */
  const sections = [];
  body.split(/^(##\s+.+)$/gm).forEach(part => {
    if (/^##\s+/.test(part)) sections.push({ title: part.replace(/^##\s+/, '').trim(), body: '' });
    else if (sections.length) sections[sections.length - 1].body = part.trim();
  });

  /* 슬라이드 구조 생성 */
  const slides = [];

  /* 1. 타이틀 슬라이드 */
  slides.push({ title: meta.title || 'Title', bullets: [meta.firstAuthor || '', meta.affiliation || ''], notes: '자기소개 + 감사인사' });

  /* 2. 연구 동기 */
  slides.push({ title: 'Motivation', bullets: rqs.length ? rqs.map(r => r.text) : ['연구 배경과 동기를 설명'], notes: '청중의 관심을 끌어야 함' });

  /* 3-N. 각 섹션별 슬라이드 */
  sections.forEach(s => {
    if (/introduction|서론/i.test(s.title)) return; /* 이미 motivation에 포함 */
    const sentences = s.body.split(/[.!?]\s+/).filter(s => s.length > 20).slice(0, 4);
    slides.push({ title: s.title, bullets: sentences.length ? sentences.map(s => s.substring(0, 80)) : ['핵심 내용 요약'], notes: '' });
  });

  /* N+1. 결론 + Q&A */
  slides.push({ title: 'Conclusion & Future Work', bullets: ['주요 기여 요약', '한계점', '향후 연구 방향'], notes: '' });
  slides.push({ title: 'Q&A', bullets: ['Thank you!'], notes: '예상 질문 준비' });

  let html = '<div style="font-size:.82rem;font-weight:700;color:var(--brand);margin-bottom:8px">발표 슬라이드 구조 (' + slides.length + '슬라이드)</div>';
  html += '<p style="font-size:.62rem;color:var(--muted);margin-bottom:8px">약 ' + (slides.length * 2) + '분 분량 (슬라이드당 2분)</p>';

  slides.forEach((s, i) => {
    html += '<div style="padding:8px 12px;border:1px solid var(--line);border-radius:6px;margin:4px 0;background:var(--panel)">';
    html += '<div style="font-size:.7rem;font-weight:700;color:var(--brand)">Slide ' + (i + 1) + ': ' + escHtml(s.title) + '</div>';
    s.bullets.forEach(b => { html += '<div style="font-size:.6rem;padding-left:12px;color:var(--text)">- ' + escHtml(b) + '</div>'; });
    if (s.notes) html += '<div style="font-size:.52rem;color:var(--muted);font-style:italic;margin-top:2px">Speaker note: ' + escHtml(s.notes) + '</div>';
    html += '</div>';
  });

  return html;
}


/* ═══════════════════════════════════════════
 * 함수 4: 포스터 레이아웃
 * ═══════════════════════════════════════════ */

function _generatePosterLayout() {
  const meta = _state.get('meta') || {};
  const body = _state.get('draft.body') || '';
  const figs = (body.match(/!\[/g) || []).length;
  const tables = (body.match(/\*Table/g) || []).length;

  const panels = [
    { id: 'header', label: 'Header (제목 + 저자 + 소속)', width: '100%', height: '10%', priority: 1 },
    { id: 'intro', label: 'Introduction / Motivation', width: '33%', height: '30%', priority: 2 },
    { id: 'method', label: 'Methodology', width: '33%', height: '30%', priority: 2 },
    { id: 'results', label: 'Results (그림 ' + figs + '개, 표 ' + tables + '개)', width: '33%', height: '30%', priority: 1 },
    { id: 'key-fig', label: 'Key Figure / Diagram', width: '50%', height: '25%', priority: 1 },
    { id: 'conclusion', label: 'Conclusion + Contact', width: '50%', height: '25%', priority: 2 },
    { id: 'refs', label: 'References (QR Code)', width: '100%', height: '5%', priority: 3 },
  ];

  let html = '<div style="font-size:.82rem;font-weight:700;color:var(--brand);margin-bottom:8px">포스터 레이아웃 (A0)</div>';
  html += '<p style="font-size:.62rem;color:var(--muted);margin-bottom:8px">' + panels.length + '개 패널, 그림 ' + figs + '개, 표 ' + tables + '개 포함 가능</p>';

  /* 시각적 레이아웃 */
  html += '<div style="border:2px solid var(--brand);border-radius:8px;padding:8px;background:var(--panel);aspect-ratio:707/1000;max-width:400px;display:flex;flex-direction:column;gap:4px">';
  panels.forEach(p => {
    const bg = p.priority === 1 ? 'rgba(47,93,80,.1)' : p.priority === 2 ? 'rgba(47,93,80,.05)' : 'var(--surface)';
    html += '<div style="background:' + bg + ';border:1px dashed var(--line);border-radius:4px;padding:6px;text-align:center;font-size:.58rem;color:var(--brand);font-weight:600;flex:' + (p.height === '5%' ? '0.5' : p.height === '10%' ? '1' : '3') + '">' + p.label + '</div>';
  });
  html += '</div>';

  /* 패널 목록 */
  html += '<div style="margin-top:12px">';
  panels.forEach(p => {
    html += '<div style="font-size:.62rem;padding:2px 0"><b>' + p.id + '</b>: ' + p.label + ' (' + p.width + ' x ' + p.height + ')</div>';
  });
  html += '</div>';

  return html;
}


/* ═══════════════════════════════════════════
 * 함수 5-6: 후속 연구 + 홍보 링크
 * ═══════════════════════════════════════════ */

function _addFollowupIdea() {
  const desc = prompt('후속 연구 아이디어:');
  if (!desc) return;
  const priority = prompt('우선순위 (high/medium/low):', 'medium') || 'medium';

  const ideas = _state.get('postpub.followUpIdeas') || [];
  ideas.push({ description: desc, priority, linkedFinding: '', createdAt: new Date().toISOString() });
  _state.set('postpub.followUpIdeas', ideas);
  activate();
}

function _addMediaLink() {
  const url = prompt('홍보/언론 링크 URL:');
  if (!url) return;
  const type = prompt('유형 (blog/news/talk/code/social):', 'blog') || 'blog';

  const links = _state.get('postpub.mediaLinks') || [];
  links.push({ type, url, date: new Date().toISOString().split('T')[0] });
  _state.set('postpub.mediaLinks', links);
  activate();
}


/* ═══════════════════════════════════════════
 * 함수 7: 영향력 대시보드
 * ═══════════════════════════════════════════ */

function _buildDashboard(pp, meta) {
  const ideas = pp.followUpIdeas || [];
  const media = pp.mediaLinks || [];
  const history = pp.citationHistory || [];

  let html = '<div style="font-size:.82rem;font-weight:700;color:var(--brand);margin-bottom:12px">출판 후 현황</div>';

  /* 카드 */
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">';
  html += _card('피인용', (pp.citationCount || 0) + '회');
  html += _card('추적 기록', history.length + '회');
  html += _card('후속 연구', ideas.length + '개');
  html += _card('홍보 링크', media.length + '개');
  html += '</div>';

  /* DOI 상태 */
  if (pp.doi) {
    html += '<div style="font-size:.65rem;padding:6px 10px;background:var(--panel);border:1px solid var(--line);border-radius:4px;margin-bottom:12px">';
    html += '<b>DOI:</b> ' + escHtml(pp.doi);
    if (pp.publishedUrl) html += ' | <a href="' + escHtml(pp.publishedUrl) + '" target="_blank" style="color:var(--brand)">게재 페이지</a>';
    html += '</div>';
  }

  /* 후속 연구 아이디어 */
  if (ideas.length) {
    html += '<div style="font-size:.72rem;font-weight:700;color:var(--text);margin:12px 0 6px">후속 연구 아이디어</div>';
    ideas.forEach(idea => {
      const color = idea.priority === 'high' ? '#b42318' : idea.priority === 'medium' ? 'var(--accent)' : 'var(--muted)';
      html += '<div style="font-size:.62rem;padding:4px 8px;border-left:3px solid ' + color + ';margin:3px 0;background:var(--panel)">' + escHtml(idea.description) + ' <span style="font-size:.52rem;color:var(--muted)">[' + idea.priority + ']</span></div>';
    });
  }

  /* 홍보 링크 */
  if (media.length) {
    html += '<div style="font-size:.72rem;font-weight:700;color:var(--text);margin:12px 0 6px">홍보 링크</div>';
    media.forEach(m => {
      html += '<div style="font-size:.62rem;padding:2px 0"><span style="color:var(--brand);font-weight:600">[' + m.type + ']</span> <a href="' + escHtml(m.url) + '" target="_blank" style="color:var(--text)">' + escHtml(m.url.substring(0, 60)) + '</a> <span style="color:var(--muted);font-size:.5rem">' + m.date + '</span></div>';
    });
  }

  if (!pp.doi && !ideas.length) {
    html += '<p style="color:var(--muted);font-size:.72rem;text-align:center;padding:20px">DOI를 입력하고 피인용 추적을 시작하세요.</p>';
  }

  return html;
}

function _card(title, value) {
  return '<div style="padding:10px;border:1px solid var(--line);border-radius:6px;background:var(--panel);text-align:center"><div style="font-size:.82rem;font-weight:700;color:var(--text)">' + value + '</div><div style="font-size:.58rem;color:var(--muted)">' + title + '</div></div>';
}


/* ═══════════════════════════════════════════
 * 함수 8: 영향력 보고서 내보내기
 * ═══════════════════════════════════════════ */

function _exportImpactReport() {
  const pp = _state.get('postpub') || {};
  const meta = _state.get('meta') || {};

  let md = '# Impact Report\n\n';
  md += '**Paper:** ' + (meta.title || '') + '\n';
  md += '**DOI:** ' + (pp.doi || '-') + '\n';
  md += '**Date:** ' + new Date().toISOString().split('T')[0] + '\n\n';
  md += '## Citation Metrics\n\n';
  md += '- Total citations: ' + (pp.citationCount || 0) + '\n';
  md += '- Tracking history: ' + (pp.citationHistory || []).length + ' data points\n\n';

  if ((pp.citationHistory || []).length) {
    md += '| Date | Citations |\n|------|----------|\n';
    (pp.citationHistory || []).forEach(h => { md += '| ' + h.date + ' | ' + h.count + ' |\n'; });
    md += '\n';
  }

  if ((pp.followUpIdeas || []).length) {
    md += '## Follow-up Research Ideas\n\n';
    (pp.followUpIdeas || []).forEach(i => { md += '- [' + i.priority + '] ' + i.description + '\n'; });
    md += '\n';
  }

  if ((pp.mediaLinks || []).length) {
    md += '## Media & Outreach\n\n';
    (pp.mediaLinks || []).forEach(m => { md += '- [' + m.type + '] ' + m.url + ' (' + m.date + ')\n'; });
  }

  const blob = new Blob([md], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'impact-report.md';
  a.click();
}

function _show(html) {
  const el = document.getElementById('pp-results');
  if (el) el.innerHTML = html;
}
