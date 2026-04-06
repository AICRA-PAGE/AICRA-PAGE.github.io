// 논문 작성 단계별 안내 시스템
// Paper Writing Phase Guide System - contextual help and checklists

import { bus, EVT } from '../event-bus.js';

const PHASE_GUIDES = {
  research: {
    friendlyName: '주제 조사',
    originalName: 'Research Phase',
    whatIsThis: '관심 있는 주제에 대해 기존 연구를 조사하고 학문적 배경을 구축하는 단계입니다.',
    whyImportant: '충분한 선행 연구 검토가 없으면 자신의 논문의 위치와 기여를 명확히 할 수 없습니다.',
    whatYouProduce: '주요 논문 목록, 연구 동향 정리, 예비 연구 질문 초안',
    checklist: [
      { step: 1, text: '연구 주제 선정', tip: '구체적이고 관심 있는 주제를 선택합니다.' },
      { step: 2, text: '주요 저널/컨퍼런스 파악', tip: '해당 분야의 최고 저널들을 목록화합니다.' },
      { step: 3, text: '초기 검색 (20-30개 논문)', tip: 'Google Scholar나 SCI 저널에서 기본 논문들을 찾습니다.' },
      { step: 4, text: '주요 논문 상세 분석', tip: '2-3개 중요 논문의 방법론과 결과를 깊이 있게 읽습니다.' },
      { step: 5, text: '연구 갭 식별', tip: '기존 연구의 한계나 미해결 질문을 정리합니다.' },
      { step: 6, text: '예비 RQ(Research Question) 작성', tip: '3-5개의 초기 연구 질문을 작성합니다.' },
    ],
    estimatedTime: { 'short-paper': '2-3주', thesis: '4-8주', journal: '8-12주' },
  },
  plan: {
    friendlyName: '계획',
    originalName: 'Planning Phase',
    whatIsThis: '논문의 구조, 방법론, 그리고 기대 결과를 정리하는 단계입니다.',
    whyImportant: '명확한 계획이 있어야 쓰는 과정에서 길을 잃지 않고 일관성을 유지할 수 있습니다.',
    whatYouProduce: '상세한 아웃라인, 방법론 설명, 기대 결과 정리',
    checklist: [
      { step: 1, text: '논문 구조 아웃라인 작성', tip: '도입, 방법, 결과, 토론, 결론 각 섹션의 주요 포인트를 정합니다.' },
      { step: 2, text: '연구 방법론 상세화', tip: '데이터 수집, 분석 방법, 표본 크기 등을 구체화합니다.' },
      { step: 3, text: '참고문헌 체계 수립', tip: '인용 스타일(APA, MLA 등)을 결정하고 50-100개 초기 참고문헌을 정리합니다.' },
      { step: 4, text: '최종 RQ 확정', tip: '연구 질문을 명확하고 검증 가능한 형태로 다듬습니다.' },
      { step: 5, text: '기대 결과 정리', tip: '이 연구가 도출할 것으로 예상하는 결과를 서술합니다.' },
      { step: 6, text: '타임라인 수립', tip: '남은 작성 시간을 단계별로 배분합니다.' },
    ],
    estimatedTime: { 'short-paper': '1-2주', thesis: '2-3주', journal: '3-4주' },
  },
  draft: {
    friendlyName: '초안 작성',
    originalName: 'Drafting Phase',
    whatIsThis: '논문의 첫 번째 전체 버전을 작성하는 단계입니다.',
    whyImportant: '초안이 없으면 수정할 것도 없습니다. 완벽함보다 완성을 우선합니다.',
    whatYouProduce: '전체 섹션이 포함된 첫 번째 초안, 예비 그림/표',
    checklist: [
      { step: 1, text: '도입(Introduction) 작성', tip: '배경, 연구 갭, RQ를 명확히 합니다.' },
      { step: 2, text: '방법(Methods) 작성', tip: '재현 가능하도록 자세히 서술합니다.' },
      { step: 3, text: '결과(Results) 정리', tip: '데이터와 분석 결과를 객관적으로 제시합니다.' },
      { step: 4, text: '토론(Discussion) 초안', tip: '결과의 의미와 한계를 분석합니다.' },
      { step: 5, text: '결론(Conclusion) 작성', tip: '주요 발견사항과 후속 연구 방향을 제시합니다.' },
      { step: 6, text: '그림/표 임베드', tip: '핵심 시각화 요소를 본문에 포함합니다.' },
    ],
    estimatedTime: { 'short-paper': '3-4주', thesis: '6-10주', journal: '10-16주' },
  },
  refine: {
    friendlyName: '다듬기',
    originalName: 'Refinement Phase',
    whatIsThis: '초안을 읽고 명확성, 일관성, 학술적 수준을 높이는 단계입니다.',
    whyImportant: '다듬기 없이는 논문이 미완성으로 보이고 메시지 전달이 약해집니다.',
    whatYouProduce: '개선된 전체 초안, 피드백 수집, 논리 강화',
    checklist: [
      { step: 1, text: '전체 읽기 및 큰 틀 검토', tip: '흐름, 논리 전개, 결론 일관성을 확인합니다.' },
      { step: 2, text: '문장 수준 편집', tip: '명확성, 간결성, 문법을 개선합니다.' },
      { step: 3, text: '학술적 톤 강화', tip: '표현을 더 학술적이고 전문적으로 다듬습니다.' },
      { step: 4, text: '그림/표 개선', tip: '시각화의 명확성과 미적 수준을 높입니다.' },
      { step: 5, text: '동료 피드백 수집', tip: '같은 분야의 선배나 동료에게 검토를 요청합니다.' },
      { step: 6, text: '피드백 반영', tip: '제안된 개선사항을 적용합니다.' },
    ],
    estimatedTime: { 'short-paper': '2-3주', thesis: '3-4주', journal: '4-6주' },
  },
  review: {
    friendlyName: '최종 검토',
    originalName: 'Review Phase',
    whatIsThis: '논문이 출판 기준을 충족하는지 마지막으로 확인하는 단계입니다.',
    whyImportant: '사소한 오류나 형식 오류도 심사위원이나 편집자에게 좋지 않은 인상을 줄 수 있습니다.',
    whatYouProduce: '최종 검수 완료, 투고 준비 완료 상태의 논문',
    checklist: [
      { step: 1, text: '참고문헌 형식 점검', tip: 'APA/MLA 등 일관된 형식을 유지하는지 확인합니다.' },
      { step: 2, text: '그림/표 번호 및 캡션 점검', tip: '모든 그림/표가 본문에서 정확히 참조되는지 확인합니다.' },
      { step: 3, text: '철저한 맞춤법/문법 검토', tip: '자동 도구(Grammarly 등)와 수동 검토를 병행합니다.' },
      { step: 4, text: '자기 표절 확인', tip: '이전 논문이나 보고서와의 중복을 체크합니다.' },
      { step: 5, text: '페이지 길이 및 형식 확인', tip: '투고 대상 저널의 요구사항을 만족하는지 확인합니다.' },
      { step: 6, text: '최종 승인 받기', tip: '지도교수 또는 공저자로부터 최종 승인을 받습니다.' },
    ],
    estimatedTime: { 'short-paper': '1주', thesis: '1-2주', journal: '2주' },
  },
  submit: {
    friendlyName: '투고',
    originalName: 'Submission Phase',
    whatIsThis: '논문을 저널이나 학회에 제출하는 단계입니다.',
    whyImportant: '투고 요구사항을 정확히 따르지 않으면 자동으로 거절당할 수 있습니다.',
    whatYouProduce: '제출된 논문, Cover Letter, 투고 확인 이메일',
    checklist: [
      { step: 1, text: '투고 대상 저널 최종 확인', tip: '범위, 영향도, 수용률을 고려합니다.' },
      { step: 2, text: '투고 요구사항 재확인', tip: '파일 형식, 단어 수, 추가 문서 등을 확인합니다.' },
      { step: 3, text: 'Cover Letter 작성', tip: '논문의 주요 기여와 적절성을 설득력 있게 설명합니다.' },
      { step: 4, text: '저자 정보 및 선언 작성', tip: 'CRediT, 이해상충, 자금 지원 정보를 정리합니다.' },
      { step: 5, text: '제안 심사자 제시 (선택)', tip: '가능하면 객관적이고 신뢰할 수 있는 심사자를 제안합니다.' },
      { step: 6, text: '시스템에 파일 업로드 및 제출', tip: '마지막 체크 후 제출 버튼을 클릭합니다.' },
    ],
    estimatedTime: { 'short-paper': '1-2일', thesis: '3-5일', journal: '1주' },
  },
  postpub: {
    friendlyName: '게재 후',
    originalName: 'Post-Publication Phase',
    whatIsThis: '논문 게재 후 학술 커뮤니티에 널리 알리고 영향을 극대화하는 단계입니다.',
    whyImportant: '발표된 논문도 알려지지 않으면 영향력이 제한됩니다.',
    whatYouProduce: '게재 소식 공유, 학술 네트워크 확장, 후속 연구 계획',
    checklist: [
      { step: 1, text: '게재 소식 공유 및 홍보', tip: 'ResearchGate, Twitter, 기관 웹사이트 등에 공유합니다.' },
      { step: 2, text: '학술 커뮤니티 네트워킹', tip: '같은 분야의 연구자들과 연결합니다.' },
      { step: 3, text: '문의 및 협업 기회 검토', tip: '논문에 대한 질문이나 협업 제안을 고려합니다.' },
      { step: 4, text: '데이터/코드 공개 (해당시)', tip: 'Open Science 관행을 따릅니다.' },
      { step: 5, text: '인용 모니터링', tip: '논문이 어떻게 인용되는지 추적합니다.' },
      { step: 6, text: '후속 연구 계획 수립', tip: '이 논문의 한계를 극복하는 새로운 연구를 계획합니다.' },
    ],
    estimatedTime: { 'short-paper': '진행 중', thesis: '진행 중', journal: '진행 중' },
  },
};

const FEATURE_HELP = {
  search: {
    name: '논문 검색',
    what: '기존 논문과 저널을 빠르게 찾을 수 있습니다.',
    why: '선행 연구 조사의 필수 단계입니다.',
    example: '"machine learning ethics" 같은 주제를 입력하면 관련 논문과 저널이 표시됩니다.',
    level: 'beginner',
  },
  litMatrix: {
    name: '문헌 매트릭스',
    what: '여러 논문을 표 형태로 비교할 수 있습니다.',
    why: '선행 연구 간의 공통점과 차이점을 체계적으로 정리합니다.',
    example: '저자, 연도, 방법론, 주요 결과 등을 열로 하여 각 논문을 행으로 정렬합니다.',
    level: 'intermediate',
  },
  toulmin: {
    name: 'Toulmin 논증 분석',
    what: '학술 논문의 논리 구조를 Toulmin 모형으로 분석합니다.',
    why: '주장, 근거, 이유, 반박 등을 명확히 구분하여 논리적 강도를 높입니다.',
    example: 'Claim(주장) → Warrant(정당성) → Backing(근거) → Qualifier(한정) → Rebuttal(반박)로 분석합니다.',
    level: 'advanced',
  },
  reviewSim: {
    name: '심사 시뮬레이션',
    what: '심사위원의 관점에서 논문을 검토합니다.',
    why: '심사 과정을 미리 경험하여 약점을 보강합니다.',
    example: '구성, 논리성, 기여도, 방법론 타당성 등을 기준으로 피드백을 받습니다.',
    level: 'advanced',
  },
  workflowChain: {
    name: '워크플로우 체인',
    what: '연구부터 게재까지 전체 과정을 자동으로 추적합니다.',
    why: '진행 상황을 한눈에 파악하고 다음 단계를 놓치지 않습니다.',
    example: '현재 단계에서 할 일과 다음 단계 준비물을 자동으로 제안합니다.',
    level: 'expert',
  },
};

let currentState = {
  userLevel: localStorage.getItem('aicra.workbench.userLevel') || 'beginner',
  dismissedGuides: JSON.parse(localStorage.getItem('aicra.workbench.dismissedGuides')) || {},
};

// 특정 단계의 안내 표시
export function showPhaseGuide(phaseId) {
  if (!PHASE_GUIDES[phaseId]) {
    console.warn(`Invalid phase: ${phaseId}`);
    return;
  }

  // 이미 닫았으면 표시하지 않음
  if (currentState.dismissedGuides[phaseId]) {
    return;
  }

  const guide = PHASE_GUIDES[phaseId];

  const card = document.createElement('div');
  card.className = 'phase-guide-card';
  card.style.cssText = `
    background: var(--panel);
    border-left: 4px solid var(--brand);
    border-radius: var(--radius);
    padding: 20px;
    margin-bottom: 16px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: start;
    margin-bottom: 12px;
  `;

  const title = document.createElement('h3');
  title.textContent = guide.friendlyName;
  title.style.cssText = `
    color: var(--text);
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  `;

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.cssText = `
    background: none;
    border: none;
    color: var(--muted);
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  closeBtn.onclick = () => {
    card.remove();
    currentState.dismissedGuides[phaseId] = true;
    localStorage.setItem('aicra.workbench.dismissedGuides', JSON.stringify(currentState.dismissedGuides));
  };

  header.appendChild(title);
  header.appendChild(closeBtn);
  card.appendChild(header);

  const whatIs = document.createElement('p');
  whatIs.textContent = guide.whatIsThis;
  whatIs.style.cssText = `
    color: var(--text);
    margin: 0 0 8px 0;
    font-size: 14px;
    line-height: 1.5;
  `;
  card.appendChild(whatIs);

  const why = document.createElement('p');
  why.textContent = guide.whyImportant;
  why.style.cssText = `
    color: var(--muted);
    margin: 0 0 16px 0;
    font-size: 13px;
    font-style: italic;
  `;
  card.appendChild(why);

  // 체크리스트
  const checklist = document.createElement('ol');
  checklist.style.cssText = `
    margin: 0;
    padding-left: 20px;
    color: var(--text);
    font-size: 13px;
  `;
  guide.checklist.forEach(item => {
    const li = document.createElement('li');
    li.style.cssText = `
      margin: 6px 0;
      line-height: 1.4;
    `;
    li.innerHTML = `<strong>${item.text}</strong> — ${item.tip}`;
    checklist.appendChild(li);
  });
  card.appendChild(checklist);

  // 예상 소요 시간
  const timing = document.createElement('div');
  timing.style.cssText = `
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
    font-size: 12px;
    color: var(--muted);
  `;
  timing.innerHTML = `
    <strong>예상 소요 시간:</strong>
    단기논문: ${guide.estimatedTime['short-paper']} |
    학위논문: ${guide.estimatedTime['thesis']} |
    저널 논문: ${guide.estimatedTime['journal']}
  `;
  card.appendChild(timing);

  // 닫지 않기 옵션
  const dontShow = document.createElement('div');
  dontShow.style.cssText = `
    margin-top: 12px;
    font-size: 12px;
  `;
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = `dismiss-${phaseId}`;
  checkbox.onchange = () => {
    if (checkbox.checked) {
      currentState.dismissedGuides[phaseId] = true;
      localStorage.setItem('aicra.workbench.dismissedGuides', JSON.stringify(currentState.dismissedGuides));
    }
  };
  const label = document.createElement('label');
  label.htmlFor = `dismiss-${phaseId}`;
  label.textContent = '이 안내를 다시 보지 않기';
  label.style.cssText = `
    cursor: pointer;
    color: var(--muted);
    margin-left: 6px;
  `;
  dontShow.appendChild(checkbox);
  dontShow.appendChild(label);
  card.appendChild(dontShow);

  return card;
}

// 특정 기능에 대한 도움말 표시
export function showFeatureHelp(featureId, nearElement) {
  if (!FEATURE_HELP[featureId]) {
    console.warn(`Invalid feature: ${featureId}`);
    return;
  }

  const help = FEATURE_HELP[featureId];

  const popup = document.createElement('div');
  popup.className = 'feature-help-popup';
  popup.style.cssText = `
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 16px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    max-width: 280px;
    position: fixed;
  `;

  const title = document.createElement('h4');
  title.textContent = help.name;
  title.style.cssText = `
    color: var(--text);
    margin: 0 0 8px 0;
    font-size: 14px;
    font-weight: 600;
  `;
  popup.appendChild(title);

  const what = document.createElement('p');
  what.textContent = help.what;
  what.style.cssText = `
    color: var(--text);
    margin: 0 0 8px 0;
    font-size: 13px;
    line-height: 1.4;
  `;
  popup.appendChild(what);

  const why = document.createElement('p');
  why.innerHTML = `<strong>왜 필요한가:</strong> ${help.why}`;
  why.style.cssText = `
    color: var(--muted);
    margin: 0 0 8px 0;
    font-size: 12px;
    line-height: 1.4;
  `;
  popup.appendChild(why);

  const example = document.createElement('p');
  example.innerHTML = `<strong>예시:</strong> ${help.example}`;
  example.style.cssText = `
    color: var(--muted);
    margin: 0;
    font-size: 12px;
    line-height: 1.4;
    font-style: italic;
  `;
  popup.appendChild(example);

  // 위치 계산
  if (nearElement) {
    const rect = nearElement.getBoundingClientRect();
    popup.style.left = (rect.right + 8) + 'px';
    popup.style.top = (rect.top - 8) + 'px';
  }

  document.body.appendChild(popup);

  // 클릭 외부 닫기
  const closeOnClickOutside = (e) => {
    if (!popup.contains(e.target) && (!nearElement || !nearElement.contains(e.target))) {
      popup.remove();
      document.removeEventListener('click', closeOnClickOutside);
    }
  };
  setTimeout(() => {
    document.addEventListener('click', closeOnClickOutside);
  }, 100);

  return popup;
}

// 단계별 체크리스트 조회
export function getPhaseChecklist(phaseId) {
  const guide = PHASE_GUIDES[phaseId];
  if (!guide) {
    return null;
  }
  return guide.checklist;
}

// 상태 동기화
export function initGuide(state, eventBus) {
  if (state && state.userLevel) {
    currentState.userLevel = state.userLevel;
  }
  if (state && state.dismissedGuides) {
    currentState.dismissedGuides = state.dismissedGuides;
    localStorage.setItem('aicra.workbench.dismissedGuides', JSON.stringify(currentState.dismissedGuides));
  }
}
