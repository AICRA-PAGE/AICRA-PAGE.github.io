/**
 * review.js -- Phase 5: 심사 대응 (12개 함수 완전 구현)
 *
 * Claude+Codex 합의 + 추가 함수:
 *  1. simulateReview()           -- 학회별 심사 시뮬레이션
 *  2. clusterComments()          -- 심사 의견 군집화
 *  3. rankRevisionPriority()     -- 수정 우선순위
 *  4. mapCommentsToSections()    -- 의견-섹션 매핑
 *  5. draftRebuttalPoints()      -- 반박문 포인트 생성
 *  6. buildResponseDoc()         -- 심사응답서 생성
 *  7. trackRevisions()           -- 수정 이력 추적
 *  8. highlightDiff()            -- diff 하이라이트
 *  9. generateReviewDashboard()  -- 리뷰 진행 대시보드
 * 10. addReviewComment()         -- 외부 심사 의견 입력
 * 11. saveVersion()              -- 버전 스냅샷 저장
 * 12. exportRebuttal()           -- 반박문 내보내기
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
  const rv = _state.get('review') || {};
  const sims = (rv.simulations || []).length;
  const comments = (rv.externalAnnotations || []).length;
  const rebuttals = (rv.rebuttal || []).length;
  const progress = Math.min(100, sims * 20 + comments * 5 + rebuttals * 10);
  return { progress, summary: `${sims}회 심사, ${comments}건 의견, ${rebuttals}건 반박` };
}


/* ═══════════════════════════════════════════
 * UI
 * ═══════════════════════════════════════════ */

function _buildUI() {
  const rv = _state.get('review') || {};
  const sims = rv.simulations || [];
  const comments = rv.externalAnnotations || [];
  const rebuttals = rv.rebuttal || [];
  const versions = rv.versions || [];

  const internalReviews = rv.internalReviews || [];
  const anonymousReviews = rv.anonymousReviews || [];
  const activeLane = rv.activeReviewLane || 'internal';

  return `
    <div style="display:flex;height:100%;overflow:hidden">
      <!-- 좌측: 도구 + 의견 입력 -->
      <div style="width:300px;border-right:1px solid var(--line);overflow-y:auto;padding:12px;background:var(--surface);flex-shrink:0">
        <h2 style="font-size:.88rem;color:var(--brand);margin-bottom:8px">심사 대응</h2>

        <!-- v2: 리뷰 레인 탭 (내부 검증 / 외부 심사 / 익명 리뷰) -->
        <div style="display:flex;gap:0;margin-bottom:12px;border:1px solid var(--line);border-radius:5px;overflow:hidden">
          <button class="bt rv-lane-tab" data-lane="internal" style="flex:1;border:none;border-radius:0;font-size:.55rem;padding:5px;${activeLane === 'internal' ? 'background:var(--brand);color:#fff' : ''}">내부 검증 (${internalReviews.length})</button>
          <button class="bt rv-lane-tab" data-lane="external" style="flex:1;border:none;border-radius:0;font-size:.55rem;padding:5px;${activeLane === 'external' ? 'background:var(--brand);color:#fff' : ''}">외부 심사 (${sims.length})</button>
          <button class="bt rv-lane-tab" data-lane="anonymous" style="flex:1;border:none;border-radius:0;font-size:.55rem;padding:5px;${activeLane === 'anonymous' ? 'background:var(--brand);color:#fff' : ''}">익명 리뷰 (${anonymousReviews.length})</button>
        </div>

        <!-- 내부 검증 입력 (activeLane === internal) -->
        <div id="rv-internal-panel" style="${activeLane === 'internal' ? '' : 'display:none'}">
          <div style="margin-bottom:12px">
            <b style="font-size:.68rem;color:var(--text)">내부 검증자 추가</b>
            <input id="rv-int-name" placeholder="검증자 이름 (예: 김교수)" style="width:100%;margin:3px 0;padding:4px;border:1px solid var(--line);border-radius:4px;font-size:.62rem;background:var(--panel)">
            <select id="rv-int-title" style="width:100%;margin:3px 0;padding:4px;border:1px solid var(--line);border-radius:4px;font-size:.62rem;background:var(--panel)">
              <option value="professor">교수 (Professor)</option>
              <option value="associate_professor">부교수 (Assoc. Prof.)</option>
              <option value="phd">박사 (PhD)</option>
              <option value="phd_candidate">박사과정 (PhD Candidate)</option>
              <option value="researcher">연구원 (Researcher)</option>
              <option value="other">기타</option>
            </select>
            <select id="rv-int-scope" style="width:100%;margin:3px 0;padding:4px;border:1px solid var(--line);border-radius:4px;font-size:.62rem;background:var(--panel)">
              <option value="full">전체 논문</option>
              <option value="intro">서론</option>
              <option value="method">연구 방법</option>
              <option value="results">결과</option>
              <option value="discussion">논의/결론</option>
            </select>
            <button class="bt p rv-action" data-action="addInternalReviewer" style="width:100%;margin-top:4px">내부 검증자 추가</button>
          </div>
          <div style="margin-bottom:12px">
            <b style="font-size:.68rem;color:var(--text)">내부 검증 현황</b>
            ${internalReviews.length === 0 ? '<p style="font-size:.6rem;color:var(--muted)">등록된 내부 검증자가 없습니다.</p>' :
              internalReviews.map((ir, i) => '<div style="padding:4px 6px;margin:3px 0;border:1px solid var(--line);border-radius:4px;font-size:.58rem;background:var(--panel)">' +
                '<b>' + (ir.reviewerName || 'Reviewer ' + (i+1)) + '</b> <span style="color:var(--muted)">(' + (ir.reviewerTitle || '') + ')</span> ' +
                '<span style="padding:1px 4px;border-radius:3px;font-size:.48rem;color:#fff;background:' + ({pending:'var(--accent)',in_progress:'#2196F3',completed:'#2E7D32'}[ir.status]||'var(--muted)') + '">' + ir.status + '</span>' +
                (ir.comments.length ? ' <span style="font-size:.5rem;color:var(--muted)">' + ir.comments.length + '건 코멘트</span>' : '') +
              '</div>').join('')}
          </div>
        </div>

        <!-- 익명 리뷰 입력 (activeLane === anonymous) -->
        <div id="rv-anonymous-panel" style="${activeLane === 'anonymous' ? '' : 'display:none'}">
          <div style="margin-bottom:12px">
            <b style="font-size:.68rem;color:var(--text)">익명 리뷰 추가</b>
            <p style="font-size:.55rem;color:var(--muted);margin:2px 0">실제 심사의견을 익명으로 기록합니다. 리뷰어 실명이 노출되지 않습니다.</p>
            <select id="rv-anon-id" style="width:100%;margin:3px 0;padding:4px;border:1px solid var(--line);border-radius:4px;font-size:.62rem;background:var(--panel)">
              <option value="Reviewer A">Reviewer A</option>
              <option value="Reviewer B">Reviewer B</option>
              <option value="Reviewer C">Reviewer C</option>
              <option value="Reviewer D">Reviewer D</option>
            </select>
            <textarea id="rv-anon-text" placeholder="익명 심사 의견..." rows="4" style="width:100%;padding:4px;border:1px solid var(--line);border-radius:4px;font-size:.62rem;background:var(--panel);resize:vertical"></textarea>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;margin:4px 0;font-size:.55rem">
              <label>Novelty <input id="rv-anon-s1" type="range" min="1" max="5" value="3" style="width:100%"></label>
              <label>Soundness <input id="rv-anon-s2" type="range" min="1" max="5" value="3" style="width:100%"></label>
              <label>Clarity <input id="rv-anon-s3" type="range" min="1" max="5" value="3" style="width:100%"></label>
              <label>Significance <input id="rv-anon-s4" type="range" min="1" max="5" value="3" style="width:100%"></label>
            </div>
            <select id="rv-anon-decision" style="width:100%;margin:3px 0;padding:4px;border:1px solid var(--line);border-radius:4px;font-size:.62rem;background:var(--panel)">
              <option value="">-- 판정 --</option>
              <option value="accept">Accept</option>
              <option value="minor">Minor Revision</option>
              <option value="major">Major Revision</option>
              <option value="reject">Reject</option>
            </select>
            <button class="bt p rv-action" data-action="addAnonymousReview" style="width:100%;margin-top:4px">익명 리뷰 추가</button>
          </div>
          ${anonymousReviews.length ? '<div style="margin-bottom:12px"><b style="font-size:.68rem;color:var(--text)">익명 리뷰 목록</b>' +
            anonymousReviews.map((ar, i) => '<div style="padding:4px 6px;margin:3px 0;border:1px solid var(--line);border-radius:4px;font-size:.58rem;background:var(--panel)">' +
              '<b>' + ar.anonymousId + '</b> (Round ' + (ar.round || 1) + ') ' +
              '<span style="padding:1px 4px;border-radius:3px;font-size:.48rem;color:#fff;background:' + ({accept:'#2E7D32',minor:'#E65100',major:'#C62828',reject:'#333'}[ar.decision]||'var(--muted)') + '">' + (ar.decision || 'pending') + '</span>' +
            '</div>').join('') + '</div>' : ''}
        </div>

        <!-- 외부 심사 (기존) -->
        <div id="rv-external-panel" style="${activeLane === 'external' ? '' : 'display:none'}">

        <!-- 모의 심사 -->
        <div style="margin-bottom:16px">
          <b style="font-size:.7rem;color:var(--text)">모의 심사</b>
          <select id="rv-venue" style="width:100%;margin:4px 0;padding:4px;border:1px solid var(--line);border-radius:4px;font-size:.65rem;background:var(--panel)">
            <option value="generic">일반 학회</option>
            <option value="sp">IEEE S&P</option>
            <option value="ccs">ACM CCS</option>
            <option value="neurips">NeurIPS</option>
            <option value="usenix">USENIX Security</option>
            <option value="kci">KCI 저널</option>
          </select>
          <button class="bt p rv-action" data-action="simulate" style="width:100%;margin-top:4px">심사 시뮬레이션 실행</button>
        </div>

        <!-- 심사 의견 입력 -->
        <div style="margin-bottom:16px">
          <b style="font-size:.7rem;color:var(--text)">심사 의견 입력</b>
          <input id="rv-reviewer" placeholder="Reviewer #" style="width:100%;margin:4px 0;padding:4px;border:1px solid var(--line);border-radius:4px;font-size:.65rem;background:var(--panel)">
          <textarea id="rv-comment-text" placeholder="심사 의견을 입력하세요..." rows="3" style="width:100%;padding:4px;border:1px solid var(--line);border-radius:4px;font-size:.65rem;background:var(--panel);resize:vertical"></textarea>
          <select id="rv-comment-cat" style="width:100%;margin:4px 0;padding:4px;border:1px solid var(--line);border-radius:4px;font-size:.65rem;background:var(--panel)">
            <option value="major">Major Issue</option>
            <option value="minor">Minor Issue</option>
            <option value="question">Question</option>
            <option value="suggestion">Suggestion</option>
            <option value="typo">Typo</option>
          </select>
          <button class="bt rv-action" data-action="addComment" style="width:100%">의견 추가</button>
        </div>

        <!-- 도구 버튼들 -->
        <div style="display:flex;flex-direction:column;gap:4px">
          <button class="bt rv-action" data-action="saveVersion">현재 버전 저장 (${versions.length}개)</button>
          <button class="bt rv-action" data-action="cluster">의견 군집화</button>
          <button class="bt rv-action" data-action="priority">수정 우선순위</button>
          <button class="bt rv-action" data-action="rebuttal">반박문 생성</button>
          <button class="bt rv-action" data-action="response">심사응답서 생성</button>
          <button class="bt rv-action" data-action="diff">버전 비교 (diff)</button>
          <button class="bt rv-action" data-action="export">반박문 내보내기</button>
        </div>
        </div><!-- /rv-external-panel -->
      </div>

      <!-- 우측: 결과 영역 -->
      <div id="rv-results" style="flex:1;overflow-y:auto;padding:20px 24px;background:var(--bg)">
        ${_buildDashboard(sims, comments, rebuttals, versions)}
      </div>
    </div>
  `;
}

function _setupHandlers() {
  /* v2: 레인 탭 전환 */
  document.querySelectorAll('.rv-lane-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const lane = tab.dataset.lane;
      _state.set('review.activeReviewLane', lane);
      document.querySelectorAll('.rv-lane-tab').forEach(t => { t.style.background = ''; t.style.color = ''; });
      tab.style.background = 'var(--brand)';
      tab.style.color = '#fff';
      ['internal', 'external', 'anonymous'].forEach(l => {
        const panel = document.getElementById('rv-' + l + '-panel');
        if (panel) panel.style.display = l === lane ? '' : 'none';
      });
    });
  });

  document.querySelectorAll('.rv-action[data-action]').forEach(btn => {
    btn.addEventListener('click', () => _handleAction(btn.dataset.action));
  });
}

function _handleAction(action) {
  const body = _state.get('draft.body') || '';
  const rv = _state.get('review') || {};

  switch (action) {
    case 'simulate': _showResult(simulateReview(body, document.getElementById('rv-venue').value)); break;
    case 'addComment': _addComment(); break;
    case 'saveVersion': _saveVersion(body); break;
    case 'cluster': _showResult(clusterComments(rv.externalAnnotations || [])); break;
    case 'priority': _showResult(rankRevisionPriority(rv.externalAnnotations || [])); break;
    case 'rebuttal': _showResult(draftRebuttalPoints(rv.externalAnnotations || [])); break;
    case 'response': _showResult(buildResponseDoc(rv)); break;
    case 'diff': _showResult(highlightDiff(rv.versions || [])); break;
    case 'export': exportRebuttal(rv); break;
    /* v2: 내부 검증자 추가 */
    case 'addInternalReviewer': _addInternalReviewer(); break;
    /* v2: 익명 리뷰 추가 */
    case 'addAnonymousReview': _addAnonymousReview(); break;
  }
}

/* ═══════════════════════════════════════════
 * v2: 내부 검증자 추가
 * ═══════════════════════════════════════════ */
function _addInternalReviewer() {
  const name = (document.getElementById('rv-int-name') || {}).value?.trim();
  if (!name) return;
  const title = (document.getElementById('rv-int-title') || {}).value || 'other';
  const scope = (document.getElementById('rv-int-scope') || {}).value || 'full';

  const reviews = _state.get('review.internalReviews') || [];
  reviews.push({
    reviewerId: 'int-' + Date.now(),
    reviewerName: name,
    reviewerTitle: title,
    scope: scope,
    status: 'pending',
    round: 1,
    comments: [],
    decision: '',
    createdAt: new Date().toISOString(),
    completedAt: null,
  });
  _state.set('review.internalReviews', reviews);

  /* UI 갱신 */
  if (document.getElementById('rv-int-name')) document.getElementById('rv-int-name').value = '';
  activate();
}

/* ═══════════════════════════════════════════
 * v2: 익명 리뷰 추가
 * ═══════════════════════════════════════════ */
function _addAnonymousReview() {
  const anonId = (document.getElementById('rv-anon-id') || {}).value || 'Reviewer A';
  const text = (document.getElementById('rv-anon-text') || {}).value?.trim();
  if (!text) return;

  const s1 = parseInt((document.getElementById('rv-anon-s1') || {}).value) || 3;
  const s2 = parseInt((document.getElementById('rv-anon-s2') || {}).value) || 3;
  const s3 = parseInt((document.getElementById('rv-anon-s3') || {}).value) || 3;
  const s4 = parseInt((document.getElementById('rv-anon-s4') || {}).value) || 3;
  const decision = (document.getElementById('rv-anon-decision') || {}).value || '';

  const reviews = _state.get('review.anonymousReviews') || [];
  reviews.push({
    anonymousId: anonId,
    comments: [{ text: text, category: 'general', timestamp: new Date().toISOString() }],
    scores: { novelty: s1, soundness: s2, clarity: s3, significance: s4 },
    decision: decision,
    round: 1,
    createdAt: new Date().toISOString(),
  });
  _state.set('review.anonymousReviews', reviews);

  if (document.getElementById('rv-anon-text')) document.getElementById('rv-anon-text').value = '';
  activate();
}


/* ═══════════════════════════════════════════
 * 함수 1: simulateReview -- 학회별 심사 시뮬레이션
 * ═══════════════════════════════════════════ */

function simulateReview(body, venueId) {
  const wc = body.trim().split(/\s+/).length;
  const sections = (body.match(/^##\s/gm) || []).length;
  const cites = (body.match(/\[cite:\d+\]/g) || []).length;
  const refs = (_state.get('references') || []).length;
  const hasAbstract = !!_state.get('meta.abstract') || /:::abstract/.test(body);
  const hasThreat = /threat|위협/i.test(body);
  const hasEthics = /ethic|disclosure|윤리/i.test(body);
  const hasEval = /experiment|evaluation|실험|평가/i.test(body);
  const hasRelated = /related\s*work|선행\s*연구|관련\s*연구/i.test(body);

  /* 학회별 기대치 */
  const expectations = {
    generic: { minWords: 3000, minRefs: 10, minSections: 5, needsThreat: false, needsEthics: false },
    sp: { minWords: 8000, minRefs: 30, minSections: 7, needsThreat: true, needsEthics: true },
    ccs: { minWords: 8000, minRefs: 25, minSections: 7, needsThreat: true, needsEthics: true },
    neurips: { minWords: 6000, minRefs: 20, minSections: 6, needsThreat: false, needsEthics: true },
    usenix: { minWords: 8000, minRefs: 25, minSections: 7, needsThreat: true, needsEthics: true },
    kci: { minWords: 4000, minRefs: 15, minSections: 5, needsThreat: false, needsEthics: false },
  };
  const exp = expectations[venueId] || expectations.generic;

  /* 루브릭 평가 */
  const rubric = [
    { id: 'novelty', label: '새로움 (Novelty)', score: hasEval ? 7 : 5, max: 10 },
    { id: 'soundness', label: '건전성 (Soundness)', score: Math.min(10, Math.round(cites / 5) + (hasEval ? 3 : 0) + (hasThreat ? 2 : 0)), max: 10 },
    { id: 'clarity', label: '명확성 (Clarity)', score: Math.min(10, Math.round(sections / 2) + (hasAbstract ? 2 : 0) + (wc > exp.minWords ? 2 : 0)), max: 10 },
    { id: 'significance', label: '중요성 (Significance)', score: hasEval && refs >= exp.minRefs ? 8 : 5, max: 10 },
    { id: 'reproducibility', label: '재현성 (Reproducibility)', score: /code|github|데이터셋/i.test(body) ? 8 : 4, max: 10 },
  ];

  const totalScore = Math.round(rubric.reduce((s, r) => s + r.score, 0) / rubric.length * 10);

  /* 강점/약점 */
  const strengths = [];
  const weaknesses = [];
  if (wc >= exp.minWords) strengths.push('충분한 분량 (' + wc + '단어)');
  else weaknesses.push('분량 부족 (' + wc + '/' + exp.minWords + '단어)');
  if (refs >= exp.minRefs) strengths.push('충분한 참고문헌 (' + refs + '편)');
  else weaknesses.push('참고문헌 부족 (' + refs + '/' + exp.minRefs + '편)');
  if (hasEval) strengths.push('실험/평가 섹션 포함');
  else weaknesses.push('실험/평가 섹션 없음');
  if (hasRelated) strengths.push('관련 연구 섹션 포함');
  else weaknesses.push('관련 연구 섹션 없음');
  if (exp.needsThreat && !hasThreat) weaknesses.push('위협 모델 없음 (' + venueId + ' 필수)');
  if (exp.needsEthics && !hasEthics) weaknesses.push('윤리/공개 섹션 없음');

  /* 결과 저장 */
  const sim = { venue: venueId, score: totalScore, rubric, strengths, weaknesses, timestamp: new Date().toISOString() };
  const sims = _state.get('review.simulations') || [];
  sims.push(sim);
  _state.set('review.simulations', sims);

  /* 판정 */
  const verdict = totalScore >= 75 ? 'Weak Accept' : totalScore >= 60 ? 'Borderline' : totalScore >= 45 ? 'Weak Reject' : 'Reject';
  const verdictColor = totalScore >= 75 ? 'var(--brand)' : totalScore >= 60 ? 'var(--accent)' : '#b42318';

  let html = '<div style="text-align:center;padding:12px;border-bottom:2px solid ' + verdictColor + ';margin-bottom:12px">';
  html += '<div style="font-size:1.5rem;font-weight:700;color:' + verdictColor + '">' + totalScore + '/100</div>';
  html += '<div style="font-size:.82rem;font-weight:600;color:' + verdictColor + '">' + verdict + '</div>';
  html += '<div style="font-size:.65rem;color:var(--muted)">' + venueId.toUpperCase() + ' 기준 모의 심사</div>';
  html += '</div>';

  html += '<table style="width:100%;font-size:.65rem;border-collapse:collapse;margin:8px 0"><tr style="background:var(--surface)"><th style="padding:3px 6px;text-align:left">평가 항목</th><th>점수</th><th>시각화</th></tr>';
  rubric.forEach(r => {
    const pct = Math.round(r.score / r.max * 100);
    html += '<tr><td style="padding:3px 6px">' + r.label + '</td><td style="text-align:center">' + r.score + '/' + r.max + '</td><td><div style="background:var(--line);height:6px;border-radius:3px;width:80px"><div style="background:' + (pct >= 70 ? 'var(--brand)' : pct >= 50 ? 'var(--accent)' : '#b42318') + ';height:100%;width:' + pct + '%;border-radius:3px"></div></div></td></tr>';
  });
  html += '</table>';

  if (strengths.length) {
    html += '<div style="font-size:.72rem;font-weight:700;color:var(--brand);margin:8px 0 4px">강점</div>';
    strengths.forEach(s => { html += '<div style="font-size:.62rem;color:var(--brand);padding:1px 0">[+] ' + s + '</div>'; });
  }
  if (weaknesses.length) {
    html += '<div style="font-size:.72rem;font-weight:700;color:#b42318;margin:8px 0 4px">약점</div>';
    weaknesses.forEach(w => { html += '<div style="font-size:.62rem;color:#b42318;padding:1px 0">[-] ' + w + '</div>'; });
  }

  return html;
}


/* ═══════════════════════════════════════════
 * 함수 2-4: 의견 관리
 * ═══════════════════════════════════════════ */

function clusterComments(comments) {
  if (!comments.length) return '<p style="color:var(--muted);font-size:.72rem">심사 의견이 없습니다.</p>';

  /* 카테고리별 군집화 */
  const clusters = {};
  comments.forEach(c => {
    const cat = c.category || 'other';
    if (!clusters[cat]) clusters[cat] = [];
    clusters[cat].push(c);
  });

  let html = '<div style="font-size:.82rem;font-weight:700;color:var(--brand);margin-bottom:8px">의견 군집화</div>';
  const catLabels = { major: 'Major Issues', minor: 'Minor Issues', question: 'Questions', suggestion: 'Suggestions', typo: 'Typos', other: 'Other' };
  const catColors = { major: '#b42318', minor: 'var(--accent)', question: '#4a6fa5', suggestion: 'var(--brand)', typo: '#888', other: 'var(--muted)' };

  Object.entries(clusters).forEach(([cat, items]) => {
    html += '<div style="margin:8px 0"><div style="font-size:.7rem;font-weight:700;color:' + (catColors[cat] || 'var(--text)') + '">' + (catLabels[cat] || cat) + ' (' + items.length + '건)</div>';
    items.forEach(c => {
      html += '<div style="font-size:.62rem;padding:3px 8px;border-left:3px solid ' + (catColors[cat] || 'var(--line)') + ';margin:3px 0;background:var(--panel)">' + escHtml(c.text || '') + '<span style="color:var(--muted);font-size:.55rem"> -- ' + (c.reviewer || 'Anonymous') + '</span></div>';
    });
    html += '</div>';
  });

  return html;
}

function rankRevisionPriority(comments) {
  if (!comments.length) return '<p style="color:var(--muted);font-size:.72rem">심사 의견이 없습니다.</p>';

  const weights = { major: 10, minor: 5, question: 3, suggestion: 4, typo: 1 };
  const ranked = comments.map(c => ({
    ...c,
    priority: weights[c.category] || 3,
  })).sort((a, b) => b.priority - a.priority);

  let html = '<div style="font-size:.82rem;font-weight:700;color:var(--brand);margin-bottom:8px">수정 우선순위</div>';
  ranked.forEach((c, i) => {
    const urgency = c.priority >= 8 ? '#b42318' : c.priority >= 4 ? 'var(--accent)' : 'var(--muted)';
    html += '<div style="font-size:.64rem;padding:4px 8px;border-left:3px solid ' + urgency + ';margin:3px 0;background:var(--panel);display:flex;gap:6px">';
    html += '<span style="font-weight:700;color:' + urgency + '">#' + (i + 1) + '</span>';
    html += '<span>' + escHtml((c.text || '').substring(0, 100)) + '</span>';
    html += '<span style="color:var(--muted);font-size:.55rem;margin-left:auto">[' + (c.category || '') + ']</span>';
    html += '</div>';
  });

  return html;
}

function mapCommentsToSections(comments, body) {
  /* 각 의견에서 키워드를 추출하여 섹션과 매칭 */
  const sections = [];
  body.split(/^(##\s+.+)$/gm).forEach(part => {
    if (/^##\s+/.test(part)) sections.push({ title: part.replace(/^##\s+/, '').trim(), comments: [] });
  });

  comments.forEach(c => {
    const text = (c.text || '').toLowerCase();
    let matched = false;
    sections.forEach(s => {
      if (text.includes(s.title.toLowerCase().substring(0, 10))) { s.comments.push(c); matched = true; }
    });
    if (!matched && sections.length) sections[0].comments.push(c); /* 매칭 안 되면 첫 섹션에 */
  });

  return sections;
}


/* ═══════════════════════════════════════════
 * 함수 5-6: 반박문
 * ═══════════════════════════════════════════ */

function draftRebuttalPoints(comments) {
  if (!comments.length) return '<p style="color:var(--muted);font-size:.72rem">심사 의견이 없습니다.</p>';

  let html = '<div style="font-size:.82rem;font-weight:700;color:var(--brand);margin-bottom:8px">반박문 포인트</div>';
  html += '<p style="font-size:.65rem;color:var(--muted);margin-bottom:8px">각 의견에 대해 응답 방향을 제시합니다. 직접 수정하세요.</p>';

  const rebuttals = [];
  comments.forEach((c, i) => {
    const stance = c.category === 'major' ? 'concede + clarify' : c.category === 'typo' ? 'accept' : 'clarify';
    const template = c.category === 'major'
      ? '지적에 감사드립니다. [수정 내용]으로 보완하였습니다. 구체적으로...'
      : c.category === 'question'
      ? '좋은 질문입니다. [답변 내용]...'
      : c.category === 'suggestion'
      ? '제안에 감사드립니다. [수용/불수용 사유]...'
      : '수정하였습니다.';

    rebuttals.push({ commentId: i, stance, response: template, status: 'draft' });

    html += '<div style="margin:8px 0;padding:8px;border:1px solid var(--line);border-radius:6px;background:var(--panel)">';
    html += '<div style="font-size:.62rem;color:var(--muted);margin-bottom:4px">[' + (c.reviewer || 'Reviewer') + '] ' + (c.category || '') + '</div>';
    html += '<div style="font-size:.68rem;font-weight:600;color:var(--text);margin-bottom:4px">"' + escHtml((c.text || '').substring(0, 120)) + '"</div>';
    html += '<div style="font-size:.62rem;color:var(--brand);font-style:italic">Response (' + stance + '): ' + template + '</div>';
    html += '</div>';
  });

  _state.set('review.rebuttal', rebuttals);
  return html;
}

function buildResponseDoc(rv) {
  const comments = rv.externalAnnotations || [];
  const rebuttals = rv.rebuttal || [];
  const meta = _state.get('meta') || {};

  let html = '<div style="font-size:.88rem;font-weight:700;color:var(--brand);margin-bottom:12px">심사응답서 (Response to Reviewers)</div>';
  html += '<div style="font-size:.65rem;color:var(--muted);margin-bottom:8px">논문: ' + escHtml(meta.title || '') + ' | 생성: ' + new Date().toISOString().split('T')[0] + '</div>';

  if (!comments.length) {
    html += '<p style="color:var(--muted);font-size:.72rem">심사 의견이 없습니다.</p>';
    return html;
  }

  /* 리뷰어별 그룹 */
  const byReviewer = {};
  comments.forEach((c, i) => {
    const reviewer = c.reviewer || 'Reviewer';
    if (!byReviewer[reviewer]) byReviewer[reviewer] = [];
    byReviewer[reviewer].push({ ...c, idx: i });
  });

  Object.entries(byReviewer).forEach(([reviewer, items]) => {
    html += '<div style="border-top:2px solid var(--brand);margin-top:12px;padding-top:8px">';
    html += '<div style="font-size:.78rem;font-weight:700;color:var(--brand);margin-bottom:6px">' + escHtml(reviewer) + '</div>';
    items.forEach((c, j) => {
      const rebuttal = rebuttals.find(r => r.commentId === c.idx);
      html += '<div style="margin:6px 0">';
      html += '<div style="font-size:.65rem;font-weight:600;color:var(--text)">Comment ' + (j + 1) + ' [' + (c.category || '') + ']:</div>';
      html += '<div style="font-size:.62rem;padding:4px 8px;background:var(--surface);border-radius:4px;margin:2px 0">' + escHtml(c.text || '') + '</div>';
      html += '<div style="font-size:.65rem;font-weight:600;color:var(--brand);margin-top:4px">Response:</div>';
      html += '<div style="font-size:.62rem;padding:4px 8px;border-left:3px solid var(--brand);margin:2px 0">' + escHtml(rebuttal ? rebuttal.response : '[응답 작성 필요]') + '</div>';
      html += '</div>';
    });
    html += '</div>';
  });

  return html;
}


/* ═══════════════════════════════════════════
 * 함수 7-8: 버전 관리 + diff
 * ═══════════════════════════════════════════ */

function _saveVersion(body) {
  const versions = _state.get('review.versions') || [];
  versions.push({
    versionId: versions.length + 1,
    body: body,
    timestamp: new Date().toISOString(),
    label: 'v' + (versions.length + 1),
    wordCount: body.trim().split(/\s+/).length,
  });
  _state.set('review.versions', versions);
  _showResult('<div style="font-size:.78rem;color:var(--brand);padding:20px;text-align:center">[+] 버전 v' + versions.length + ' 저장됨 (' + body.trim().split(/\s+/).length + '단어)</div>');
}

function highlightDiff(versions) {
  if (versions.length < 2) return '<p style="color:var(--muted);font-size:.72rem">비교하려면 최소 2개 버전이 필요합니다. "현재 버전 저장"을 먼저 실행하세요.</p>';

  const v1 = versions[versions.length - 2];
  const v2 = versions[versions.length - 1];

  const lines1 = v1.body.split('\n');
  const lines2 = v2.body.split('\n');

  let html = '<div style="font-size:.82rem;font-weight:700;color:var(--brand);margin-bottom:8px">버전 비교: ' + v1.label + ' vs ' + v2.label + '</div>';
  html += '<div style="font-size:.62rem;color:var(--muted);margin-bottom:8px">' + v1.label + ': ' + v1.wordCount + '단어 | ' + v2.label + ': ' + v2.wordCount + '단어 | 차이: ' + (v2.wordCount - v1.wordCount) + '단어</div>';

  /* 단순 라인별 diff */
  const maxLines = Math.max(lines1.length, lines2.length);
  let addedCount = 0, removedCount = 0, changedCount = 0;

  html += '<div style="font-family:monospace;font-size:.6rem;max-height:400px;overflow-y:auto;border:1px solid var(--line);border-radius:4px;padding:4px">';

  for (let i = 0; i < maxLines; i++) {
    const l1 = lines1[i] || '';
    const l2 = lines2[i] || '';

    if (l1 === l2) {
      /* 동일 라인 -- 너무 많으면 생략 */
      if (i > 5 && i < maxLines - 5) continue;
      html += '<div style="padding:1px 4px;color:var(--muted)">' + escHtml(l2.substring(0, 120)) + '</div>';
    } else if (!l1) {
      addedCount++;
      html += '<div style="padding:1px 4px;background:rgba(46,125,50,.1);color:#2E7D32">+ ' + escHtml(l2.substring(0, 120)) + '</div>';
    } else if (!l2) {
      removedCount++;
      html += '<div style="padding:1px 4px;background:rgba(180,35,24,.1);color:#b42318">- ' + escHtml(l1.substring(0, 120)) + '</div>';
    } else {
      changedCount++;
      html += '<div style="padding:1px 4px;background:rgba(180,35,24,.05);color:#b42318">- ' + escHtml(l1.substring(0, 120)) + '</div>';
      html += '<div style="padding:1px 4px;background:rgba(46,125,50,.05);color:#2E7D32">+ ' + escHtml(l2.substring(0, 120)) + '</div>';
    }
  }
  html += '</div>';
  html += '<div style="font-size:.62rem;margin-top:6px;color:var(--muted)">추가: ' + addedCount + '줄 | 삭제: ' + removedCount + '줄 | 변경: ' + changedCount + '줄</div>';

  return html;
}


/* ═══════════════════════════════════════════
 * 함수 9: 대시보드
 * ═══════════════════════════════════════════ */

function _buildDashboard(sims, comments, rebuttals, versions) {
  let html = '<div style="font-size:.82rem;font-weight:700;color:var(--brand);margin-bottom:12px">심사 대응 현황</div>';

  /* 카드 그리드 */
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">';
  html += _card('모의 심사', sims.length + '회', sims.length > 0 ? sims[sims.length - 1].score + '/100' : '-');
  html += _card('심사 의견', comments.length + '건', comments.filter(c => c.category === 'major').length + ' major');
  html += _card('반박문', rebuttals.length + '건', rebuttals.filter(r => r.status === 'draft').length + ' 미완성');
  html += _card('저장 버전', versions.length + '개', versions.length > 0 ? versions[versions.length - 1].label : '-');
  html += '</div>';

  /* 최근 심사 결과 */
  if (sims.length) {
    const last = sims[sims.length - 1];
    html += '<div style="font-size:.72rem;font-weight:700;color:var(--text);margin:8px 0">최근 심사 (' + last.venue + ')</div>';
    html += '<div style="font-size:.62rem">점수: ' + last.score + '/100 | 강점: ' + last.strengths.length + '개 | 약점: ' + last.weaknesses.length + '개</div>';
  }

  /* 의견 목록 */
  if (comments.length) {
    html += '<div style="font-size:.72rem;font-weight:700;color:var(--text);margin:12px 0 6px">심사 의견 (' + comments.length + '건)</div>';
    comments.forEach((c, i) => {
      html += '<div style="font-size:.62rem;padding:3px 8px;border-left:3px solid var(--accent);margin:3px 0;background:var(--panel)">[' + (c.reviewer || 'Reviewer') + '] ' + escHtml((c.text || '').substring(0, 100)) + '</div>';
    });
  }

  if (!sims.length && !comments.length) {
    html += '<p style="color:var(--muted);font-size:.72rem;text-align:center;padding:20px">좌측에서 모의 심사를 실행하거나 심사 의견을 입력하세요.</p>';
  }

  return html;
}

function _card(title, value, sub) {
  return '<div style="padding:10px;border:1px solid var(--line);border-radius:6px;background:var(--panel);text-align:center"><div style="font-size:.82rem;font-weight:700;color:var(--text)">' + value + '</div><div style="font-size:.58rem;color:var(--muted)">' + title + '</div><div style="font-size:.52rem;color:var(--brand)">' + sub + '</div></div>';
}


/* ═══════════════════════════════════════════
 * 함수 10-12: 의견 추가, 내보내기
 * ═══════════════════════════════════════════ */

function _addComment() {
  const reviewer = document.getElementById('rv-reviewer').value.trim() || 'Reviewer';
  const text = document.getElementById('rv-comment-text').value.trim();
  const category = document.getElementById('rv-comment-cat').value;
  if (!text) return;

  const comments = _state.get('review.externalAnnotations') || [];
  comments.push({ reviewer, text, category, status: 'open', timestamp: new Date().toISOString() });
  _state.set('review.externalAnnotations', comments);
  document.getElementById('rv-comment-text').value = '';

  bus.emit(EVT.REVIEW_RECEIVED, { count: comments.length });
  activate(); /* UI 갱신 */
}

function exportRebuttal(rv) {
  const rebuttals = rv.rebuttal || [];
  const comments = rv.externalAnnotations || [];
  const meta = _state.get('meta') || {};

  let md = '# Response to Reviewers\n\n';
  md += '**Paper:** ' + (meta.title || '') + '\n';
  md += '**Date:** ' + new Date().toISOString().split('T')[0] + '\n\n---\n\n';

  comments.forEach((c, i) => {
    const rebuttal = rebuttals.find(r => r.commentId === i);
    md += '## ' + (c.reviewer || 'Reviewer') + ' - Comment ' + (i + 1) + '\n\n';
    md += '> ' + (c.text || '') + '\n\n';
    md += '**Response:** ' + (rebuttal ? rebuttal.response : '[TODO]') + '\n\n---\n\n';
  });

  const blob = new Blob([md], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'response-to-reviewers.md';
  a.click();
}


/* ═══════════════════════════════════════════ */

function _showResult(html) {
  const el = document.getElementById('rv-results');
  if (el) el.innerHTML = html;
}
