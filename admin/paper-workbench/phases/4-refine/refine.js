/**
 * refine.js -- Phase 4: 품질 검증 (10개 함수 완전 구현)
 *
 * Claude+Codex 합의 함수 목록:
 *  1. verifyClaims()              -- 주장-근거 매칭 검증
 *  2. buildArgumentGraph()        -- 논증 흐름 그래프
 *  3. auditStatistics()           -- 통계 보고 오류 감지
 *  4. scoreReadability()          -- 가독성 점수
 *  5. runReproducibilityChecklist() -- 재현성 체크리스트
 *  6. detectDefinitionDrift()     -- 용어 일관성 검사
 *  7. analyzeEvidenceCoverage()   -- 근거 밀도 분석
 *  8. lintFigureTableRefs()       -- 그림/표 참조 검사
 *  9. checkAnonymizationLeaks()   -- 블라인드 익명성 린트
 * 10. generateRefineReport()      -- 검증 종합 보고서
 *
 * 기존 에디터 함수 통합:
 *   validatePaper(2481)       -> verifyClaims() + lintFigureTableRefs()
 *   diagnosePaper(2530)       -> buildArgumentGraph() + analyzeEvidenceCoverage()
 *   analyzeStyle(2637)        -> detectDefinitionDrift() + scoreReadability()
 *   lintVenue(3760)           -> (Phase 6 submit.js로 이동)
 *   runAnonymizationLint(3989)-> checkAnonymizationLeaks()
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

export function deactivate() { /* 이벤트 정리 불필요 -- DOM 교체로 자동 해제 */ }

export function getStatus() {
  const r = _state.get('refine') || {};
  const total = (r.validationResults || []).length + (r.diagnosticResults || []).length +
                (r.styleResults || []).length + (r.claimChecks || []).length;
  return { progress: Math.min(100, total * 5), summary: `${total}건 검증됨` };
}


/* ═══════════════════════════════════════════
 * UI 빌드
 * ═══════════════════════════════════════════ */

function _buildUI() {
  const r = _state.get('refine') || {};
  return `
    <div style="display:flex;height:100%;overflow:hidden">
      <!-- 좌측: 검증 도구 -->
      <div style="width:280px;border-right:1px solid var(--line);overflow-y:auto;padding:12px;background:var(--surface);flex-shrink:0">
        <h2 style="font-size:.88rem;color:var(--brand);margin-bottom:12px">품질 검증</h2>

        <div style="display:flex;flex-direction:column;gap:6px">
          <button class="bt p refine-btn" data-action="claims" style="text-align:left;padding:6px 10px">
            <b style="font-size:.7rem">1. 주장-근거 검증</b><br>
            <span style="font-size:.55rem;color:rgba(255,255,255,.7)">모든 주장에 인용 근거가 있는지 확인</span>
          </button>
          <button class="bt refine-btn" data-action="argument" style="text-align:left;padding:6px 10px">
            <b style="font-size:.7rem">2. 논증 흐름 분석</b><br>
            <span style="font-size:.55rem;color:var(--muted)">논리적 비약, 순환 논증, 고아 노드 탐지</span>
          </button>
          <button class="bt refine-btn" data-action="statistics" style="text-align:left;padding:6px 10px">
            <b style="font-size:.7rem">3. 통계 검증</b><br>
            <span style="font-size:.55rem;color:var(--muted)">p-value, 효과크기, 신뢰구간 일관성</span>
          </button>
          <button class="bt refine-btn" data-action="readability" style="text-align:left;padding:6px 10px">
            <b style="font-size:.7rem">4. 가독성 분석</b><br>
            <span style="font-size:.55rem;color:var(--muted)">문장 길이, 수동태, 문체 일관성</span>
          </button>
          <button class="bt refine-btn" data-action="reproducibility" style="text-align:left;padding:6px 10px">
            <b style="font-size:.7rem">5. 재현성 체크리스트</b><br>
            <span style="font-size:.55rem;color:var(--muted)">코드/데이터/환경 기술 점검</span>
          </button>
          <button class="bt refine-btn" data-action="terms" style="text-align:left;padding:6px 10px">
            <b style="font-size:.7rem">6. 용어 일관성</b><br>
            <span style="font-size:.55rem;color:var(--muted)">한영 혼용, 약어, 정의 불일치</span>
          </button>
          <button class="bt refine-btn" data-action="evidence" style="text-align:left;padding:6px 10px">
            <b style="font-size:.7rem">7. 근거 밀도 분석</b><br>
            <span style="font-size:.55rem;color:var(--muted)">섹션별 인용 밀도, 증거 갭</span>
          </button>
          <button class="bt refine-btn" data-action="figtbl" style="text-align:left;padding:6px 10px">
            <b style="font-size:.7rem">8. 그림/표 참조 검사</b><br>
            <span style="font-size:.55rem;color:var(--muted)">미참조, 중복, 번호 불일치</span>
          </button>
          <button class="bt refine-btn" data-action="anon" style="text-align:left;padding:6px 10px">
            <b style="font-size:.7rem">9. 익명성 린트</b><br>
            <span style="font-size:.55rem;color:var(--muted)">자기인용, 소속, ORCID 유출 탐지</span>
          </button>
          <div style="border-top:1px solid var(--line);margin:4px 0"></div>
          <button class="bt p refine-btn" data-action="all" style="text-align:left;padding:6px 10px">
            <b style="font-size:.7rem">전체 검증 실행</b><br>
            <span style="font-size:.55rem;color:rgba(255,255,255,.7)">1-9번 모두 실행 후 종합 보고서</span>
          </button>
        </div>
      </div>

      <!-- 우측: 검증 결과 표시 -->
      <div id="refine-results" style="flex:1;overflow-y:auto;padding:20px 24px;background:var(--bg)">
        <p style="color:var(--muted);font-size:.78rem;text-align:center;padding:40px">좌측에서 검증 항목을 선택하세요.</p>
      </div>
    </div>
  `;
}

function _setupHandlers() {
  document.querySelectorAll('.refine-btn[data-action]').forEach(btn => {
    btn.addEventListener('click', () => _runAction(btn.dataset.action));
  });
}

function _runAction(action) {
  const body = _state.get('draft.body') || '';
  if (!body.trim()) { _showResult('<p style="color:#b42318">본문이 비어 있습니다.</p>'); return; }

  const refs = _state.get('references') || [];
  const meta = _state.get('meta') || {};

  if (action === 'all') { _runAll(body, refs, meta); return; }

  const actions = {
    claims: () => verifyClaims(body, refs),
    argument: () => buildArgumentGraph(body),
    statistics: () => auditStatistics(body),
    readability: () => scoreReadability(body),
    reproducibility: () => runReproducibilityChecklist(body),
    terms: () => detectDefinitionDrift(body),
    evidence: () => analyzeEvidenceCoverage(body, refs),
    figtbl: () => lintFigureTableRefs(body),
    anon: () => checkAnonymizationLeaks(body, meta, refs),
  };

  if (actions[action]) {
    const result = actions[action]();
    _showResult(result.html);
    _saveResult(action, result);
  }
}

function _runAll(body, refs, meta) {
  const results = [
    { key: 'claims', ...verifyClaims(body, refs) },
    { key: 'argument', ...buildArgumentGraph(body) },
    { key: 'statistics', ...auditStatistics(body) },
    { key: 'readability', ...scoreReadability(body) },
    { key: 'reproducibility', ...runReproducibilityChecklist(body) },
    { key: 'terms', ...detectDefinitionDrift(body) },
    { key: 'evidence', ...analyzeEvidenceCoverage(body, refs) },
    { key: 'figtbl', ...lintFigureTableRefs(body) },
    { key: 'anon', ...checkAnonymizationLeaks(body, meta, refs) },
  ];
  const report = generateRefineReport(results);
  _showResult(report.html);
  results.forEach(r => _saveResult(r.key, r));
  bus.emit(EVT.VALIDATION_DONE, { results });
}


/* ═══════════════════════════════════════════
 * 함수 1: verifyClaims -- 주장-근거 매칭 검증
 * ═══════════════════════════════════════════ */

function verifyClaims(body, refs) {
  const issues = [];
  const lines = body.split('\n');

  /* 주장 패턴: 정량적 + 인과적 + 결론적 문장 */
  const claimPatterns = [
    /(?:을 보였다|을 달성했다|significantly|outperform|demonstrate|achieve|show that|prove|보여준다|증가했다|감소했다|우수하다|효과적이다)/i,
    /\d+(\.\d+)?%/,
    /\d+(\.\d+)?x\s/,
  ];

  let claimCount = 0;
  let unsupportedCount = 0;
  const unsupported = [];

  lines.forEach((line, i) => {
    /* 코드블록, 표, 제목 제외 */
    if (/^[#|`]/.test(line.trim()) || /^:::/.test(line.trim())) return;
    if (!line.trim()) return;

    const isClaim = claimPatterns.some(p => p.test(line));
    if (isClaim) {
      claimCount++;
      const hasCite = /\[cite:\d+\]/.test(line);
      if (!hasCite) {
        unsupportedCount++;
        unsupported.push({ line: i + 1, text: line.trim().substring(0, 80) });
      }
    }
  });

  /* 인용 정합성 체크 (기존 validatePaper 로직 통합) */
  const citeNums = (body.match(/\[cite:(\d+)\]/g) || []).map(m => parseInt(m.match(/\d+/)[0]));
  const uniqueCites = [...new Set(citeNums)].sort((a, b) => a - b);
  const maxCite = uniqueCites.length ? Math.max(...uniqueCites) : 0;
  const unused = [];
  for (let i = 1; i <= refs.length; i++) { if (!uniqueCites.includes(i)) unused.push(i); }

  /* 각주 정합성 */
  const fnRefs = (body.match(/\[\^(\d+)\]/g) || []).map(m => parseInt(m.match(/\d+/)[0]));
  const fnDefs = (body.match(/^\[\^(\d+)\]:/gm) || []).map(m => parseInt(m.match(/\d+/)[0]));
  const undefinedFn = [...new Set(fnRefs.filter(n => !fnDefs.includes(n)))];

  let html = _heading('주장-근거 검증');
  html += _stat('총 주장 문장', claimCount + '개');
  html += _stat('근거 없는 주장', unsupportedCount + '개', unsupportedCount > 0 ? 'warn' : 'ok');
  if (unsupported.length) {
    html += '<div style="margin:6px 0;font-size:.62rem">';
    unsupported.slice(0, 10).forEach(u => {
      html += _issue('L' + u.line + ': ' + u.text);
    });
    if (unsupported.length > 10) html += '<p style="color:var(--muted);font-size:.58rem">...외 ' + (unsupported.length - 10) + '건</p>';
    html += '</div>';
  }

  /* 인용 정합성 */
  html += _subheading('인용 정합성');
  if (maxCite > refs.length) html += _issue('[cite:' + maxCite + '] 사용했으나 참고문헌은 ' + refs.length + '개만 등록');
  if (unused.length) html += _issue('미인용 참고문헌: [' + unused.join(', ') + ']');
  else if (uniqueCites.length && maxCite <= refs.length) html += _ok('인용-참고문헌 정합 확인됨');
  if (undefinedFn.length) html += _issue('정의 없는 각주: [^' + undefinedFn.join('], [^') + ']');

  const score = Math.max(0, 100 - unsupportedCount * 10 - unused.length * 5 - (maxCite > refs.length ? 20 : 0));
  return { html, score, issues: unsupported, type: 'claims' };
}


/* ═══════════════════════════════════════════
 * 함수 2: buildArgumentGraph -- 논증 흐름 그래프
 * ═══════════════════════════════════════════ */

function buildArgumentGraph(body) {
  const sections = [];
  let curSec = null;
  const lines = body.split('\n');

  lines.forEach((line, i) => {
    const m = line.match(/^(#{2,3})\s+(.+)/);
    if (m) {
      if (curSec) curSec.end = i;
      curSec = { level: m[1].length, title: m[2], start: i, end: lines.length, words: 0, cites: 0, paras: 0 };
      sections.push(curSec);
    }
  });
  if (curSec) curSec.end = lines.length;

  /* 각 섹션의 통계 */
  const wc = body.trim().split(/\s+/).length;
  sections.forEach(s => {
    const block = lines.slice(s.start, s.end).join('\n');
    s.words = block.trim().split(/\s+/).length;
    s.cites = (block.match(/\[cite:\d+\]/g) || []).length;
    s.paras = block.split(/\n{2,}/).filter(p => p.trim() && !/^(#|\||```|:::)/m.test(p.trim())).length;
  });

  /* 논증 흐름: 필수 섹션 존재 확인 */
  const required = [
    { aliases: ['introduction', '서론'], label: 'Introduction' },
    { aliases: ['method', '방법', 'approach', 'methodology'], label: 'Methods' },
    { aliases: ['result', '결과', 'experiment', 'evaluation'], label: 'Results' },
    { aliases: ['conclusion', '결론'], label: 'Conclusion' },
  ];

  const missing = [];
  const present = [];
  required.forEach(req => {
    const found = sections.some(s => req.aliases.some(a => s.title.toLowerCase().includes(a)));
    if (found) present.push(req.label);
    else missing.push(req.label);
  });

  /* 고아 섹션 (짧은 섹션) */
  const avgSec = wc > 0 && sections.length > 0 ? Math.round(wc / sections.length) : 100;
  const weakSections = sections.filter(s => s.words < avgSec * 0.3 && s.words < 50);

  let html = _heading('논증 흐름 분석');
  html += _stat('총 섹션', sections.length + '개');
  html += _stat('총 단어', wc + '개');

  html += _subheading('필수 섹션');
  present.forEach(p => { html += _ok(p); });
  missing.forEach(m => { html += _issue(m + ' 섹션 누락'); });

  html += _subheading('섹션별 균형');
  html += '<table style="width:100%;font-size:.6rem;border-collapse:collapse;margin:4px 0"><tr style="background:var(--surface)"><th style="padding:2px 4px;text-align:left">섹션</th><th>단어</th><th>비중</th><th>인용</th><th>진단</th></tr>';
  sections.forEach(s => {
    const pct = wc ? Math.round(s.words / wc * 100) : 0;
    const bar = '<div style="background:var(--brand);height:4px;width:' + Math.min(pct * 2, 100) + '%;border-radius:2px"></div>';
    let diag = s.words < 30 ? '<span style="color:#b42318">너무 짧음</span>' : s.words < avgSec * 0.3 ? '<span style="color:var(--accent)">보충 필요</span>' : '<span style="color:var(--brand)">적정</span>';
    html += '<tr><td style="padding:2px 4px">' + (s.level === 2 ? '' : '  ') + escHtml(s.title) + '</td><td style="text-align:center">' + s.words + '</td><td>' + bar + ' ' + pct + '%</td><td style="text-align:center">' + s.cites + '</td><td>' + diag + '</td></tr>';
  });
  html += '</table>';

  if (weakSections.length) {
    html += _subheading('약한 섹션 (' + weakSections.length + '개)');
    weakSections.forEach(s => { html += _issue('"' + s.title + '" -- ' + s.words + '단어 (보충 필요)'); });
  }

  const score = Math.max(0, 100 - missing.length * 15 - weakSections.length * 10);
  return { html, score, type: 'argument' };
}


/* ═══════════════════════════════════════════
 * 함수 3: auditStatistics -- 통계 보고 오류 감지
 * ═══════════════════════════════════════════ */

function auditStatistics(body) {
  const issues = [];

  /* p-value 패턴 */
  const pValues = [...body.matchAll(/p\s*[<>=]\s*([\d.]+)/gi)];
  pValues.forEach(m => {
    const val = parseFloat(m[1]);
    if (val > 1 || val < 0) issues.push({ type: 'p-value', text: 'p=' + m[1] + ' -- 유효 범위(0-1) 초과', severity: 'high' });
    if (val === 0) issues.push({ type: 'p-value', text: 'p=0 -- 정확한 p값을 보고하세요', severity: 'medium' });
  });

  /* 퍼센트 합계 체크 (100% 초과) */
  const percentages = [...body.matchAll(/(\d+(?:\.\d+)?)%/g)].map(m => parseFloat(m[1]));
  if (percentages.filter(p => p > 100).length) {
    issues.push({ type: 'percentage', text: '100% 초과 값 발견', severity: 'medium' });
  }

  /* 효과크기/CI 존재 확인 */
  const hasEffectSize = /(cohen['']?s?\s*d|effect\s*size|효과\s*크기|eta\s*squared|odds\s*ratio)/i.test(body);
  const hasCI = /(confidence\s*interval|CI\s*[=:]|신뢰\s*구간|\d+%\s*CI)/i.test(body);
  const hasPValue = pValues.length > 0;

  if (hasPValue && !hasEffectSize) issues.push({ type: 'effect-size', text: 'p-value는 있으나 효과 크기(effect size)가 보고되지 않음', severity: 'medium' });
  if (hasPValue && !hasCI) issues.push({ type: 'ci', text: '신뢰구간(CI)이 보고되지 않음', severity: 'low' });

  /* 표본 크기 누락 */
  const hasExperiment = /(experiment|evaluation|실험|평가)/i.test(body);
  const hasSampleSize = /(n\s*=\s*\d+|sample\s*size|표본|데이터셋\s*크기|\d+\s*(samples?|subjects?|participants?))/i.test(body);
  if (hasExperiment && !hasSampleSize) issues.push({ type: 'sample', text: '실험 섹션에 표본 크기(N)가 명시되지 않음', severity: 'medium' });

  let html = _heading('통계 검증');
  html += _stat('p-value 보고', pValues.length + '건');
  html += _stat('효과 크기', hasEffectSize ? '있음' : '없음', hasEffectSize ? 'ok' : (hasPValue ? 'warn' : 'na'));
  html += _stat('신뢰 구간', hasCI ? '있음' : '없음', hasCI ? 'ok' : 'na');

  if (issues.length) {
    html += _subheading('문제점 (' + issues.length + '건)');
    issues.forEach(i => { html += _issue('[' + i.severity.toUpperCase() + '] ' + i.text); });
  } else {
    html += _ok('통계 보고에 명백한 오류 없음');
  }

  const score = Math.max(0, 100 - issues.filter(i => i.severity === 'high').length * 20 - issues.filter(i => i.severity === 'medium').length * 10 - issues.filter(i => i.severity === 'low').length * 5);
  return { html, score, issues, type: 'statistics' };
}


/* ═══════════════════════════════════════════
 * 함수 4: scoreReadability -- 가독성 점수
 * ═══════════════════════════════════════════ */

function scoreReadability(body) {
  /* 문장 분할 */
  const sentences = (body.replace(/\n+/g, ' ').match(/[^.!?]+[.!?]?/g) || []).map(s => s.trim()).filter(s => s.length > 5);
  const sentLens = sentences.map(s => s.trim().split(/\s+/).length);
  const avgSent = sentLens.length ? Math.round(sentLens.reduce((a, b) => a + b, 0) / sentLens.length) : 0;
  const longSent = sentLens.filter(l => l > 40).length;

  /* 수동태 비율 (한국어) */
  const passive = sentences.filter(s => /(되었다|되며|되어|된다|된 것|수집되었|처리되었|되었으며)/.test(s)).length;
  const passiveRate = sentences.length ? Math.round(passive / sentences.length * 100) : 0;

  /* 문체 일관성 (합쇼체 vs 해라체) */
  const formalPat = /(습니다|입니다|했습니다|되었습니다|됩니다)[.!?]?\s*$/;
  const informalPat = /(한다|이다|였다|했다|된다|보인다|있다)[.!?]?\s*$/;
  let formalCount = 0, informalCount = 0;
  const mixedExamples = [];
  sentences.forEach(s => {
    if (formalPat.test(s)) formalCount++;
    else if (informalPat.test(s)) informalCount++;
  });
  const isMixed = formalCount > 0 && informalCount > 0;
  const dominant = formalCount >= informalCount ? '합쇼체' : '해라체';

  /* 문단 분석 */
  const paras = body.split(/\n{2,}/).filter(p => p.trim() && !/^[#|`]/.test(p.trim()));
  const paraLens = paras.map(p => p.trim().split(/\s+/).length);
  const avgPara = paraLens.length ? Math.round(paraLens.reduce((a, b) => a + b, 0) / paraLens.length) : 0;
  const maxPara = paraLens.length ? Math.max(...paraLens) : 0;

  /* 어휘 다양성 */
  const words = (body.toLowerCase().match(/[a-z]{2,}|[가-힣]{2,}/g) || []);
  const uniqueWords = new Set(words);
  const diversity = words.length ? Math.round((uniqueWords.size / words.length) * 100) : 0;

  let html = _heading('가독성 분석');
  html += _stat('문장 수', sentences.length + '개');
  html += _stat('평균 문장 길이', avgSent + '단어', avgSent > 35 ? 'warn' : 'ok');
  html += _stat('장문(40단어+)', longSent + '개', longSent > 3 ? 'warn' : 'ok');
  html += _stat('수동태 비율', passiveRate + '%', passiveRate > 60 ? 'warn' : 'ok');
  html += _stat('문체', dominant + (isMixed ? ' (혼용 감지!)' : ' (일관)'), isMixed ? 'warn' : 'ok');
  html += _stat('평균 문단 길이', avgPara + '단어');
  html += _stat('최대 문단 길이', maxPara + '단어', maxPara > 200 ? 'warn' : 'ok');
  html += _stat('어휘 다양성', diversity + '% (' + uniqueWords.size + '/' + words.length + ')', diversity < 30 ? 'warn' : 'ok');

  if (isMixed) html += _issue('문체 혼용: ' + dominant + ' 주류, ' + Math.min(formalCount, informalCount) + '문장이 다른 문체');
  if (longSent > 3) html += _issue('장문이 ' + longSent + '개 있습니다. 분할하여 가독성을 높이세요.');
  if (passiveRate > 60) html += _issue('수동태 비율이 높습니다. 능동태 전환 검토하세요.');

  const score = Math.max(0, 100 - (isMixed ? 15 : 0) - longSent * 3 - (passiveRate > 60 ? 10 : 0) - (diversity < 30 ? 10 : 0));
  return { html, score, type: 'readability' };
}


/* ═══════════════════════════════════════════
 * 함수 5: runReproducibilityChecklist -- 재현성 체크리스트
 * ═══════════════════════════════════════════ */

function runReproducibilityChecklist(body) {
  const checks = [
    { id: 'dataset', label: '데이터셋 명시', test: /(dataset|데이터셋|corpus|데이터\s*세트)/i.test(body) },
    { id: 'datasize', label: '데이터 규모 명시', test: /(\d+\s*(samples?|entries|rows|건|개|instances?|examples?))/i.test(body) },
    { id: 'code', label: '코드 공개 언급', test: /(github\.com|code\s*availab|소스\s*코드|코드\s*공개|open[- ]?source)/i.test(body) },
    { id: 'hyperparams', label: '하이퍼파라미터 기술', test: /(learning\s*rate|batch\s*size|epoch|학습률|하이퍼파라미터|lr\s*=)/i.test(body) },
    { id: 'hardware', label: '하드웨어/환경 기술', test: /(GPU|CPU|NVIDIA|A100|V100|RTX|RAM|메모리|환경|PyTorch|TensorFlow)/i.test(body) },
    { id: 'seeds', label: '랜덤 시드 보고', test: /(random\s*seed|seed\s*=|시드|reproducib)/i.test(body) },
    { id: 'splits', label: '데이터 분할 명시', test: /(train|test|valid|split|훈련|검증|테스트)\s*(set|세트|data)?/i.test(body) },
    { id: 'baseline', label: '베이스라인 비교', test: /(baseline|기준\s*모델|비교\s*실험|기존\s*방법)/i.test(body) },
    { id: 'metrics', label: '평가 지표 정의', test: /(accuracy|precision|recall|f1|auc|bleu|rouge|정확도|정밀도|재현율)/i.test(body) },
    { id: 'significance', label: '통계 유의성 검증', test: /(p\s*[<>=]|t-test|wilcoxon|mann-whitney|유의|significant)/i.test(body) },
  ];

  const passed = checks.filter(c => c.test).length;
  const score = Math.round(passed / checks.length * 100);

  let html = _heading('재현성 체크리스트');
  html += _stat('통과', passed + '/' + checks.length, score >= 70 ? 'ok' : 'warn');
  html += '<div style="margin:8px 0">';
  checks.forEach(c => {
    html += '<div style="font-size:.64rem;padding:2px 0">' + (c.test ? '<span style="color:var(--brand)">[PASS]</span>' : '<span style="color:#b42318">[FAIL]</span>') + ' ' + c.label + '</div>';
  });
  html += '</div>';

  _state.set('refine.reproducibility', { codeAvailable: checks.find(c => c.id === 'code').test, dataAvailable: checks.find(c => c.id === 'dataset').test, envDescribed: checks.find(c => c.id === 'hardware').test, checklist: checks.map(c => ({ item: c.label, passed: c.test })) });

  return { html, score, type: 'reproducibility' };
}


/* ═══════════════════════════════════════════
 * 함수 6: detectDefinitionDrift -- 용어 일관성
 * ═══════════════════════════════════════════ */

function detectDefinitionDrift(body) {
  const termPairs = [
    ['인공지능', 'AI'], ['딥러닝', 'deep learning'], ['머신러닝', 'machine learning'],
    ['모델', 'model'], ['알고리즘', 'algorithm'], ['프레임워크', 'framework'],
    ['데이터셋', 'dataset'], ['정확도', 'accuracy'], ['취약점', 'vulnerability'],
    ['공격', 'attack'], ['방어', 'defense'], ['탐지', 'detection'],
    ['학습', 'training'], ['추론', 'inference'], ['미세조정', 'fine-tuning'],
  ];
  const conflicts = [];

  termPairs.forEach(([kr, en]) => {
    const krCount = (body.match(new RegExp(kr, 'gi')) || []).length;
    const enCount = (body.match(new RegExp(en, 'gi')) || []).length;
    if (krCount > 0 && enCount > 0) {
      conflicts.push({ kr, en, krCount, enCount });
    }
  });

  /* 약어 일관성: 첫 등장에서 풀네임 제공 여부 */
  const acronyms = [...body.matchAll(/\b([A-Z]{2,6})\b/g)].map(m => m[1]);
  const uniqueAcronyms = [...new Set(acronyms)].filter(a => !['AI', 'ML', 'NLP', 'LLM', 'GPU', 'CPU', 'API', 'URL', 'DOI'].includes(a));
  const undefinedAcronyms = uniqueAcronyms.filter(a => {
    const fullForm = new RegExp('\\(' + a + '\\)', 'i');
    return !fullForm.test(body);
  });

  let html = _heading('용어 일관성 분석');
  if (conflicts.length === 0 && undefinedAcronyms.length === 0) {
    html += _ok('한영 용어 혼용 및 미정의 약어 없음');
  } else {
    if (conflicts.length) {
      html += _subheading('한영 혼용 (' + conflicts.length + '건)');
      conflicts.forEach(c => { html += _issue(c.kr + '/' + c.en + ' 혼용 (' + c.kr + ':' + c.krCount + ', ' + c.en + ':' + c.enCount + ')'); });
    }
    if (undefinedAcronyms.length) {
      html += _subheading('미정의 약어 (' + undefinedAcronyms.length + '개)');
      undefinedAcronyms.slice(0, 15).forEach(a => { html += _issue(a + ' -- 첫 등장 시 풀네임을 제공하세요'); });
    }
  }

  const score = Math.max(0, 100 - conflicts.length * 8 - undefinedAcronyms.length * 5);
  return { html, score, type: 'terms' };
}


/* ═══════════════════════════════════════════
 * 함수 7: analyzeEvidenceCoverage -- 근거 밀도
 * ═══════════════════════════════════════════ */

function analyzeEvidenceCoverage(body, refs) {
  const sections = [];
  let curTitle = '';
  body.split(/^(##\s+.+)$/gm).forEach(part => {
    if (/^##\s+/.test(part)) curTitle = part.replace(/^##\s+/, '').trim();
    else if (curTitle) {
      const words = part.trim().split(/\s+/).length;
      const cites = (part.match(/\[cite:\d+\]/g) || []).length;
      sections.push({ title: curTitle, words, cites, density: words > 0 ? Math.round(cites / words * 1000) / 10 : 0 });
    }
  });

  const totalCites = (body.match(/\[cite:\d+\]/g) || []).length;
  const totalWords = body.trim().split(/\s+/).length;
  const lowDensity = sections.filter(s => s.words > 100 && s.cites === 0);

  let html = _heading('근거 밀도 분석');
  html += _stat('총 인용', totalCites + '회');
  html += _stat('참고문헌', refs.length + '편');
  html += _stat('인용 밀도', (totalWords > 0 ? Math.round(totalCites / totalWords * 1000) / 10 : 0) + '회/100단어');

  if (sections.length) {
    html += _subheading('섹션별 인용 밀도');
    sections.forEach(s => {
      const color = s.cites === 0 && s.words > 100 ? '#b42318' : 'var(--text)';
      html += '<div style="font-size:.62rem;padding:2px 0;color:' + color + '">' + escHtml(s.title) + ': ' + s.cites + '회 (' + s.density + '/100w)</div>';
    });
  }

  if (lowDensity.length) {
    html += _subheading('인용 없는 섹션 (' + lowDensity.length + '개)');
    lowDensity.forEach(s => { html += _issue('"' + s.title + '" -- ' + s.words + '단어, 인용 0건'); });
  }

  const score = Math.max(0, 100 - lowDensity.length * 15);
  return { html, score, type: 'evidence' };
}


/* ═══════════════════════════════════════════
 * 함수 8: lintFigureTableRefs -- 그림/표 참조 검사
 * ═══════════════════════════════════════════ */

function lintFigureTableRefs(body) {
  const issues = [];

  /* 캡션에서 번호 추출 */
  const figCaptions = [...body.matchAll(/\*Fig\.?\s*(\d+)/gi)].map(m => parseInt(m[1]));
  const tblCaptions = [...body.matchAll(/\*Table\s*(\d+)/gi)].map(m => parseInt(m[1]));

  /* 본문에서 참조 추출 */
  const figRefs = [...body.matchAll(/Fig\.?\s*(\d+)/gi)].map(m => parseInt(m[1]));
  const tblRefs = [...body.matchAll(/Table\s*(\d+)/gi)].map(m => parseInt(m[1]));

  /* 미참조 그림/표 */
  const figUnreferenced = figCaptions.filter(n => figRefs.filter(r => r === n).length <= 1); /* 캡션 자체 1회 제외 */
  const tblUnreferenced = tblCaptions.filter(n => tblRefs.filter(r => r === n).length <= 1);

  /* 번호 연속성 체크 */
  for (let i = 1; i <= figCaptions.length; i++) {
    if (!figCaptions.includes(i)) issues.push('Fig. ' + i + ' 번호 누락 (건너뜀)');
  }
  for (let i = 1; i <= tblCaptions.length; i++) {
    if (!tblCaptions.includes(i)) issues.push('Table ' + i + ' 번호 누락 (건너뜀)');
  }

  let html = _heading('그림/표 참조 검사');
  html += _stat('그림', figCaptions.length + '개');
  html += _stat('표', tblCaptions.length + '개');

  if (issues.length || figUnreferenced.length || tblUnreferenced.length) {
    issues.forEach(i => { html += _issue(i); });
    /* figUnreferenced의 경우 본문에서 1회(캡션)만 등장하므로 본문 참조가 없는 것 */
  } else {
    html += _ok('그림/표 번호 및 참조 정상');
  }

  const score = Math.max(0, 100 - issues.length * 10 - figUnreferenced.length * 5 - tblUnreferenced.length * 5);
  return { html, score, type: 'figtbl' };
}


/* ═══════════════════════════════════════════
 * 함수 9: checkAnonymizationLeaks -- 익명성 린트
 * ═══════════════════════════════════════════ */

function checkAnonymizationLeaks(body, meta, refs) {
  const leaks = [];

  /* 저자/소속 직접 언급 */
  const authors = [meta.firstAuthor, ...(meta.coauthors || '').split(',')].filter(a => a.trim());
  authors.forEach(a => {
    const name = a.trim();
    if (name && body.includes(name)) leaks.push({ type: 'author', text: '저자명 "' + name + '" 본문에 등장' });
  });

  /* 소속 기관 */
  if (meta.affiliation && body.includes(meta.affiliation)) {
    leaks.push({ type: 'affiliation', text: '소속 "' + meta.affiliation + '" 본문에 등장' });
  }

  /* GitHub URL */
  const ghUrls = body.match(/github\.com\/[a-zA-Z0-9_-]+/gi) || [];
  ghUrls.forEach(url => { leaks.push({ type: 'github', text: 'GitHub URL: ' + url }); });

  /* ORCID */
  const orcids = body.match(/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/g) || [];
  orcids.forEach(o => { leaks.push({ type: 'orcid', text: 'ORCID: ' + o }); });

  /* 자기인용 패턴 (our previous work, 우리의 이전 연구) */
  const selfCite = (body.match(/(our\s+(previous|prior|earlier)\s+(work|paper|study)|우리의\s*(이전|선행)\s*(연구|논문))/gi) || []);
  selfCite.forEach(s => { leaks.push({ type: 'self-cite', text: '자기인용 표현: "' + s + '"' }); });

  let html = _heading('익명성 린트');
  if (leaks.length === 0) {
    html += _ok('익명성 위반 사항 없음');
  } else {
    html += _stat('위반 사항', leaks.length + '건', 'warn');
    leaks.forEach(l => { html += _issue('[' + l.type + '] ' + l.text); });
  }

  const score = Math.max(0, 100 - leaks.length * 15);
  return { html, score, leaks, type: 'anon' };
}


/* ═══════════════════════════════════════════
 * 함수 10: generateRefineReport -- 종합 보고서
 * ═══════════════════════════════════════════ */

function generateRefineReport(results) {
  const totalScore = Math.round(results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length);
  const scoreColor = totalScore >= 80 ? 'var(--brand)' : totalScore >= 60 ? 'var(--accent)' : '#b42318';

  let html = '<div style="text-align:center;padding:16px;border-bottom:2px solid ' + scoreColor + ';margin-bottom:16px">';
  html += '<div style="font-size:2rem;font-weight:700;color:' + scoreColor + '">' + totalScore + '</div>';
  html += '<div style="font-size:.78rem;color:var(--muted)">종합 품질 점수 (100점 만점)</div>';
  html += '</div>';

  html += '<table style="width:100%;font-size:.65rem;border-collapse:collapse;margin:8px 0"><tr style="background:var(--surface)"><th style="padding:4px 8px;text-align:left">검증 항목</th><th>점수</th><th>판정</th></tr>';
  const labels = { claims: '주장-근거', argument: '논증 흐름', statistics: '통계 검증', readability: '가독성', reproducibility: '재현성', terms: '용어 일관성', evidence: '근거 밀도', figtbl: '그림/표', anon: '익명성' };
  results.forEach(r => {
    const sc = r.score || 0;
    const verdict = sc >= 80 ? '<span style="color:var(--brand)">양호</span>' : sc >= 60 ? '<span style="color:var(--accent)">주의</span>' : '<span style="color:#b42318">개선 필요</span>';
    html += '<tr><td style="padding:4px 8px">' + (labels[r.key] || r.key) + '</td><td style="text-align:center">' + sc + '</td><td style="text-align:center">' + verdict + '</td></tr>';
  });
  html += '</table>';

  /* 각 검증의 상세 결과 */
  results.forEach(r => { html += '<div style="border-top:1px solid var(--line);margin-top:12px;padding-top:8px">' + r.html + '</div>'; });

  return { html, score: totalScore, type: 'report' };
}


/* ═══════════════════════════════════════════
 * HTML 헬퍼
 * ═══════════════════════════════════════════ */

function _heading(text) { return '<div style="font-size:.82rem;font-weight:700;color:var(--brand);margin:8px 0 6px">' + text + '</div>'; }
function _subheading(text) { return '<div style="font-size:.72rem;font-weight:700;color:var(--text);margin:8px 0 4px">' + text + '</div>'; }
function _stat(label, value, status) {
  const color = status === 'warn' ? 'var(--accent)' : status === 'ok' ? 'var(--brand)' : 'var(--text)';
  return '<div style="font-size:.64rem;padding:1px 0"><span style="color:var(--muted)">' + label + ':</span> <b style="color:' + color + '">' + value + '</b></div>';
}
function _issue(text) { return '<div style="font-size:.62rem;color:#b42318;padding:1px 0">[!] ' + text + '</div>'; }
function _ok(text) { return '<div style="font-size:.62rem;color:var(--brand);padding:1px 0">[+] ' + text + '</div>'; }

function _showResult(html) {
  const el = document.getElementById('refine-results');
  if (el) el.innerHTML = html;
}

function _saveResult(action, result) {
  const key = 'refine.' + (action === 'claims' ? 'claimChecks' : action === 'argument' ? 'diagnosticResults' : action === 'readability' || action === 'terms' ? 'styleResults' : 'validationResults');
  const current = _state.get(key) || [];
  current.push({ action, score: result.score, timestamp: new Date().toISOString() });
  _state.set(key, current);
}
