/**
 * plan.js -- Phase 2: 논증 설계 (완전 구현)
 *
 * Claude+Codex 합의 함수 목록:
 *  1. generateOutline()        -- RQ + venue에서 아웃라인 자동 생성
 *  2. addOutlineSection()      -- 수동 섹션 추가
 *  3. reorderOutline()         -- 아웃라인 순서 변경
 *  4. buildToulminMap()        -- Toulmin 논증 구조 매핑
 *  5. addArgument()            -- 논증 추가
 *  6. designExperimentMatrix() -- 실험 설계 매트릭스
 *  7. setMilestones()          -- 일정 역산
 *  8. estimateScope()          -- 분량 예측
 *  9. validatePlanCompleteness() -- 계획 완성도 검증
 * 10. exportPlanDoc()          -- 계획서 내보내기
 */

import { bus, EVT } from '../../core/event-bus.js';
import { escHtml, estimatePages } from '../../shared/ui.js';

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
  const p = _state.get('plan') || {};
  const outline = (p.outline || []).length;
  const args = (p.argumentMap || []).length;
  const exp = p.experimentDesign?.variables?.length || 0;
  const progress = Math.min(100, outline * 10 + args * 8 + exp * 5);
  return { progress, summary: `${outline}섹션, ${args}논증, ${exp}변수` };
}

function _buildUI() {
  const p = _state.get('plan') || {};
  const outline = p.outline || [];
  const args = p.argumentMap || [];
  const rqs = _state.get('research.researchQuestions') || [];
  const milestones = p.milestones || [];

  return `
    <div style="display:flex;height:100%;overflow:hidden">
      <!-- 좌측: 도구 -->
      <div style="width:280px;border-right:1px solid var(--line);overflow-y:auto;padding:12px;background:var(--surface);flex-shrink:0">
        <h2 style="font-size:.88rem;color:var(--brand);margin-bottom:12px">논증 설계</h2>

        <div style="display:flex;flex-direction:column;gap:4px">
          <button class="bt p pl-action" data-action="autoOutline">아웃라인 자동 생성</button>
          <button class="bt pl-action" data-action="addSection">섹션 수동 추가</button>
          <button class="bt pl-action" data-action="addArgument">논증 추가 (Toulmin)</button>
          <button class="bt pl-action" data-action="experiment">실험 설계 매트릭스</button>
          <button class="bt pl-action" data-action="milestones">일정 역산</button>
          <button class="bt pl-action" data-action="estimate">분량 예측</button>
          <button class="bt pl-action" data-action="validate">계획 완성도 검증</button>
          <button class="bt pl-action" data-action="export">계획서 내보내기</button>
        </div>

        <!-- RQ 참조 -->
        ${rqs.length ? '<div style="margin-top:16px"><b style="font-size:.68rem;color:var(--text)">연구 질문 (Phase 1)</b>' +
          rqs.map(rq => '<div style="font-size:.6rem;padding:3px 6px;border-left:2px solid var(--brand);margin:3px 0">' + rq.id + ': ' + escHtml(rq.text.substring(0, 60)) + '</div>').join('') + '</div>' : ''}
      </div>

      <!-- 우측: 결과 -->
      <div id="pl-results" style="flex:1;overflow-y:auto;padding:20px 24px;background:var(--bg)">
        ${_buildPlanView(outline, args, milestones)}
      </div>
    </div>
  `;
}

function _setupHandlers() {
  document.querySelectorAll('.pl-action[data-action]').forEach(btn => {
    btn.addEventListener('click', () => _handleAction(btn.dataset.action));
  });
}

function _handleAction(action) {
  switch (action) {
    case 'autoOutline': _autoOutline(); break;
    case 'addSection': _addSection(); break;
    case 'addArgument': _addArgument(); break;
    case 'experiment': _showResult(_designExperiment()); break;
    case 'milestones': _setMilestones(); break;
    case 'estimate': _showResult(_estimateScope()); break;
    case 'validate': _showResult(_validatePlan()); break;
    case 'export': _exportPlan(); break;
  }
}


/* ═══════════════════════════════════════════
 * 함수 1: generateOutline -- 자동 아웃라인 생성
 * ═══════════════════════════════════════════ */

function _autoOutline() {
  const venue = _state.get('meta.venue') || _state.get('meta.venueTemplate') || '';
  const rqs = _state.get('research.researchQuestions') || [];
  const domain = _state.get('meta.domain') || '';

  /* 학회별 표준 구조 */
  const structures = {
    security: [
      { title: 'Introduction', level: 0, notes: '연구 동기 + RQ + 기여' },
      { title: 'Background', level: 0, notes: '배경 지식 + 선행 연구' },
      { title: 'Threat Model', level: 0, notes: '자산, 공격자, 가정' },
      { title: 'Methodology', level: 0, notes: '제안 방법' },
      { title: 'Implementation', level: 0, notes: '구현 세부' },
      { title: 'Evaluation', level: 0, notes: '실험 설계 + 결과' },
      { title: 'Discussion', level: 0, notes: '한계 + 시사점' },
      { title: 'Related Work', level: 0, notes: '관련 연구 비교' },
      { title: 'Conclusion', level: 0, notes: '요약 + 향후 연구' },
    ],
    general: [
      { title: 'Introduction', level: 0, notes: '연구 동기 + RQ' },
      { title: 'Related Work', level: 0, notes: '선행 연구' },
      { title: 'Methodology', level: 0, notes: '제안 방법' },
      { title: 'Results', level: 0, notes: '실험 결과' },
      { title: 'Discussion', level: 0, notes: '논의' },
      { title: 'Conclusion', level: 0, notes: '결론' },
    ],
    kci: [
      { title: '서론', level: 0, notes: '연구 배경, 목적, 구성' },
      { title: '이론적 배경', level: 0, notes: '관련 이론 및 선행 연구' },
      { title: '연구 방법', level: 0, notes: '연구 설계, 데이터, 분석 방법' },
      { title: '연구 결과', level: 0, notes: '분석 결과' },
      { title: '결론 및 제언', level: 0, notes: '요약, 시사점, 향후 과제' },
    ],
  };

  const isSecurity = /security|보안|adversarial|attack|threat/i.test(domain);
  const isKCI = /kci|국내|한국/i.test(venue);
  const template = isKCI ? structures.kci : isSecurity ? structures.security : structures.general;

  /* RQ를 Introduction 서브섹션으로 추가 */
  const outline = template.map((s, i) => ({
    id: 'sec-' + (i + 1),
    title: s.title,
    level: s.level,
    children: [],
    targetWords: 0,
    status: 'pending',
    notes: s.notes,
  }));

  /* RQ가 있으면 하위 섹션으로 매핑 */
  if (rqs.length && outline.length > 2) {
    rqs.forEach((rq, i) => {
      /* Methodology에 RQ별 서브섹션 추가 */
      const methodIdx = outline.findIndex(s => /method|방법/i.test(s.title));
      if (methodIdx >= 0) {
        outline.splice(methodIdx + 1 + i, 0, {
          id: 'sec-rq' + (i + 1),
          title: rq.id + ': ' + rq.text.substring(0, 40),
          level: 1,
          children: [],
          targetWords: 0,
          status: 'pending',
          notes: 'RQ에 대한 접근 방법',
        });
      }
    });
  }

  _state.set('plan.outline', outline);
  bus.emit(EVT.OUTLINE_UPDATED, {});
  activate(); /* UI 갱신 */
}


/* ═══════════════════════════════════════════
 * 함수 2-3: 섹션 관리
 * ═══════════════════════════════════════════ */

function _addSection() {
  const title = prompt('섹션 제목:');
  if (!title) return;
  const level = parseInt(prompt('레벨 (0=섹션, 1=소섹션):', '0')) || 0;
  const notes = prompt('비고 (선택):') || '';

  const outline = _state.get('plan.outline') || [];
  outline.push({
    id: 'sec-' + (outline.length + 1),
    title, level, children: [], targetWords: 0, status: 'pending', notes,
  });
  _state.set('plan.outline', outline);
  bus.emit(EVT.OUTLINE_UPDATED, {});
  activate();
}


/* ═══════════════════════════════════════════
 * 함수 4-5: Toulmin 논증
 * ═══════════════════════════════════════════ */

function _addArgument() {
  const claim = prompt('Claim (주장):');
  if (!claim) return;
  const evidence = prompt('Evidence (근거):') || '';
  const warrant = prompt('Warrant (보증 -- 근거가 주장을 어떻게 뒷받침하는가):') || '';
  const rebuttal = prompt('Rebuttal (반론 -- 예상되는 반박):') || '';
  const rqs = _state.get('research.researchQuestions') || [];
  const linkedRQ = rqs.length ? prompt('연결할 RQ (예: RQ1, 없으면 Enter):') : '';

  const args = _state.get('plan.argumentMap') || [];
  args.push({ claim, evidence, warrant, rebuttal, linkedRQ: linkedRQ || null });
  _state.set('plan.argumentMap', args);
  bus.emit(EVT.ARGUMENT_MAPPED, {});
  activate();
}


/* ═══════════════════════════════════════════
 * 함수 6: designExperimentMatrix -- 실험 설계
 * ═══════════════════════════════════════════ */

function _designExperiment() {
  const exp = _state.get('plan.experimentDesign') || { variables: [], conditions: [], metrics: [], datasets: [], baselines: [] };

  /* 대화식 입력 */
  const varInput = prompt('독립변수 (쉼표 구분):', (exp.variables || []).join(', '));
  if (varInput !== null) exp.variables = varInput.split(',').map(v => v.trim()).filter(Boolean);

  const metInput = prompt('평가 지표 (쉼표 구분):', (exp.metrics || []).join(', '));
  if (metInput !== null) exp.metrics = metInput.split(',').map(v => v.trim()).filter(Boolean);

  const dsInput = prompt('데이터셋 (쉼표 구분):', (exp.datasets || []).join(', '));
  if (dsInput !== null) exp.datasets = dsInput.split(',').map(v => v.trim()).filter(Boolean);

  const blInput = prompt('베이스라인 방법 (쉼표 구분):', (exp.baselines || []).join(', '));
  if (blInput !== null) exp.baselines = blInput.split(',').map(v => v.trim()).filter(Boolean);

  _state.set('plan.experimentDesign', exp);

  let html = '<div style="font-size:.82rem;font-weight:700;color:var(--brand);margin-bottom:8px">실험 설계 매트릭스</div>';

  if (exp.variables.length || exp.metrics.length) {
    html += '<table style="width:100%;font-size:.62rem;border-collapse:collapse;margin:8px 0">';
    html += '<tr style="background:var(--surface)"><th style="padding:3px 6px;text-align:left">구분</th><th>항목</th></tr>';
    html += '<tr><td style="padding:3px 6px;font-weight:600">독립변수</td><td>' + escHtml(exp.variables.join(', ') || '-') + '</td></tr>';
    html += '<tr><td style="padding:3px 6px;font-weight:600">평가지표</td><td>' + escHtml(exp.metrics.join(', ') || '-') + '</td></tr>';
    html += '<tr><td style="padding:3px 6px;font-weight:600">데이터셋</td><td>' + escHtml(exp.datasets.join(', ') || '-') + '</td></tr>';
    html += '<tr><td style="padding:3px 6px;font-weight:600">베이스라인</td><td>' + escHtml(exp.baselines.join(', ') || '-') + '</td></tr>';
    html += '</table>';

    /* 실험 조합 수 */
    const combos = Math.max(1, exp.variables.length) * Math.max(1, exp.datasets.length) * Math.max(1, (exp.baselines.length + 1));
    html += '<div style="font-size:.65rem;color:var(--muted);margin-top:4px">예상 실험 조합: ' + combos + '개</div>';
  }

  return html;
}


/* ═══════════════════════════════════════════
 * 함수 7: setMilestones -- 일정 역산
 * ═══════════════════════════════════════════ */

function _setMilestones() {
  const deadline = prompt('투고 마감일 (YYYY-MM-DD):', _state.get('meta.deadline') || '');
  if (!deadline) return;

  _state.set('meta.deadline', deadline);
  const d = new Date(deadline);
  if (isNaN(d.getTime())) { alert('유효하지 않은 날짜입니다.'); return; }

  /* 역산: 마감일에서 각 phase 마감 계산 */
  const milestones = [
    { phase: 'Research', deadline: _addDays(d, -42).toISOString().split('T')[0], status: 'pending' },
    { phase: 'Plan', deadline: _addDays(d, -35).toISOString().split('T')[0], status: 'pending' },
    { phase: 'Draft (1차)', deadline: _addDays(d, -21).toISOString().split('T')[0], status: 'pending' },
    { phase: 'Refine', deadline: _addDays(d, -14).toISOString().split('T')[0], status: 'pending' },
    { phase: 'Review (내부)', deadline: _addDays(d, -7).toISOString().split('T')[0], status: 'pending' },
    { phase: 'Submit', deadline: deadline, status: 'pending' },
  ];

  _state.set('plan.milestones', milestones);
  activate();
}


/* ═══════════════════════════════════════════
 * 함수 8-9: 분량 예측, 완성도 검증
 * ═══════════════════════════════════════════ */

function _estimateScope() {
  const outline = _state.get('plan.outline') || [];
  const venue = _state.get('meta.venueTemplate') || '';

  /* 섹션당 예상 단어수 */
  const sectionWords = { 'Introduction': 800, 'Related Work': 600, 'Methodology': 1000, 'Evaluation': 1200, 'Discussion': 500, 'Conclusion': 400, 'Threat Model': 400, '서론': 600, '연구 방법': 800, '연구 결과': 1000, '결론': 400 };
  let totalWords = 0;
  const breakdown = outline.map(s => {
    const est = sectionWords[s.title] || (s.level === 0 ? 500 : 300);
    totalWords += est;
    return { title: s.title, words: est };
  });

  const pages = estimatePages(totalWords, '', venue);

  let html = '<div style="font-size:.82rem;font-weight:700;color:var(--brand);margin-bottom:8px">분량 예측</div>';
  html += '<div style="font-size:.72rem;margin-bottom:8px">예상 총 단어수: <b>' + totalWords + '</b> | 예상 페이지: <b>' + pages + '</b></div>';

  html += '<table style="width:100%;font-size:.62rem;border-collapse:collapse"><tr style="background:var(--surface)"><th style="padding:3px 6px;text-align:left">섹션</th><th>예상 단어</th><th>비중</th></tr>';
  breakdown.forEach(s => {
    const pct = Math.round(s.words / totalWords * 100);
    html += '<tr><td style="padding:3px 6px">' + escHtml(s.title) + '</td><td style="text-align:center">' + s.words + '</td><td><div style="background:var(--brand);height:4px;width:' + pct + '%;border-radius:2px;display:inline-block;vertical-align:middle"></div> ' + pct + '%</td></tr>';
  });
  html += '</table>';

  _state.set('plan.estimatedPages', pages);
  return html;
}

function _validatePlan() {
  const outline = _state.get('plan.outline') || [];
  const args = _state.get('plan.argumentMap') || [];
  const exp = _state.get('plan.experimentDesign') || {};
  const rqs = _state.get('research.researchQuestions') || [];
  const milestones = _state.get('plan.milestones') || [];

  const checks = [
    { label: '아웃라인 존재', pass: outline.length >= 4, detail: outline.length + '개 섹션' },
    { label: '연구 질문 연결', pass: rqs.length > 0, detail: rqs.length + '개 RQ' },
    { label: '논증 구조', pass: args.length >= 1, detail: args.length + '개 논증' },
    { label: '실험 설계', pass: (exp.variables || []).length > 0, detail: (exp.variables || []).length + '개 변수' },
    { label: '일정 계획', pass: milestones.length > 0, detail: milestones.length + '개 마일스톤' },
    { label: '베이스라인 정의', pass: (exp.baselines || []).length > 0, detail: (exp.baselines || []).length + '개' },
    { label: '평가 지표 정의', pass: (exp.metrics || []).length > 0, detail: (exp.metrics || []).length + '개' },
  ];

  const passed = checks.filter(c => c.pass).length;
  const score = Math.round(passed / checks.length * 100);
  const color = score >= 80 ? 'var(--brand)' : score >= 50 ? 'var(--accent)' : '#b42318';

  let html = '<div style="text-align:center;padding:12px;margin-bottom:12px"><div style="font-size:1.5rem;font-weight:700;color:' + color + '">' + score + '%</div><div style="font-size:.72rem;color:var(--muted)">계획 완성도</div></div>';

  checks.forEach(c => {
    html += '<div style="font-size:.65rem;padding:3px 0">' + (c.pass ? '<span style="color:var(--brand)">[PASS]</span>' : '<span style="color:#b42318">[FAIL]</span>') + ' ' + c.label + ' <span style="color:var(--muted)">(' + c.detail + ')</span></div>';
  });

  return html;
}


/* ═══════════════════════════════════════════
 * 함수 10: exportPlanDoc
 * ═══════════════════════════════════════════ */

function _exportPlan() {
  const outline = _state.get('plan.outline') || [];
  const args = _state.get('plan.argumentMap') || [];
  const rqs = _state.get('research.researchQuestions') || [];
  const exp = _state.get('plan.experimentDesign') || {};

  let md = '# Research Plan\n\n';
  md += '## Research Questions\n\n';
  rqs.forEach(rq => { md += '- **' + rq.id + '**: ' + rq.text + '\n'; });

  md += '\n## Paper Outline\n\n';
  outline.forEach(s => { md += (s.level === 0 ? '## ' : '### ') + s.title + '\n'; if (s.notes) md += '> ' + s.notes + '\n\n'; });

  md += '\n## Argument Structure\n\n';
  args.forEach((a, i) => {
    md += '### Argument ' + (i + 1) + '\n';
    md += '- **Claim**: ' + a.claim + '\n';
    md += '- **Evidence**: ' + a.evidence + '\n';
    md += '- **Warrant**: ' + a.warrant + '\n';
    if (a.rebuttal) md += '- **Rebuttal**: ' + a.rebuttal + '\n';
    md += '\n';
  });

  md += '## Experiment Design\n\n';
  md += '- Variables: ' + (exp.variables || []).join(', ') + '\n';
  md += '- Metrics: ' + (exp.metrics || []).join(', ') + '\n';
  md += '- Datasets: ' + (exp.datasets || []).join(', ') + '\n';
  md += '- Baselines: ' + (exp.baselines || []).join(', ') + '\n';

  const blob = new Blob([md], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'research-plan.md';
  a.click();
}


/* ═══════════════════════════════════════════
 * 대시보드
 * ═══════════════════════════════════════════ */

function _buildPlanView(outline, args, milestones) {
  let html = '<div style="font-size:.82rem;font-weight:700;color:var(--brand);margin-bottom:12px">논증 설계 현황</div>';

  /* 아웃라인 */
  if (outline.length) {
    html += '<div style="font-size:.72rem;font-weight:700;color:var(--text);margin:8px 0 6px">아웃라인 (' + outline.length + '개)</div>';
    outline.forEach(s => {
      html += '<div style="font-size:.65rem;padding:3px ' + (s.level === 0 ? '8' : '20') + 'px;border-left:' + (s.level === 0 ? '3' : '2') + 'px solid ' + (s.level === 0 ? 'var(--brand)' : 'var(--line)') + ';margin:2px 0;background:var(--panel)">';
      html += (s.level === 0 ? '<b>' : '') + escHtml(s.title) + (s.level === 0 ? '</b>' : '');
      if (s.notes) html += ' <span style="color:var(--muted);font-size:.55rem">-- ' + escHtml(s.notes) + '</span>';
      html += '</div>';
    });
  }

  /* 논증 맵 */
  if (args.length) {
    html += '<div style="font-size:.72rem;font-weight:700;color:var(--text);margin:16px 0 6px">논증 구조 (' + args.length + '개)</div>';
    args.forEach((a, i) => {
      html += '<div style="padding:8px;border:1px solid var(--line);border-radius:6px;margin:4px 0;background:var(--panel);font-size:.62rem">';
      html += '<div style="font-weight:700;color:var(--brand)">Argument ' + (i + 1) + (a.linkedRQ ? ' [' + a.linkedRQ + ']' : '') + '</div>';
      html += '<div><b>Claim:</b> ' + escHtml(a.claim) + '</div>';
      html += '<div><b>Evidence:</b> ' + escHtml(a.evidence) + '</div>';
      html += '<div><b>Warrant:</b> ' + escHtml(a.warrant) + '</div>';
      if (a.rebuttal) html += '<div style="color:var(--accent)"><b>Rebuttal:</b> ' + escHtml(a.rebuttal) + '</div>';
      html += '</div>';
    });
  }

  /* 일정 */
  if (milestones.length) {
    html += '<div style="font-size:.72rem;font-weight:700;color:var(--text);margin:16px 0 6px">일정 마일스톤</div>';
    milestones.forEach(m => {
      const isPast = new Date(m.deadline) < new Date();
      html += '<div style="font-size:.62rem;padding:3px 8px;display:flex;justify-content:space-between;border-bottom:1px dotted var(--line)">';
      html += '<span>' + m.phase + '</span>';
      html += '<span style="color:' + (isPast ? '#b42318' : 'var(--brand)') + '">' + m.deadline + '</span>';
      html += '</div>';
    });
  }

  if (!outline.length && !args.length) {
    html += '<p style="color:var(--muted);font-size:.72rem;text-align:center;padding:20px">좌측에서 아웃라인 자동 생성 또는 논증 추가를 시작하세요.</p>';
  }

  return html;
}

function _addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }

function _showResult(html) {
  const el = document.getElementById('pl-results');
  if (el) el.innerHTML = html;
}
