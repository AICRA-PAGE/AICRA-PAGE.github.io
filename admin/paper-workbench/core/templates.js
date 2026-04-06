/**
 * templates.js -- Quick Start 템플릿 시스템
 *
 * 첫 방문 시 템플릿 선택 모달을 표시한다.
 * 4개 템플릿: 첫 논문 / 수정후재심 / 새 학회 투고 / 샘플 논문
 */

import { bus, EVT } from './event-bus.js';

let _state = null;
let _bus = null;
let _router = null;
let _modalEl = null;

/* ══════════════════════════════════════════
 * 템플릿 정의
 * ══════════════════════════════════════════ */

const TEMPLATES = [
  {
    id: 'first-paper',
    icon: '1',
    title: '처음 쓰는 논문',
    description: '논문 작성이 처음이신가요? 기본 아웃라인과 가이드를 제공합니다.',
    apply(state) {
      state.set('plan.outline', [
        { id: 'intro', title: '서론 (Introduction)', level: 1, targetWords: 800 },
        { id: 'related', title: '관련 연구 (Related Work)', level: 1, targetWords: 1200 },
        { id: 'method', title: '연구 방법 (Methodology)', level: 1, targetWords: 1500 },
        { id: 'results', title: '결과 (Results)', level: 1, targetWords: 1200 },
        { id: 'conclusion', title: '결론 (Conclusion)', level: 1, targetWords: 600 },
      ]);
      state.set('draft.body', [
        '# 서론',
        '',
        '<!-- TODO: 연구 배경과 동기를 기술하세요. 왜 이 주제가 중요한가? -->',
        '<!-- 마지막에 연구 질문(RQ)과 본 논문의 기여를 명시하세요. -->',
        '',
        '# 관련 연구',
        '',
        '<!-- TODO: 기존 연구를 분류하여 정리하세요. [cite:N] 형식으로 인용하세요. -->',
        '<!-- 기존 연구의 한계점(gap)을 명확히 하세요. -->',
        '',
        '# 연구 방법',
        '',
        '<!-- TODO: 연구 설계, 데이터 수집, 분석 방법을 기술하세요. -->',
        '<!-- 재현성을 위해 충분히 상세하게 작성하세요. -->',
        '',
        '# 결과',
        '',
        '<!-- TODO: 주요 발견을 기술하세요. 표와 그림을 활용하세요. -->',
        '',
        '# 결론',
        '',
        '<!-- TODO: 연구 질문에 대한 답변, 시사점, 한계, 향후 연구를 기술하세요. -->',
      ].join('\n'));
    },
    navigateTo: 'draft',
  },
  {
    id: 'revision',
    icon: '2',
    title: '수정후재심',
    description: '심사의견을 받았나요? 의견 분석과 수정 계획을 시작합니다.',
    apply(state) {
      state.set('meta.status', 'revision');
    },
    navigateTo: 'review',
  },
  {
    id: 'new-venue',
    icon: '3',
    title: '새 학회 투고',
    description: '기존 논문을 다른 학회/저널 규격에 맞게 조정합니다.',
    apply(state) {
      /* 투고 Phase로 이동하여 학회 선택부터 시작 */
    },
    navigateTo: 'submit',
  },
  {
    id: 'sample-paper',
    icon: '4',
    title: '샘플 논문으로 배우기',
    description: 'AI 보안 분야 샘플 논문으로 모든 기능을 체험합니다.',
    apply(state) {
      state.set('meta.title', 'Prompt Injection 공격의 분류와 방어: 체계적 문헌 고찰');
      state.set('meta.keywords', 'Prompt Injection, LLM Security, Adversarial Attack, Defense Mechanism');
      state.set('meta.domain', 'LLM Security');
      state.set('meta.language', 'ko');

      state.set('research.researchQuestions', [
        { id: 'RQ1', text: '프롬프트 인젝션 공격의 주요 유형과 분류 체계는 무엇인가?', type: 'descriptive', linkedGap: null },
        { id: 'RQ2', text: '기존 방어 기법의 효과성과 한계는 무엇인가?', type: 'comparative', linkedGap: null },
      ]);

      state.set('research.papers', [
        { id: 1, title: 'Not What You\'ve Signed Up For: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection', authors: 'Greshake, K. et al.', year: '2023', venue: 'AISec Workshop', citationCount: 287, refText: 'Greshake, K. et al. "Not What You\'ve Signed Up For." AISec, 2023.' },
        { id: 2, title: 'Ignore This Title and HackAPrompt: Exposing Systemic Weaknesses of LLMs', authors: 'Schulhoff, S. et al.', year: '2023', venue: 'EMNLP', citationCount: 142, refText: 'Schulhoff, S. et al. "Ignore This Title and HackAPrompt." EMNLP, 2023.' },
        { id: 3, title: 'Prompt Injection attack against LLM-integrated Applications', authors: 'Liu, Y. et al.', year: '2024', venue: 'arXiv', citationCount: 98, refText: 'Liu, Y. et al. "Prompt Injection attack against LLM-integrated Applications." arXiv, 2024.' },
        { id: 4, title: 'Jailbreaking ChatGPT via Prompt Engineering', authors: 'Li, Y. et al.', year: '2023', venue: 'arXiv', citationCount: 203, refText: 'Li, Y. et al. "Jailbreaking ChatGPT via Prompt Engineering." arXiv, 2023.' },
        { id: 5, title: 'Universal and Transferable Adversarial Attacks on Aligned Language Models', authors: 'Zou, A. et al.', year: '2023', venue: 'arXiv', citationCount: 412, refText: 'Zou, A. et al. "Universal and Transferable Adversarial Attacks on Aligned LMs." arXiv, 2023.' },
      ]);

      state.set('plan.outline', [
        { id: 'intro', title: '서론', level: 1 },
        { id: 'background', title: '배경 및 용어 정의', level: 1 },
        { id: 'taxonomy', title: '프롬프트 인젝션 공격 분류 체계', level: 1 },
        { id: 'tax-direct', title: '직접 인젝션 (Direct Injection)', level: 2 },
        { id: 'tax-indirect', title: '간접 인젝션 (Indirect Injection)', level: 2 },
        { id: 'tax-jailbreak', title: '탈옥 공격 (Jailbreak)', level: 2 },
        { id: 'defense', title: '방어 기법 분석', level: 1 },
        { id: 'discussion', title: '논의', level: 1 },
        { id: 'conclusion', title: '결론', level: 1 },
      ]);

      const sampleBody = `# 서론

대규모 언어 모델(LLM)이 다양한 애플리케이션에 통합됨에 따라, 프롬프트 인젝션(Prompt Injection)은 가장 심각한 보안 위협으로 부상하였다 [cite:1]. 프롬프트 인젝션이란 공격자가 악의적인 입력을 통해 LLM의 원래 지시를 무시하거나 변경하도록 유도하는 공격 기법을 말한다 [cite:3].

OWASP LLM Top 10 (2025)에서는 프롬프트 인젝션을 1위 위협으로 분류하였으며, 이는 LLM 기반 시스템의 보안 설계에서 핵심적으로 다루어야 할 과제임을 시사한다. 그러나 공격 벡터의 다양성과 방어 기법의 한계로 인해 체계적인 분류와 효과적인 대응 전략의 수립이 시급하다.

본 논문에서는 다음 두 가지 연구 질문에 답하고자 한다:
- **RQ1**: 프롬프트 인젝션 공격의 주요 유형과 분류 체계는 무엇인가?
- **RQ2**: 기존 방어 기법의 효과성과 한계는 무엇인가?

# 배경 및 용어 정의

LLM의 동작은 시스템 프롬프트(System Prompt), 사용자 입력(User Input), 그리고 외부 컨텍스트(External Context)의 세 가지 입력원에 의해 결정된다. 프롬프트 인젝션은 이 중 사용자 입력 또는 외부 컨텍스트를 통해 시스템 프롬프트의 의도를 우회하는 것을 목표로 한다 [cite:1].

# 프롬프트 인젝션 공격 분류 체계

## 직접 인젝션 (Direct Injection)

사용자가 직접 악의적 프롬프트를 입력하는 방식이다. Schulhoff et al. [cite:2]는 HackAPrompt 대회를 통해 600,000건 이상의 직접 인젝션 시도를 수집하여 패턴을 분석하였다.

## 간접 인젝션 (Indirect Injection)

Greshake et al. [cite:1]이 처음 체계화한 공격 유형으로, 웹페이지, 이메일, 문서 등 외부 데이터 소스에 악의적 지시를 삽입하여 LLM이 이를 처리할 때 공격이 발동된다. RAG(Retrieval-Augmented Generation) 시스템이 특히 취약하다 [cite:3].

## 탈옥 공격 (Jailbreak)

LLM의 안전 정렬(safety alignment)을 우회하여 금지된 콘텐츠를 생성하도록 유도하는 공격이다. Li et al. [cite:4]는 ChatGPT에 대한 78가지 탈옥 프롬프트를 분석하였으며, Zou et al. [cite:5]는 전이 가능한 적대적 접미사(adversarial suffix)를 통한 자동화된 공격 기법을 제시하였다.

# 방어 기법 분석

현재까지 제안된 방어 기법은 크게 세 가지 범주로 분류할 수 있다:

1. **입력 필터링**: 악의적 패턴을 사전에 탐지하여 차단
2. **프롬프트 격리**: 시스템 프롬프트와 사용자 입력을 구조적으로 분리
3. **출력 검증**: LLM 응답의 안전성을 사후 검증

그러나 각 방법은 한계가 있으며, 특히 간접 인젝션에 대한 방어는 여전히 어려운 과제로 남아 있다.

# 결론

본 논문에서는 프롬프트 인젝션 공격을 직접/간접/탈옥의 3가지 유형으로 분류하고, 각 유형의 특성과 대표 사례를 분석하였다. 기존 방어 기법의 효과성을 평가한 결과, 단일 방어 기법만으로는 충분하지 않으며 다층 방어(defense-in-depth) 접근이 필요함을 확인하였다. 향후 연구에서는 에이전트 AI 시스템에서의 새로운 공격 벡터와 자동화된 방어 기법에 대한 탐구가 필요하다.`;

      state.set('draft.body', sampleBody);

      /* 참고문헌 */
      const refs = state.get('references') || [];
      if (refs.length === 0) {
        const sampleRefs = [
          'Greshake, K. et al. "Not What You\'ve Signed Up For: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection." AISec Workshop, 2023.',
          'Schulhoff, S. et al. "Ignore This Title and HackAPrompt: Exposing Systemic Weaknesses of LLMs through a Global-Scale Prompt Hacking Competition." EMNLP, 2023.',
          'Liu, Y. et al. "Prompt Injection attack against LLM-integrated Applications." arXiv preprint arXiv:2306.05499, 2024.',
          'Li, Y. et al. "Jailbreaking ChatGPT via Prompt Engineering: An Empirical Study." arXiv preprint arXiv:2305.13860, 2023.',
          'Zou, A. et al. "Universal and Transferable Adversarial Attacks on Aligned Language Models." arXiv preprint arXiv:2307.15043, 2023.',
        ];
        state.set('references', sampleRefs);
      }
    },
    navigateTo: 'draft',
  },
];


/* ══════════════════════════════════════════
 * 모달 UI
 * ══════════════════════════════════════════ */

function _createModal() {
  if (_modalEl) return;

  _modalEl = document.createElement('div');
  _modalEl.id = 'template-modal';
  _modalEl.style.cssText = 'display:none;position:fixed;inset:0;z-index:1001;background:rgba(0,0,0,.4);align-items:center;justify-content:center';
  _modalEl.addEventListener('click', (e) => { if (e.target === _modalEl) hideModal(); });

  const box = document.createElement('div');
  box.style.cssText = 'width:90%;max-width:600px;background:var(--panel);border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,.25);padding:28px;animation:cmdIn .15s ease-out';

  /* 제목 */
  box.innerHTML = `
    <div style="text-align:center;margin-bottom:20px">
      <h2 style="font-size:1rem;color:var(--brand);margin-bottom:4px">논문 작성을 시작합니다</h2>
      <p style="font-size:.7rem;color:var(--muted)">템플릿을 선택하면 적절한 초기 설정이 적용됩니다.</p>
    </div>
    <div id="tpl-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px"></div>
    <div style="text-align:center">
      <button id="tpl-skip" style="border:none;background:none;color:var(--muted);font-size:.65rem;cursor:pointer;text-decoration:underline">빈 논문으로 시작</button>
    </div>
  `;

  _modalEl.appendChild(box);
  document.body.appendChild(_modalEl);

  /* 카드 렌더링 */
  const grid = box.querySelector('#tpl-grid');
  TEMPLATES.forEach(tpl => {
    const card = document.createElement('div');
    card.style.cssText = 'border:1px solid var(--line);border-radius:8px;padding:14px;cursor:pointer;transition:border-color .15s, box-shadow .15s;background:var(--panel)';
    card.addEventListener('mouseenter', () => { card.style.borderColor = 'var(--brand)'; card.style.boxShadow = '0 2px 8px rgba(47,93,80,.15)'; });
    card.addEventListener('mouseleave', () => { card.style.borderColor = 'var(--line)'; card.style.boxShadow = 'none'; });
    card.addEventListener('click', () => applyTemplate(tpl.id));

    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:var(--brand);color:#fff;font-size:.65rem;font-weight:700">${tpl.icon}</span>
        <b style="font-size:.78rem;color:var(--text)">${tpl.title}</b>
      </div>
      <p style="font-size:.62rem;color:var(--muted);line-height:1.5;margin:0">${tpl.description}</p>
    `;
    grid.appendChild(card);
  });

  /* 스킵 버튼 */
  box.querySelector('#tpl-skip').addEventListener('click', hideModal);
}

function hideModal() {
  if (_modalEl) _modalEl.style.display = 'none';
}


/* ══════════════════════════════════════════
 * Public API
 * ══════════════════════════════════════════ */

export function initTemplates(state, eventBus, router) {
  _state = state;
  _bus = eventBus;
  _router = router;
  _createModal();
}

export function showTemplateChooser() {
  if (!_modalEl) _createModal();
  _modalEl.style.display = 'flex';
}

export function applyTemplate(templateId) {
  const tpl = TEMPLATES.find(t => t.id === templateId);
  if (!tpl) return;

  tpl.apply(_state);
  hideModal();

  if (tpl.navigateTo && _router) {
    _router.navigateTo(tpl.navigateTo);
  }

  bus.emit(EVT.TEMPLATE_APPLIED, { templateId: tpl.id, title: tpl.title });
  bus.emit(EVT.TOAST, { message: '"' + tpl.title + '" 템플릿이 적용되었습니다.', type: 'info' });
}
