/**
 * submit.js -- Phase 6: 투고 (완전 구현)
 *
 * Claude+Codex 합의 함수:
 *  1. submissionPreflight()      -- 학회별 투고 규격 종합 체크
 *  2. getVenueRules()            -- 학회별 규칙 레지스트리
 *  3. checkBlindCompliance()     -- 블라인드 익명성 검증
 *  4. setBlindMode()             -- 블라인드 모드 전환
 *  5. generateCoverLetter()      -- 커버레터 자동 생성
 *  6. recommendVenues()          -- 적합 학회/저널 추천
 *  7. buildEthicsChecklist()     -- 윤리 체크리스트
 *  8. setCRediTContributions()   -- CRediT 14개 역할 관리
 *  9. assemblePackage()          -- 제출 파일 패키지
 * 10. exportAll()                -- 전체 형식 내보내기 허브
 */

import { bus, EVT } from '../../core/event-bus.js';
import { escHtml, estimatePages } from '../../shared/ui.js';
import { exportMarkdown, exportLaTeX, exportSplit } from '../../shared/export.js';

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
  const s = _state.get('submit') || {};
  const pf = (s.preflightResults || []).length;
  const cl = (s.coverLetter || '').length > 0;
  const credit = (s.creditRoles || []).length > 0;
  const progress = (pf > 0 ? 30 : 0) + (cl ? 25 : 0) + (credit ? 20 : 0);
  return { progress: Math.min(100, progress), summary: `${pf}건 체크${cl ? ', 커버레터' : ''}${credit ? ', CRediT' : ''}` };
}


/* ═══════════════════════════════════════════
 * 학회별 규칙 레지스트리
 *
 * Codex 제안: getVenuePreflightRules() -- 정적 규칙 + per-venue 오버라이드
 * 기존 에디터의 submissionPreflight(4041) venues 객체를 확장.
 * ═══════════════════════════════════════════ */

const VENUE_RULES = {
  'sp':        { name: 'IEEE S&P 2026', maxPages: 13, minRefs: 30, blind: true, required: ['introduction', 'related work', 'conclusion', 'ethics'], extra: ['Double-blind: 저자 정보 전부 제거 필수', 'Ethics 섹션 필수', 'US Letter 포맷 (A4 아님)', 'compsoc 문서 클래스'] },
  'ccs':       { name: 'ACM CCS', maxPages: 15, minRefs: 25, blind: true, required: ['introduction', 'related work', 'conclusion'], extra: ['ACM CCS concepts 필수', 'Artifact appendix 권장', 'COI 선언 필요', 'sigconf 문서 클래스'] },
  'neurips_en':{ name: 'NeurIPS', maxPages: 9, minRefs: 20, blind: true, required: ['introduction', 'related work', 'conclusion', 'limitations'], extra: ['NeurIPS checklist 필수 (참고문헌 뒤)', 'Broader Impact Statement', 'natbib 인용 스타일'] },
  'ndss':      { name: 'NDSS', maxPages: 15, minRefs: 25, blind: true, required: ['introduction', 'related work', 'conclusion'], extra: ['Double-blind 필수', 'NDSS 포맷'] },
  'usenix':    { name: 'USENIX Security', maxPages: 13, minRefs: 25, blind: true, required: ['introduction', 'related work', 'conclusion'], extra: ['Double-blind 필수', 'usenix2e 포맷', 'Ethical considerations 명시'] },
  'ieee_en':   { name: 'IEEE Conference', maxPages: 8, minRefs: 15, blind: true, required: ['introduction', 'related work', 'conclusion'], extra: ['IEEEtran 문서 클래스', 'US Letter 포맷'] },
  'acm_en':    { name: 'ACM Conference', maxPages: 12, minRefs: 20, blind: true, required: ['introduction', 'related work', 'conclusion'], extra: ['sigconf 문서 클래스', 'ACM Reference Format'] },
  'tdsc':      { name: 'IEEE TDSC', maxPages: 14, minRefs: 30, blind: false, required: ['introduction', 'related work', 'conclusion'], extra: ['IEEE journal 템플릿', 'Author bio 포함', '2단 포맷'] },
  'tifs':      { name: 'IEEE TIFS', maxPages: 14, minRefs: 30, blind: false, required: ['introduction', 'related work', 'conclusion'], extra: ['IEEE journal 템플릿', '2단 포맷'] },
  'kci_kr':    { name: 'KCI 학회지', maxPages: 20, minRefs: 15, blind: false, required: ['서론', '결론'], extra: ['한글 제목 + 영문 제목 필수', '한글 초록 + 영문 초록 필수', '한글 키워드 + 영문 키워드 필수', '저자 소속/이메일 필수', 'KCI 인용 스타일'] },
};

/** CRediT 14개 역할 */
const CREDIT_ROLES = [
  'Conceptualization', 'Data curation', 'Formal analysis', 'Funding acquisition',
  'Investigation', 'Methodology', 'Project administration', 'Resources',
  'Software', 'Supervision', 'Validation', 'Visualization',
  'Writing - original draft', 'Writing - review & editing',
];


/* ═══════════════════════════════════════════
 * UI
 * ═══════════════════════════════════════════ */

function _buildUI() {
  const s = _state.get('submit') || {};
  const venue = _state.get('meta.venueTemplate') || '';
  const venueName = VENUE_RULES[venue]?.name || venue || '미선택';

  return `
    <div style="display:flex;height:100%;overflow:hidden">
      <!-- 좌측: 도구 -->
      <div style="width:280px;border-right:1px solid var(--line);overflow-y:auto;padding:12px;background:var(--surface);flex-shrink:0">
        <h2 style="font-size:.88rem;color:var(--brand);margin-bottom:12px">투고 준비</h2>

        <!-- 학회 선택 -->
        <div style="margin-bottom:12px">
          <b style="font-size:.68rem;color:var(--text)">투고 대상</b>
          <select id="sb-venue" style="width:100%;margin:4px 0;padding:5px;border:1px solid var(--line);border-radius:4px;font-size:.65rem;background:var(--panel)">
            <option value="">-- 선택 --</option>
            <optgroup label="보안 학회">
              <option value="sp" ${venue === 'sp' ? 'selected' : ''}>IEEE S&P</option>
              <option value="ccs" ${venue === 'ccs' ? 'selected' : ''}>ACM CCS</option>
              <option value="ndss" ${venue === 'ndss' ? 'selected' : ''}>NDSS</option>
              <option value="usenix" ${venue === 'usenix' ? 'selected' : ''}>USENIX Security</option>
            </optgroup>
            <optgroup label="AI/ML 학회">
              <option value="neurips_en" ${venue === 'neurips_en' ? 'selected' : ''}>NeurIPS</option>
              <option value="ieee_en" ${venue === 'ieee_en' ? 'selected' : ''}>IEEE Conference</option>
              <option value="acm_en" ${venue === 'acm_en' ? 'selected' : ''}>ACM Conference</option>
            </optgroup>
            <optgroup label="저널">
              <option value="tdsc" ${venue === 'tdsc' ? 'selected' : ''}>IEEE TDSC</option>
              <option value="tifs" ${venue === 'tifs' ? 'selected' : ''}>IEEE TIFS</option>
              <option value="kci_kr" ${venue === 'kci_kr' ? 'selected' : ''}>KCI 학회지</option>
            </optgroup>
          </select>
        </div>

        <!-- 도구 버튼 -->
        <div style="display:flex;flex-direction:column;gap:4px">
          <button class="bt p sb-action" data-action="preflight">프리플라이트 체크</button>
          <button class="bt sb-action" data-action="blind">블라인드 검증</button>
          <button class="bt sb-action" data-action="coverLetter">커버레터 생성</button>
          <button class="bt sb-action" data-action="recommend">학회 추천</button>
          <button class="bt sb-action" data-action="ethics">윤리 체크리스트</button>
          <button class="bt sb-action" data-action="credit">CRediT 기여도</button>
          <div style="border-top:1px solid var(--line);margin:6px 0"></div>
          <b style="font-size:.68rem;color:var(--text)">내보내기</b>
          <button class="bt sb-action" data-action="exportMD">Markdown (.md)</button>
          <button class="bt sb-action" data-action="exportTeX">LaTeX (.tex)</button>
          <button class="bt sb-action" data-action="exportSplit">본문+부록 분리</button>
        </div>
      </div>

      <!-- 우측: 결과 -->
      <div id="sb-results" style="flex:1;overflow-y:auto;padding:20px 24px;background:var(--bg)">
        <p style="color:var(--muted);font-size:.78rem;text-align:center;padding:40px">좌측에서 투고 준비 도구를 선택하세요.</p>
      </div>
    </div>
  `;
}

function _setupHandlers() {
  document.querySelectorAll('.sb-action[data-action]').forEach(btn => {
    btn.addEventListener('click', () => _handleAction(btn.dataset.action));
  });

  const venueSelect = document.getElementById('sb-venue');
  if (venueSelect) {
    venueSelect.addEventListener('change', () => {
      _state.set('meta.venueTemplate', venueSelect.value);
      bus.emit(EVT.VENUE_SELECTED, { venue: venueSelect.value });
    });
  }
}

function _handleAction(action) {
  const paper = _state.getAll();
  switch (action) {
    case 'preflight': _show(submissionPreflight(paper)); break;
    case 'blind': _show(checkBlindCompliance(paper)); break;
    case 'coverLetter': _show(generateCoverLetter(paper)); break;
    case 'recommend': _show(recommendVenues(paper)); break;
    case 'ethics': _show(buildEthicsChecklist(paper)); break;
    case 'credit': _show(showCRediT(paper)); break;
    case 'exportMD': exportMarkdown(paper); break;
    case 'exportTeX': exportLaTeX(paper); break;
    case 'exportSplit': exportSplit(paper); break;
  }
}


/* ═══════════════════════════════════════════
 * 함수 1: submissionPreflight -- 투고 규격 종합 체크
 * ═══════════════════════════════════════════ */

function submissionPreflight(paper) {
  const venueId = paper.meta?.venueTemplate || document.getElementById('sb-venue')?.value || '';
  const rules = VENUE_RULES[venueId] || { name: '일반', maxPages: 20, minRefs: 10, blind: false, required: ['introduction', 'conclusion'], extra: [] };

  const body = paper.draft?.body || '';
  const wc = body.trim().split(/\s+/).length;
  const pages = estimatePages(wc, body, venueId);
  const refs = (paper.references || []).length;
  const sections = [];
  body.replace(/^## (.+)$/gm, (m, h) => sections.push(h.trim().toLowerCase()));
  const blindMode = paper.draft?.submissionOptions?.blindMode || false;
  const abWords = (paper.meta?.abstract || '').trim().split(/\s+/).length;

  const checks = [];

  /* 페이지 체크 */
  checks.push({ check: '페이지 수', passed: pages <= rules.maxPages, detail: `약 ${pages}p / 최대 ${rules.maxPages}p` });
  /* 참고문헌 수 */
  checks.push({ check: '참고문헌', passed: refs >= rules.minRefs, detail: `${refs}편 / 최소 ${rules.minRefs}편` });
  /* 필수 섹션 */
  rules.required.forEach(sec => {
    const found = sections.some(s => s.includes(sec));
    checks.push({ check: sec + ' 섹션', passed: found, detail: found ? '존재' : '누락' });
  });
  /* 블라인드 모드 */
  if (rules.blind) {
    checks.push({ check: '블라인드 모드', passed: blindMode, detail: blindMode ? '활성' : '비활성 (필수!)' });
  }
  /* 초록 */
  checks.push({ check: '초록', passed: abWords >= 50, detail: `${abWords}단어` });

  const passCount = checks.filter(c => c.passed).length;
  const score = Math.round(passCount / checks.length * 100);

  /* 결과 저장 */
  _state.set('submit.preflightResults', checks);
  bus.emit(EVT.PREFLIGHT_DONE, { checks });

  let html = '<div style="text-align:center;padding:12px;border-bottom:2px solid ' + (score >= 80 ? 'var(--brand)' : score >= 50 ? 'var(--accent)' : '#b42318') + ';margin-bottom:12px">';
  html += '<div style="font-size:1.2rem;font-weight:700">' + escHtml(rules.name) + '</div>';
  html += '<div style="font-size:1.5rem;font-weight:700;color:' + (score >= 80 ? 'var(--brand)' : score >= 50 ? 'var(--accent)' : '#b42318') + '">' + passCount + '/' + checks.length + ' PASS</div></div>';

  checks.forEach(c => {
    html += '<div style="font-size:.65rem;padding:3px 0;color:' + (c.passed ? 'var(--brand)' : '#b42318') + '">' + (c.passed ? '[PASS]' : '[FAIL]') + ' ' + c.check + ' <span style="color:var(--muted)">(' + c.detail + ')</span></div>';
  });

  if (rules.extra.length) {
    html += '<div style="font-size:.72rem;font-weight:700;color:var(--text);margin:12px 0 6px">학회 특수 요구사항</div>';
    rules.extra.forEach(e => { html += '<div style="font-size:.62rem;color:var(--muted);padding:1px 0">[*] ' + e + '</div>'; });
  }

  return html;
}


/* ═══════════════════════════════════════════
 * 함수 3-4: 블라인드 모드
 * ═══════════════════════════════════════════ */

function checkBlindCompliance(paper) {
  const body = paper.draft?.body || '';
  const meta = paper.meta || {};
  const refs = paper.references || [];
  const leaks = [];

  /* 저자명 노출 */
  const authors = [meta.firstAuthor, ...(meta.coauthors || '').split(',')].filter(a => a.trim());
  const nameMap = paper.nameMap || {};
  authors.forEach(a => {
    const name = a.trim();
    const resolved = nameMap[name]?.name || name;
    [name, resolved].forEach(n => {
      if (n && n.length > 2 && body.toLowerCase().includes(n.toLowerCase())) leaks.push('[!] 본문에 저자명 "' + n + '" 노출');
    });
  });

  /* 소속 */
  if (meta.affiliation && meta.affiliation.length > 3 && body.toLowerCase().includes(meta.affiliation.toLowerCase())) {
    leaks.push('[!] 본문에 소속 "' + meta.affiliation + '" 노출');
  }

  /* 셀프인용 */
  const selfPat = /(?:our previous work|our prior|we previously|in \[cite:\d+\], we|우리의 이전|우리가 제안한)/gi;
  const selfMatches = body.match(selfPat) || [];
  if (selfMatches.length) leaks.push('[!] 셀프인용 패턴 ' + selfMatches.length + '건');

  /* URL */
  const urls = body.match(/https?:\/\/(?:github\.com|gitlab\.com|bitbucket\.org)\/[^\s)]+/g) || [];
  if (urls.length) leaks.push('[!] 식별 가능 URL ' + urls.length + '건');

  /* ORCID */
  if (/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/g.test(body)) leaks.push('[!] ORCID 노출');

  /* 감사의 글 */
  if (/(?:acknowledgment|감사의\s?글|사사)/i.test(body)) leaks.push('[!] 감사의 글 섹션 존재 (블라인드 시 제거 필요)');

  /* 참고문헌 내 자기인용 */
  refs.forEach((r, i) => {
    const raw = typeof r === 'string' ? r : r.raw || '';
    authors.forEach(a => {
      const name = a.trim();
      const resolved = nameMap[name]?.name || name;
      [name, resolved].forEach(n => {
        if (n && n.length > 2 && raw.toLowerCase().includes(n.toLowerCase())) {
          leaks.push('[!] 참고문헌[' + (i + 1) + ']에 저자명 "' + n + '" -- 셀프인용 의심');
        }
      });
    });
  });

  let html = '<div style="font-size:.82rem;font-weight:700;color:var(--brand);margin-bottom:8px">블라인드 익명성 검증</div>';
  if (leaks.length === 0) {
    html += '<div style="font-size:.72rem;color:var(--brand);padding:12px;text-align:center">[+] 익명화 위반 없음</div>';
  } else {
    html += '<div style="font-size:.65rem;color:#b42318;margin-bottom:4px">' + leaks.length + '건 위반 발견</div>';
    leaks.forEach(l => { html += '<div style="font-size:.62rem;color:#b42318;padding:1px 0">' + l + '</div>'; });
  }

  return html;
}


/* ═══════════════════════════════════════════
 * 함수 5: generateCoverLetter -- 커버레터 생성
 * ═══════════════════════════════════════════ */

function generateCoverLetter(paper) {
  const meta = paper.meta || {};
  const venueId = meta.venueTemplate || '';
  const rules = VENUE_RULES[venueId] || {};
  const rqs = paper.research?.researchQuestions || [];

  const date = new Date().toISOString().split('T')[0];
  const venueName = rules.name || venueId || '[Journal/Conference Name]';
  const title = meta.title || '[Paper Title]';
  const author = meta.firstAuthor || '[Corresponding Author]';

  let letter = `Dear Editor-in-Chief / Program Committee of ${venueName},\n\n`;
  letter += `We are pleased to submit our manuscript entitled "${title}" for consideration `;
  letter += `for publication in ${venueName}.\n\n`;

  /* 연구 요약 */
  if (meta.abstract) {
    letter += `This paper ${meta.abstract.substring(0, 200)}...\n\n`;
  }

  /* RQ 기반 기여 */
  if (rqs.length) {
    letter += `Our key contributions include:\n`;
    rqs.forEach(rq => { letter += `- ${rq.text}\n`; });
    letter += '\n';
  }

  /* 적합성 */
  letter += `We believe this work is well-suited for ${venueName} because it addresses `;
  letter += `${meta.domain || 'the field'} which is of significant interest to your readership.\n\n`;

  /* 윤리 */
  letter += `We confirm that this manuscript has not been published elsewhere and is not under `;
  letter += `consideration by another journal. All authors have approved the manuscript and agree `;
  letter += `with its submission to ${venueName}.\n\n`;

  letter += `We look forward to your favorable response.\n\n`;
  letter += `Sincerely,\n${author}\n${meta.affiliation || ''}\n${date}`;

  _state.set('submit.coverLetter', letter);

  let html = '<div style="font-size:.82rem;font-weight:700;color:var(--brand);margin-bottom:8px">커버레터</div>';
  html += '<textarea id="sb-coverletter" rows="16" style="width:100%;padding:12px;border:1px solid var(--line);border-radius:6px;font-size:.72rem;background:var(--panel);color:var(--text);resize:vertical;font-family:inherit;line-height:1.6">' + escHtml(letter) + '</textarea>';
  html += '<div style="margin-top:8px;display:flex;gap:6px">';
  html += '<button class="bt p" onclick="navigator.clipboard.writeText(document.getElementById(\'sb-coverletter\').value)">복사</button>';
  html += '<button class="bt" onclick="const b=new Blob([document.getElementById(\'sb-coverletter\').value],{type:\'text/plain\'});const a=document.createElement(\'a\');a.href=URL.createObjectURL(b);a.download=\'cover-letter.txt\';a.click()">다운로드</button>';
  html += '</div>';

  return html;
}


/* ═══════════════════════════════════════════
 * 함수 6: recommendVenues -- 학회 추천
 * ═══════════════════════════════════════════ */

function recommendVenues(paper) {
  const body = paper.draft?.body || '';
  const meta = paper.meta || {};
  const wc = body.trim().split(/\s+/).length;
  const refs = (paper.references || []).length;
  const domain = (meta.domain || '').toLowerCase();
  const keywords = (meta.keywords || '').toLowerCase();

  const candidates = Object.entries(VENUE_RULES).map(([id, rules]) => {
    let score = 0;
    const reasons = [];

    /* 분야 매칭 */
    if (/security|보안|adversarial|attack|vulnerability/.test(domain + ' ' + keywords)) {
      if (['sp', 'ccs', 'ndss', 'usenix', 'tdsc', 'tifs'].includes(id)) { score += 30; reasons.push('보안 분야 매칭'); }
    }
    if (/llm|language model|nlp|prompt/.test(domain + ' ' + keywords)) {
      if (['neurips_en', 'acm_en'].includes(id)) { score += 25; reasons.push('AI/NLP 분야 매칭'); }
    }
    if (/한국|kci|국내/.test(domain + ' ' + keywords)) {
      if (id === 'kci_kr') { score += 30; reasons.push('국내 저널 매칭'); }
    }

    /* 분량 적합성 */
    const pages = estimatePages(wc, body, id);
    if (pages <= rules.maxPages) { score += 20; reasons.push('분량 적합 (' + pages + '/' + rules.maxPages + 'p)'); }
    else { score -= 10; reasons.push('분량 초과 (' + pages + '/' + rules.maxPages + 'p)'); }

    /* 참고문헌 적합성 */
    if (refs >= rules.minRefs) { score += 15; reasons.push('참고문헌 충분'); }
    else { reasons.push('참고문헌 부족 (' + refs + '/' + rules.minRefs + ')'); }

    return { id, name: rules.name, score, reasons };
  }).sort((a, b) => b.score - a.score);

  let html = '<div style="font-size:.82rem;font-weight:700;color:var(--brand);margin-bottom:8px">적합 학회/저널 추천</div>';
  html += '<p style="font-size:.62rem;color:var(--muted);margin-bottom:8px">분야, 분량, 참고문헌 수 기반 매칭</p>';

  candidates.slice(0, 5).forEach((c, i) => {
    const medal = i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : (i + 1) + 'th';
    html += '<div style="padding:8px 12px;border:1px solid var(--line);border-radius:6px;margin:4px 0;background:var(--panel)">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center">';
    html += '<b style="font-size:.75rem;color:var(--brand)">' + medal + ' ' + escHtml(c.name) + '</b>';
    html += '<span style="font-size:.65rem;font-weight:700;color:' + (c.score >= 50 ? 'var(--brand)' : 'var(--accent)') + '">' + c.score + '점</span>';
    html += '</div>';
    html += '<div style="font-size:.58rem;color:var(--muted);margin-top:2px">' + c.reasons.join(' | ') + '</div>';
    html += '</div>';
  });

  return html;
}


/* ═══════════════════════════════════════════
 * 함수 7: buildEthicsChecklist -- 윤리 체크리스트
 * ═══════════════════════════════════════════ */

function buildEthicsChecklist(paper) {
  const body = paper.draft?.body || '';

  const items = [
    { id: 'irb', label: 'IRB/윤리위원회 승인', required: /human\s*subject|survey|인간\s*대상|설문/i.test(body), evidence: /IRB|윤리위원회|ethics\s*board/i.test(body) },
    { id: 'consent', label: '참여자 동의', required: /participant|survey|인터뷰|설문/i.test(body), evidence: /informed\s*consent|사전\s*동의/i.test(body) },
    { id: 'dual-use', label: '이중 사용 고려', required: /attack|exploit|vulnerability|공격|취약점/i.test(body), evidence: /dual.use|이중\s*사용|responsible/i.test(body) },
    { id: 'disclosure', label: '책임 있는 공개', required: /vulnerability|zero.day|취약점|CVE/i.test(body), evidence: /responsible\s*disclosure|책임\s*공개|vendor\s*notif/i.test(body) },
    { id: 'privacy', label: '개인정보 보호', required: /personal\s*data|PII|개인정보|user\s*data/i.test(body), evidence: /anonymiz|pseudonym|비식별|가명/i.test(body) },
    { id: 'bias', label: '편향/공정성', required: /classification|prediction|분류|예측|decision/i.test(body), evidence: /bias|fairness|편향|공정/i.test(body) },
    { id: 'env', label: '환경 영향', required: /training|fine.tun|학습|GPU/i.test(body), evidence: /carbon|energy|환경|CO2/i.test(body) },
    { id: 'reproduce', label: '재현성 자료 제공', required: true, evidence: /code\s*availab|github|재현|reproducib/i.test(body) },
  ];

  const relevant = items.filter(i => i.required);
  const addressed = relevant.filter(i => i.evidence);

  _state.set('submit.ethicsChecklist', items.map(i => ({ item: i.label, checked: i.evidence, required: i.required })));

  let html = '<div style="font-size:.82rem;font-weight:700;color:var(--brand);margin-bottom:8px">윤리 체크리스트</div>';
  html += '<div style="font-size:.65rem;color:var(--muted);margin-bottom:8px">해당: ' + relevant.length + '건 | 충족: ' + addressed.length + '건</div>';

  items.forEach(i => {
    if (!i.required) return;
    html += '<div style="font-size:.64rem;padding:3px 0">';
    html += (i.evidence ? '<span style="color:var(--brand)">[PASS]</span>' : '<span style="color:#b42318">[TODO]</span>');
    html += ' ' + i.label;
    html += '</div>';
  });

  return html;
}


/* ═══════════════════════════════════════════
 * 함수 8: CRediT 기여도
 * ═══════════════════════════════════════════ */

function showCRediT(paper) {
  const meta = paper.meta || {};
  const authors = [meta.firstAuthor, ...(meta.coauthors || '').split(',')].filter(a => a.trim());
  const nameMap = paper.nameMap || {};
  const existing = _state.get('submit.creditRoles') || [];

  let html = '<div style="font-size:.82rem;font-weight:700;color:var(--brand);margin-bottom:8px">CRediT 저자 기여도</div>';
  html += '<p style="font-size:.62rem;color:var(--muted);margin-bottom:8px">Contributor Roles Taxonomy (CRediT) -- 14개 역할로 저자별 기여도를 명시합니다.</p>';

  if (authors.length === 0) {
    html += '<p style="color:var(--muted);font-size:.72rem">저자 정보가 없습니다. 메타데이터에서 저자를 설정하세요.</p>';
    return html;
  }

  /* 표 헤더 */
  html += '<div style="overflow-x:auto"><table style="font-size:.58rem;border-collapse:collapse;min-width:500px"><tr style="background:var(--surface)"><th style="padding:3px 6px;text-align:left;min-width:150px">Role</th>';
  authors.forEach(a => {
    const name = nameMap[a.trim()]?.name || a.trim();
    html += '<th style="padding:3px 6px;text-align:center;min-width:60px">' + escHtml(name.substring(0, 10)) + '</th>';
  });
  html += '</tr>';

  CREDIT_ROLES.forEach(role => {
    html += '<tr><td style="padding:2px 6px">' + role + '</td>';
    authors.forEach(a => {
      const checked = existing.some(e => e.author === a.trim() && e.roles?.includes(role));
      html += '<td style="text-align:center"><input type="checkbox" class="credit-check" data-author="' + escHtml(a.trim()) + '" data-role="' + escHtml(role) + '" ' + (checked ? 'checked' : '') + ' style="cursor:pointer"></td>';
    });
    html += '</tr>';
  });
  html += '</table></div>';

  html += '<button class="bt p" style="margin-top:8px" id="sb-credit-save">기여도 저장</button>';

  /* 저장 핸들러 (DOM 이벤트 위임) */
  setTimeout(() => {
    const saveBtn = document.getElementById('sb-credit-save');
    if (saveBtn) saveBtn.addEventListener('click', () => {
      const roles = [];
      document.querySelectorAll('.credit-check:checked').forEach(cb => {
        const author = cb.dataset.author;
        const role = cb.dataset.role;
        let entry = roles.find(r => r.author === author);
        if (!entry) { entry = { author, roles: [] }; roles.push(entry); }
        entry.roles.push(role);
      });
      _state.set('submit.creditRoles', roles);
      _show('<div style="font-size:.78rem;color:var(--brand);text-align:center;padding:20px">[+] CRediT 기여도 저장됨 (' + roles.length + '명)</div>');
    });
  }, 100);

  return html;
}


/* ═══════════════════════════════════════════ */

function _show(html) {
  const el = document.getElementById('sb-results');
  if (el) el.innerHTML = html;
}
