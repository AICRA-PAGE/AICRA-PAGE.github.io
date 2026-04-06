/**
 * journal-finder.js -- SCI/SCIE/SCOPUS/KCI 저널 검색 및 추천
 *
 * OpenAlex API (무료, 키 불필요)를 사용하여 저널을 검색한다.
 * 주제 키워드 -> 관련 저널 추천 (인덱싱 정보, 인용 지표, OA 여부)
 */

import { bus, EVT } from '../core/event-bus.js';

let _state = null;
let _bus = null;

const OPENALEX_API = 'https://api.openalex.org/sources';

/* 인덱싱 배지 색상 */
const INDEX_COLORS = {
  SCI: '#C62828', SCIE: '#E65100', SSCI: '#6A1B9A',
  AHCI: '#1565C0', SCOPUS: '#2E7D32', ESCI: '#546E7A',
  KCI: '#0D47A1', DOAJ: '#00695C',
};

/* 외부 DB 검색 URL */
const EXTERNAL_SEARCH = {
  wos: (q) => `https://www.webofscience.com/wos/woscc/basic-search?q=${encodeURIComponent(q)}`,
  scopus: (q) => `https://www.scopus.com/results/results.uri?search=${encodeURIComponent(q)}`,
  kci: (q) => `https://www.kci.go.kr/kciportal/po/search/poSereSearch.kci?sereSearchKeyword=${encodeURIComponent(q)}`,
  riss: (q) => `https://www.riss.kr/search/Search.do?queryText=${encodeURIComponent(q)}`,
  dbpia: (q) => `https://www.dbpia.co.kr/search/topSearch?searchOption=all&query=${encodeURIComponent(q)}`,
};


export function initJournalFinder(state, eventBus) {
  _state = state;
  _bus = eventBus;
}

/**
 * renderJournalFinder -- 저널 검색 UI를 컨테이너에 렌더링
 */
export function renderJournalFinder(containerEl) {
  if (!containerEl) return;

  containerEl.innerHTML = `
    <div style="padding:16px;max-width:800px;margin:0 auto">
      <h2 style="font-size:.92rem;color:var(--brand);margin-bottom:4px">저널/학회 찾기 (Journal Finder)</h2>
      <p style="font-size:.65rem;color:var(--muted);margin-bottom:12px">
        투고할 저널을 찾아보세요. 주제 키워드나 저널명으로 검색할 수 있습니다.
        <span style="font-size:.55rem;color:var(--muted)">(OpenAlex 260M+ 논문 DB 기반)</span>
      </p>

      <!-- 검색 입력 -->
      <div style="display:flex;gap:6px;margin-bottom:10px">
        <input id="jf-query" type="text" placeholder="주제 키워드 또는 저널명 (예: machine learning, LLM security)"
          style="flex:1;padding:8px 12px;border:1px solid var(--line);border-radius:5px;font-size:.72rem;background:var(--panel);color:var(--text)">
        <button class="bt p" id="jf-search-btn" style="padding:8px 16px">검색</button>
      </div>

      <!-- 필터 -->
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:12px" id="jf-filters">
        <span style="font-size:.58rem;color:var(--muted);padding:3px 0">필터:</span>
        ${_buildFilterPills()}
      </div>

      <!-- 외부 DB 바로가기 -->
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:16px">
        <span style="font-size:.55rem;color:var(--muted);padding:2px 0">외부 DB에서 직접 검색:</span>
        <button class="bt jf-ext" data-db="wos" style="font-size:.5rem;padding:2px 6px">Web of Science</button>
        <button class="bt jf-ext" data-db="scopus" style="font-size:.5rem;padding:2px 6px">SCOPUS</button>
        <button class="bt jf-ext" data-db="kci" style="font-size:.5rem;padding:2px 6px">KCI</button>
        <button class="bt jf-ext" data-db="riss" style="font-size:.5rem;padding:2px 6px">RISS</button>
        <button class="bt jf-ext" data-db="dbpia" style="font-size:.5rem;padding:2px 6px">DBpia</button>
      </div>

      <!-- 결과 -->
      <div id="jf-results" style="font-size:.7rem">
        <p style="color:var(--muted);text-align:center;padding:20px">위에서 키워드를 입력하고 검색하세요.</p>
      </div>

      <!-- 도움말 -->
      <div style="margin-top:16px;padding:10px;background:var(--surface);border-radius:6px;font-size:.6rem;color:var(--muted);line-height:1.7">
        <b style="color:var(--text)">저널 선택 가이드</b><br>
        <b>SCI/SCIE</b>: Web of Science에 등재된 국제 저널. Impact Factor가 부여됨. 이공계 연구에서 가장 인정받는 인덱스.<br>
        <b>SCOPUS</b>: Elsevier의 학술 DB. SCI보다 범위가 넓어 더 많은 저널이 포함됨. CiteScore 지표 사용.<br>
        <b>KCI</b>: 한국연구재단 등재지. 국내 학술지 평가의 기준. 등재/등재후보 구분.<br>
        <b>SSCI/AHCI</b>: 사회과학(SSCI), 인문예술(AHCI) 분야의 SCI 급 인덱스.<br>
        <b>Open Access</b>: 논문을 무료로 공개하는 저널. APC(게재료)를 저자가 부담하는 경우가 많음.
      </div>
    </div>
  `;

  /* 이벤트 바인딩 */
  containerEl.querySelector('#jf-search-btn').addEventListener('click', () => {
    const query = containerEl.querySelector('#jf-query').value.trim();
    if (query) _doSearch(query, containerEl);
  });
  containerEl.querySelector('#jf-query').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const query = e.target.value.trim();
      if (query) _doSearch(query, containerEl);
    }
  });

  /* 외부 DB 바로가기 */
  containerEl.querySelectorAll('.jf-ext').forEach(btn => {
    btn.addEventListener('click', () => {
      const db = btn.dataset.db;
      const query = containerEl.querySelector('#jf-query').value.trim() || _state.get('meta.keywords') || '';
      if (EXTERNAL_SEARCH[db]) window.open(EXTERNAL_SEARCH[db](query), '_blank');
    });
  });
}

function _buildFilterPills() {
  const filters = ['SCI', 'SCIE', 'SCOPUS', 'KCI', 'Open Access'];
  return filters.map(f => {
    const color = INDEX_COLORS[f] || 'var(--brand)';
    return `<button class="bt jf-filter" data-filter="${f}" style="font-size:.52rem;padding:2px 8px;border-radius:10px;border:1px solid ${color};color:${color};background:transparent">${f}</button>`;
  }).join('');
}


/**
 * searchJournals -- OpenAlex API로 저널 검색
 */
export async function searchJournals(query) {
  const url = `${OPENALEX_API}?search=${encodeURIComponent(query)}&per_page=20&mailto=aicra@example.com`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('OpenAlex API error: ' + res.status);
  const data = await res.json();

  return (data.results || []).map(src => ({
    id: src.id,
    name: src.display_name || '',
    issn: (src.issn || []).join(', '),
    publisher: src.host_organization_name || '',
    type: src.type || '',
    isOA: src.is_oa || false,
    citedByCount: src.cited_by_count || 0,
    worksCount: src.works_count || 0,
    subjects: (src.x_concepts || []).slice(0, 3).map(c => c.display_name),
    homepage: src.homepage_url || '',
    /* 인덱싱 추정 (OpenAlex는 SCI를 직접 라벨링하지 않으므로 휴리스틱) */
    indexing: _inferIndexing(src),
  }));
}

/* OpenAlex 데이터에서 인덱싱 추정 */
function _inferIndexing(src) {
  const tags = [];
  const name = (src.display_name || '').toLowerCase();
  const publisher = (src.host_organization_name || '').toLowerCase();

  /* DOAJ 등재 여부 */
  if (src.is_in_doaj) tags.push('DOAJ');

  /* OA 여부 */
  if (src.is_oa) tags.push('Open Access');

  /* 인용 기반 추정: 고인용 저널은 SCI/SCOPUS 가능성 높음 */
  const citePerWork = src.works_count > 0 ? src.cited_by_count / src.works_count : 0;
  if (citePerWork > 5) tags.push('SCOPUS');
  if (citePerWork > 10) tags.push('SCIE');
  if (citePerWork > 20) tags.push('SCI');

  /* 한국 저널 감지 */
  if (publisher.includes('korean') || publisher.includes('한국') || name.includes('한국') || name.includes('대한')) {
    tags.push('KCI');
  }

  return [...new Set(tags)];
}


async function _doSearch(query, containerEl) {
  const resultsEl = containerEl.querySelector('#jf-results');
  resultsEl.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px">검색 중...</p>';

  try {
    const journals = await searchJournals(query);

    if (!journals.length) {
      resultsEl.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px">결과가 없습니다. 다른 키워드로 검색해보세요.</p>';
      return;
    }

    resultsEl.innerHTML = `<div style="font-size:.6rem;color:var(--muted);margin-bottom:8px">${journals.length}개 저널 발견</div>`;

    journals.forEach(j => {
      const card = document.createElement('div');
      card.style.cssText = 'padding:10px 12px;border:1px solid var(--line);border-radius:6px;margin-bottom:8px;background:var(--panel)';

      /* 인덱싱 배지 */
      const badges = j.indexing.map(idx => {
        const color = INDEX_COLORS[idx] || 'var(--muted)';
        return `<span style="padding:1px 5px;border-radius:3px;font-size:.48rem;font-weight:700;color:#fff;background:${color}">${_esc(idx)}</span>`;
      }).join(' ');

      /* 인용 지표 */
      const citePerWork = j.worksCount > 0 ? (j.citedByCount / j.worksCount).toFixed(1) : '?';

      card.innerHTML = `
        <div style="display:flex;align-items:flex-start;gap:8px">
          <div style="flex:1">
            <div style="font-size:.75rem;font-weight:700;color:var(--text);margin-bottom:2px">${_esc(j.name)}</div>
            <div style="font-size:.58rem;color:var(--muted)">${_esc(j.publisher)} ${j.issn ? '| ISSN: ' + j.issn : ''}</div>
            <div style="margin:4px 0">${badges} ${j.isOA ? '<span style="padding:1px 5px;border-radius:3px;font-size:.48rem;font-weight:700;color:#fff;background:#00695C">OA</span>' : ''}</div>
            <div style="font-size:.55rem;color:var(--muted)">
              논문수: ${j.worksCount.toLocaleString()} | 총인용: ${j.citedByCount.toLocaleString()} | 논문당 인용: ~${citePerWork}
            </div>
            ${j.subjects.length ? '<div style="font-size:.52rem;color:var(--muted);margin-top:2px">분야: ' + j.subjects.map(s => _esc(s)).join(', ') + '</div>' : ''}
          </div>
          <button class="bt p jf-select" data-name="${_escAttr(j.name)}" style="font-size:.55rem;padding:4px 10px;flex-shrink:0">이 저널로 투고</button>
        </div>
      `;

      card.querySelector('.jf-select').addEventListener('click', () => {
        _state.set('meta.venue', j.name);
        _state.set('meta.venueTemplate', '');
        bus.emit(EVT.TOAST, { message: '"' + j.name + '" 저널이 선택되었습니다.', type: 'info' });
        bus.emit(EVT.VENUE_SELECTED, { venue: j.name });
      });

      resultsEl.appendChild(card);
    });

  } catch (err) {
    resultsEl.innerHTML = `<p style="color:#C62828;text-align:center;padding:20px">검색 실패: ${_esc(err.message)}</p>`;
  }
}

function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function _escAttr(s) { return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
