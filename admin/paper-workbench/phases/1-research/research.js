/**
 * research.js -- Phase 1: 문헌 조사 (완전 구현)
 *
 * Claude+Codex 합의 함수 목록:
 *  1. buildSearchQueryMatrix()     -- 검색 쿼리 확장/변형 생성
 *  2. fetchLiterature()            -- Semantic Scholar/CrossRef 일괄 검색
 *  3. constructLitMatrix()         -- 문헌 비교 매트릭스 구축
 *  4. detectResearchGaps()         -- 매트릭스에서 연구 갭 탐지
 *  5. formulateRQ()                -- 갭에서 연구 질문 도출
 *  6. scoreSourceRelevance()       -- 논문 관련성 순위
 *  7. addPaperManually()           -- 수동 논문 추가
 *  8. exportLitReview()            -- Related Work 초안 내보내기
 *  9. generateResearchSummary()    -- 조사 현황 요약
 * 10. manageMemos()                -- 자유 형식 메모
 */

import { bus, EVT } from '../../core/event-bus.js';
import { escHtml } from '../../shared/ui.js';
import { searchScholar, openGScholar, openAcademicDB } from '../../shared/citation.js';

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
  const r = _state.get('research') || {};
  const papers = (r.papers || []).length;
  const rqs = (r.researchQuestions || []).length;
  const gaps = (r.gaps || []).length;
  const progress = Math.min(100, papers * 5 + rqs * 15 + gaps * 10);
  return { progress, summary: `${papers}편 수집, ${gaps}갭, ${rqs} RQ` };
}

function _buildUI() {
  const r = _state.get('research') || {};
  const papers = r.papers || [];
  const rqs = r.researchQuestions || [];
  const gaps = r.gaps || [];
  const matrix = r.litMatrix || { axes: [], entries: [] };

  return `
    <div style="display:flex;height:100%;overflow:hidden">
      <!-- 좌측: 검색 + 도구 -->
      <div style="width:320px;border-right:1px solid var(--line);overflow-y:auto;padding:12px;background:var(--surface);flex-shrink:0">
        <h2 style="font-size:.88rem;color:var(--brand);margin-bottom:12px">문헌 조사</h2>

        <!-- 검색 -->
        <div style="margin-bottom:16px">
          <b style="font-size:.7rem;color:var(--text)">논문 검색</b>
          <input id="rs-query" type="text" placeholder="주제, 저자, 키워드..." style="width:100%;margin:4px 0;padding:6px;border:1px solid var(--line);border-radius:4px;font-size:.7rem;background:var(--panel);color:var(--text)">
          <div style="display:flex;gap:4px;margin-top:4px">
            <button class="bt p rs-action" data-action="search" style="flex:1">검색</button>
            <button class="bt rs-action" data-action="queryMatrix" style="flex:1">쿼리 확장</button>
          </div>
          <div style="display:flex;gap:2px;margin-top:4px;flex-wrap:wrap">
            <button class="bt" style="font-size:.5rem;padding:2px 4px" onclick="window._rsOpenDB('scholar')">Scholar</button>
            <button class="bt" style="font-size:.5rem;padding:2px 4px" onclick="window._rsOpenDB('arxiv')">arXiv</button>
            <button class="bt" style="font-size:.5rem;padding:2px 4px" onclick="window._rsOpenDB('dblp')">DBLP</button>
            <button class="bt" style="font-size:.5rem;padding:2px 4px" onclick="window._rsOpenDB('ieee')">IEEE</button>
            <button class="bt" style="font-size:.5rem;padding:2px 4px" onclick="window._rsOpenDB('acl')">ACL</button>
            <button class="bt" style="font-size:.5rem;padding:2px 4px" onclick="window._rsOpenDB('riss')">RISS</button>
            <button class="bt" style="font-size:.5rem;padding:2px 4px" onclick="window._rsOpenDB('kci')">KCI</button>
          </div>
          <div id="rs-search-results" style="display:none;max-height:300px;overflow-y:auto;margin-top:4px;border:1px solid var(--line);border-radius:4px;background:var(--panel)"></div>
        </div>

        <!-- 도구 버튼 -->
        <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:16px">
          <button class="bt rs-action" data-action="addManual">수동 논문 추가</button>
          <button class="bt rs-action" data-action="matrix">비교 매트릭스 구축</button>
          <button class="bt rs-action" data-action="gaps">연구 갭 분석</button>
          <button class="bt rs-action" data-action="rq">연구 질문 추가</button>
          <button class="bt rs-action" data-action="relevance">관련성 순위</button>
          <button class="bt rs-action" data-action="exportLR">Related Work 초안</button>
        </div>

        <!-- 메모 -->
        <div>
          <b style="font-size:.7rem;color:var(--text)">연구 메모</b>
          <textarea id="rs-notes" rows="4" placeholder="자유 형식 메모..." style="width:100%;margin:4px 0;padding:6px;border:1px solid var(--line);border-radius:4px;font-size:.68rem;background:var(--panel);color:var(--text);resize:vertical;font-family:inherit">${escHtml(r.notes || '')}</textarea>
        </div>
      </div>

      <!-- 우측: 결과 영역 -->
      <div id="rs-results" style="flex:1;overflow-y:auto;padding:20px 24px;background:var(--bg)">
        ${_buildSummary(papers, rqs, gaps, matrix)}
      </div>
    </div>
  `;
}

function _setupHandlers() {
  document.querySelectorAll('.rs-action[data-action]').forEach(btn => {
    btn.addEventListener('click', () => _handleAction(btn.dataset.action));
  });

  /* 메모 자동 저장 */
  const notes = document.getElementById('rs-notes');
  if (notes) notes.addEventListener('input', () => _state.set('research.notes', notes.value));

  /* 외부 DB 열기 */
  window._rsOpenDB = (db) => {
    const q = document.getElementById('rs-query').value.trim() || _state.get('meta.title') || '';
    if (db === 'scholar') openGScholar(q);
    else openAcademicDB(db, q);
  };
}

async function _handleAction(action) {
  switch (action) {
    case 'search': await _doSearch(); break;
    case 'queryMatrix': _showResult(_buildQueryMatrix()); break;
    case 'addManual': _addManualPaper(); break;
    case 'matrix': _showResult(_constructLitMatrix()); break;
    case 'gaps': _showResult(_detectGaps()); break;
    case 'rq': _addRQ(); break;
    case 'relevance': _showResult(_scoreRelevance()); break;
    case 'exportLR': _exportLitReview(); break;
  }
}


/* ═══════════════════════════════════════════
 * 함수 1: buildSearchQueryMatrix -- 쿼리 확장
 * ═══════════════════════════════════════════ */

function _buildQueryMatrix() {
  const query = document.getElementById('rs-query').value.trim();
  if (!query) return '<p style="color:var(--muted);font-size:.72rem">검색어를 입력하세요.</p>';

  /* 개념별 동의어 확장 */
  const expansions = {
    'security': ['security', 'vulnerability', 'attack', 'defense', 'threat', '보안', '취약점'],
    'llm': ['LLM', 'large language model', 'GPT', 'ChatGPT', 'foundation model', '대규모 언어모델'],
    'prompt': ['prompt injection', 'prompt attack', 'jailbreak', 'adversarial prompt'],
    'rag': ['RAG', 'retrieval-augmented generation', 'knowledge retrieval'],
    'ml': ['machine learning', 'deep learning', 'neural network', '기계학습', '딥러닝'],
  };

  const words = query.toLowerCase().split(/\s+/);
  const variants = [query];

  words.forEach(w => {
    Object.entries(expansions).forEach(([key, synonyms]) => {
      if (synonyms.some(s => s.toLowerCase().includes(w) || w.includes(key))) {
        synonyms.forEach(s => {
          const variant = query.replace(new RegExp(w, 'i'), s);
          if (!variants.includes(variant)) variants.push(variant);
        });
      }
    });
  });

  /* 연도 + 범위 변형 */
  const yearVariants = [query + ' 2024 2025', query + ' survey', query + ' systematic review'];

  const allQueries = [...new Set([...variants, ...yearVariants])].slice(0, 15);

  /* 저장 */
  _state.set('research.queries', allQueries.map(q => ({
    query: q, source: 'matrix', timestamp: new Date().toISOString(), resultCount: 0,
  })));

  let html = '<div style="font-size:.82rem;font-weight:700;color:var(--brand);margin-bottom:8px">쿼리 확장 (' + allQueries.length + '개)</div>';
  html += '<p style="font-size:.62rem;color:var(--muted);margin-bottom:8px">각 쿼리를 클릭하면 검색어로 설정됩니다.</p>';
  allQueries.forEach((q, i) => {
    html += '<div style="font-size:.65rem;padding:4px 8px;border:1px solid var(--line);border-radius:4px;margin:3px 0;cursor:pointer;background:var(--panel)" onclick="document.getElementById(\'rs-query\').value=\'' + escHtml(q).replace(/'/g, "\\'") + '\'">' + (i + 1) + '. ' + escHtml(q) + '</div>';
  });

  return html;
}


/* ═══════════════════════════════════════════
 * 함수 2: fetchLiterature -- 검색 실행
 * ═══════════════════════════════════════════ */

async function _doSearch() {
  const query = document.getElementById('rs-query').value.trim();
  if (!query) return;

  const resultsEl = document.getElementById('rs-search-results');
  resultsEl.style.display = 'block';
  resultsEl.innerHTML = '<p style="padding:6px;color:var(--muted);font-size:.62rem">검색 중...</p>';

  const results = await searchScholar(query);
  resultsEl.innerHTML = '';

  if (!results.length) {
    resultsEl.innerHTML = '<p style="padding:6px;color:var(--muted);font-size:.62rem">결과 없음</p>';
    return;
  }

  results.forEach(p => {
    const div = document.createElement('div');
    div.style.cssText = 'padding:6px;border-bottom:1px dotted var(--line);cursor:pointer;font-size:.6rem';
    div.innerHTML = '<b style="color:var(--brand)">' + escHtml(p.title) + '</b><br><span style="color:var(--muted);font-size:.52rem">' + escHtml(p.authors) + ' (' + p.year + ') ' + escHtml(p.venue) + ' | 인용:' + p.citationCount + '</span>';

    div.addEventListener('click', () => {
      const papers = _state.get('research.papers') || [];
      /* 중복 체크 */
      if (papers.some(pp => pp.title.toLowerCase() === p.title.toLowerCase())) {
        div.style.background = '#fee';
        return;
      }
      papers.push({
        id: papers.length + 1,
        title: p.title,
        authors: p.authors,
        year: p.year,
        venue: p.venue,
        abstract: '',
        doi: '',
        url: '',
        tags: [],
        notes: '',
        citationCount: p.citationCount,
        refText: p.refText,
      });
      _state.set('research.papers', papers);
      div.style.opacity = '.5';
      div.style.background = 'var(--surface)';
      bus.emit(EVT.PAPER_ADDED, { paper: papers[papers.length - 1] });
    });

    resultsEl.appendChild(div);
  });
}


/* ═══════════════════════════════════════════
 * 함수 3: constructLitMatrix -- 문헌 비교 매트릭스
 * ═══════════════════════════════════════════ */

function _constructLitMatrix() {
  const papers = _state.get('research.papers') || [];
  if (papers.length < 2) return '<p style="color:var(--muted);font-size:.72rem">최소 2편의 논문이 필요합니다.</p>';

  /* 기본 비교 축 */
  const axes = ['Method', 'Dataset', 'Metric', 'Key Finding'];
  const matrix = { axes, entries: papers.map(p => ({ paperId: p.id, title: p.title, year: p.year, values: {} })) };
  _state.set('research.litMatrix', matrix);

  let html = '<div style="font-size:.82rem;font-weight:700;color:var(--brand);margin-bottom:8px">문헌 비교 매트릭스 (' + papers.length + '편)</div>';
  html += '<p style="font-size:.62rem;color:var(--muted);margin-bottom:8px">각 셀을 편집하여 비교 내용을 채우세요.</p>';

  html += '<div style="overflow-x:auto"><table style="width:100%;font-size:.6rem;border-collapse:collapse;min-width:600px">';
  html += '<tr style="background:var(--surface)"><th style="padding:4px 6px;text-align:left;min-width:120px">논문</th><th>연도</th>';
  axes.forEach(a => { html += '<th style="min-width:100px">' + a + '</th>'; });
  html += '</tr>';

  papers.forEach(p => {
    html += '<tr><td style="padding:4px 6px;font-weight:600">' + escHtml(p.title.substring(0, 40)) + '</td>';
    html += '<td style="text-align:center">' + (p.year || '') + '</td>';
    axes.forEach(() => { html += '<td style="padding:2px 4px;border:1px solid var(--line);background:var(--panel)"><span style="color:var(--muted);font-size:.52rem">[입력 필요]</span></td>'; });
    html += '</tr>';
  });
  html += '</table></div>';

  return html;
}


/* ═══════════════════════════════════════════
 * 함수 4: detectResearchGaps -- 연구 갭 분석
 * ═══════════════════════════════════════════ */

function _detectGaps() {
  const papers = _state.get('research.papers') || [];
  if (papers.length < 3) return '<p style="color:var(--muted);font-size:.72rem">갭 분석에는 최소 3편의 논문이 필요합니다.</p>';

  const gaps = [];

  /* 연도 갭: 최근 연구가 없는 영역 */
  const years = papers.map(p => parseInt(p.year) || 0).filter(y => y > 0);
  const maxYear = Math.max(...years);
  const minYear = Math.min(...years);
  if (maxYear - minYear > 5 && years.filter(y => y >= maxYear - 1).length < 2) {
    gaps.push({ description: '최근 2년 이내 연구가 부족합니다.', evidence: '수집 논문 중 ' + years.filter(y => y >= maxYear - 1).length + '편만 최근 연구', severity: 'medium' });
  }

  /* 학회 다양성 */
  const venues = papers.map(p => p.venue || '').filter(v => v);
  const uniqueVenues = new Set(venues);
  if (uniqueVenues.size < 3 && papers.length >= 5) {
    gaps.push({ description: '학회/저널 다양성이 낮습니다.', evidence: uniqueVenues.size + '개 학회에서만 수집', severity: 'low' });
  }

  /* 인용수 기반: 고인용 논문 부재 */
  const highCite = papers.filter(p => (p.citationCount || 0) > 100);
  if (highCite.length === 0 && papers.length >= 5) {
    gaps.push({ description: '고인용 논문(100+ citations)이 포함되지 않았습니다.', evidence: '수집 논문 모두 100회 미만 인용', severity: 'medium' });
  }

  /* 사용자 입력 갭 유도 */
  gaps.push({ description: '[사용자 입력] 기존 연구에서 다루지 않은 관점이나 방법을 기술하세요.', evidence: '', severity: 'user' });

  _state.set('research.gaps', gaps);

  let html = '<div style="font-size:.82rem;font-weight:700;color:var(--brand);margin-bottom:8px">연구 갭 분석</div>';
  gaps.forEach((g, i) => {
    const color = g.severity === 'high' ? '#b42318' : g.severity === 'medium' ? 'var(--accent)' : g.severity === 'user' ? 'var(--brand)' : 'var(--muted)';
    html += '<div style="padding:6px 10px;border-left:3px solid ' + color + ';margin:4px 0;background:var(--panel);font-size:.65rem">';
    html += '<b style="color:' + color + '">Gap ' + (i + 1) + ':</b> ' + escHtml(g.description);
    if (g.evidence) html += '<div style="font-size:.58rem;color:var(--muted);margin-top:2px">근거: ' + escHtml(g.evidence) + '</div>';
    html += '</div>';
  });

  return html;
}


/* ═══════════════════════════════════════════
 * 함수 5: formulateRQ -- 연구 질문 추가
 * ═══════════════════════════════════════════ */

function _addRQ() {
  const text = prompt('연구 질문을 입력하세요 (예: RQ1: How does X affect Y?):');
  if (!text) return;

  const rqs = _state.get('research.researchQuestions') || [];
  const gaps = _state.get('research.gaps') || [];
  const linkedGap = gaps.length > 0 ? prompt('연결할 갭 번호 (1-' + gaps.length + ', 없으면 Enter):') : '';

  rqs.push({
    id: 'RQ' + (rqs.length + 1),
    text: text,
    type: /how|어떻게/i.test(text) ? 'descriptive' : /what\s*effect|영향/i.test(text) ? 'causal' : /compare|비교/i.test(text) ? 'comparative' : 'exploratory',
    linkedGap: linkedGap ? parseInt(linkedGap) - 1 : null,
  });
  _state.set('research.researchQuestions', rqs);
  bus.emit(EVT.RQ_ADDED, { rq: rqs[rqs.length - 1] });
  activate(); /* UI 갱신 */
}


/* ═══════════════════════════════════════════
 * 함수 6: scoreSourceRelevance -- 관련성 순위
 * ═══════════════════════════════════════════ */

function _scoreRelevance() {
  const papers = _state.get('research.papers') || [];
  const rqs = _state.get('research.researchQuestions') || [];
  const title = (_state.get('meta.title') || '').toLowerCase();
  const keywords = (_state.get('meta.keywords') || '').toLowerCase().split(',').map(k => k.trim()).filter(Boolean);

  if (!papers.length) return '<p style="color:var(--muted);font-size:.72rem">수집된 논문이 없습니다.</p>';

  /* 관련성 점수 계산 */
  const scored = papers.map(p => {
    let score = 0;
    const ptitle = (p.title || '').toLowerCase();
    const pvenue = (p.venue || '').toLowerCase();

    /* 제목 키워드 매칭 */
    keywords.forEach(k => { if (ptitle.includes(k)) score += 5; });
    /* RQ 키워드 매칭 */
    rqs.forEach(rq => {
      const rqWords = rq.text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      rqWords.forEach(w => { if (ptitle.includes(w)) score += 3; });
    });
    /* 인용수 보너스 */
    if ((p.citationCount || 0) > 100) score += 3;
    else if ((p.citationCount || 0) > 50) score += 2;
    else if ((p.citationCount || 0) > 10) score += 1;
    /* 최근 연구 보너스 */
    const year = parseInt(p.year) || 0;
    if (year >= 2024) score += 3;
    else if (year >= 2022) score += 2;

    return { ...p, relevanceScore: score };
  }).sort((a, b) => b.relevanceScore - a.relevanceScore);

  let html = '<div style="font-size:.82rem;font-weight:700;color:var(--brand);margin-bottom:8px">관련성 순위</div>';
  html += '<table style="width:100%;font-size:.6rem;border-collapse:collapse"><tr style="background:var(--surface)"><th style="padding:3px 6px;text-align:left">#</th><th style="text-align:left">논문</th><th>연도</th><th>인용</th><th>점수</th></tr>';
  scored.forEach((p, i) => {
    html += '<tr><td style="padding:3px 6px">' + (i + 1) + '</td><td>' + escHtml(p.title.substring(0, 50)) + '</td><td style="text-align:center">' + (p.year || '') + '</td><td style="text-align:center">' + (p.citationCount || 0) + '</td><td style="text-align:center;font-weight:700;color:var(--brand)">' + p.relevanceScore + '</td></tr>';
  });
  html += '</table>';

  return html;
}


/* ═══════════════════════════════════════════
 * 함수 7-8: 수동 추가, Related Work 내보내기
 * ═══════════════════════════════════════════ */

function _addManualPaper() {
  const title = prompt('논문 제목:');
  if (!title) return;
  const authors = prompt('저자 (쉼표 구분):') || '';
  const year = prompt('연도:') || '';
  const venue = prompt('학회/저널:') || '';

  const papers = _state.get('research.papers') || [];
  papers.push({
    id: papers.length + 1, title, authors, year, venue,
    abstract: '', doi: '', url: '', tags: [], notes: '',
    citationCount: 0,
    refText: authors + '. "' + title + '." ' + venue + ', ' + year + '.',
  });
  _state.set('research.papers', papers);
  bus.emit(EVT.PAPER_ADDED, {});
  activate();
}

function _exportLitReview() {
  const papers = _state.get('research.papers') || [];
  if (papers.length < 2) { alert('최소 2편의 논문이 필요합니다.'); return; }

  let md = '## Related Work\n\n';

  /* 연도순 그룹화 */
  const byDecade = {};
  papers.forEach(p => {
    const decade = Math.floor((parseInt(p.year) || 2020) / 5) * 5;
    const key = decade + '-' + (decade + 4);
    if (!byDecade[key]) byDecade[key] = [];
    byDecade[key].push(p);
  });

  Object.entries(byDecade).sort().forEach(([period, pps]) => {
    pps.forEach(p => {
      md += p.authors + ' [cite:' + p.id + '] ' + (p.year ? '(' + p.year + ')' : '') + ' presented "' + p.title + '"';
      if (p.venue) md += ' at ' + p.venue;
      md += '.\n\n';
    });
  });

  /* 클립보드에 복사 */
  navigator.clipboard.writeText(md).then(() => {
    _showResult('<div style="font-size:.78rem;color:var(--brand);padding:20px;text-align:center">[+] Related Work 초안이 클립보드에 복사되었습니다. Draft phase에서 붙여넣기하세요.</div><pre style="font-size:.6rem;padding:12px;background:var(--panel);border:1px solid var(--line);border-radius:4px;max-height:300px;overflow-y:auto;white-space:pre-wrap">' + escHtml(md) + '</pre>');
  }).catch(() => {
    _showResult('<pre style="font-size:.6rem;padding:12px;background:var(--panel);border:1px solid var(--line);border-radius:4px;max-height:400px;overflow-y:auto;white-space:pre-wrap">' + escHtml(md) + '</pre>');
  });
}


/* ═══════════════════════════════════════════
 * 대시보드
 * ═══════════════════════════════════════════ */

function _buildSummary(papers, rqs, gaps, matrix) {
  let html = '<div style="font-size:.82rem;font-weight:700;color:var(--brand);margin-bottom:12px">문헌 조사 현황</div>';

  /* 카드 */
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">';
  html += _card('수집 논문', papers.length + '편');
  html += _card('연구 갭', gaps.length + '개');
  html += _card('연구 질문', rqs.length + '개');
  html += _card('매트릭스', matrix.entries.length > 0 ? '구축됨' : '미구축');
  html += '</div>';

  /* 논문 목록 */
  if (papers.length) {
    html += '<div style="font-size:.72rem;font-weight:700;color:var(--text);margin:12px 0 6px">수집된 논문</div>';
    papers.forEach((p, i) => {
      html += '<div style="font-size:.62rem;padding:4px 8px;border:1px solid var(--line);border-radius:4px;margin:3px 0;background:var(--panel)">';
      html += '<b style="color:var(--brand)">[' + (i + 1) + ']</b> ' + escHtml(p.title);
      html += '<span style="color:var(--muted)"> -- ' + escHtml(p.authors || '').substring(0, 40) + ' (' + (p.year || '') + ')</span>';
      if (p.citationCount) html += ' <span style="font-size:.52rem;color:var(--muted)">인용:' + p.citationCount + '</span>';
      html += '</div>';
    });
  }

  /* RQ 목록 */
  if (rqs.length) {
    html += '<div style="font-size:.72rem;font-weight:700;color:var(--text);margin:12px 0 6px">연구 질문</div>';
    rqs.forEach(rq => {
      html += '<div style="font-size:.65rem;padding:6px 10px;border-left:3px solid var(--brand);margin:4px 0;background:var(--panel)">';
      html += '<b>' + rq.id + '</b>: ' + escHtml(rq.text);
      html += ' <span style="font-size:.52rem;color:var(--muted)">[' + rq.type + ']</span>';
      html += '</div>';
    });
  }

  if (!papers.length && !rqs.length) {
    html += '<p style="color:var(--muted);font-size:.72rem;text-align:center;padding:20px">좌측에서 논문을 검색하거나 연구 질문을 추가하세요.</p>';
  }

  return html;
}

function _card(title, value) {
  return '<div style="padding:10px;border:1px solid var(--line);border-radius:6px;background:var(--panel);text-align:center"><div style="font-size:.82rem;font-weight:700;color:var(--text)">' + value + '</div><div style="font-size:.58rem;color:var(--muted)">' + title + '</div></div>';
}

function _showResult(html) {
  const el = document.getElementById('rs-results');
  if (el) el.innerHTML = html;
}
