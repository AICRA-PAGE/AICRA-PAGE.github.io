// 사용자 수준 시스템 - 경험도에 따른 적응형 UI
// User Level System - adaptive UI based on experience level

import { bus, EVT } from './event-bus.js';

const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];

const LEVEL_METADATA = {
  beginner: {
    label: '처음이에요',
    description: '소논문이나 과제 보고서를 처음 써봅니다',
    icon: '1️⃣',
    index: 0,
  },
  intermediate: {
    label: '학위논문 준비 중',
    description: '석사/박사 학위논문을 쓰고 있습니다',
    icon: '2️⃣',
    index: 1,
  },
  advanced: {
    label: '투고 경험 있음',
    description: '저널이나 학회에 논문을 투고해본 적이 있습니다',
    icon: '3️⃣',
    index: 2,
  },
  expert: {
    label: '다수 투고 경험',
    description: '여러 편의 논문을 SCI/KCI 저널에 게재했습니다',
    icon: '4️⃣',
    index: 3,
  },
};

const FEATURE_LEVELS = {
  // 모든 수준에서 표시 (Always visible)
  search: 'beginner',
  outline: 'beginner',
  draft: 'beginner',
  save: 'beginner',
  export: 'beginner',
  references: 'beginner',

  // 중급 이상 (Intermediate+)
  litMatrix: 'intermediate',
  gaps: 'intermediate',
  rq: 'intermediate',
  abstract: 'intermediate',
  wordTarget: 'intermediate',

  // 고급 이상 (Advanced+)
  toulmin: 'advanced',
  evidenceCards: 'advanced',
  reviewSim: 'advanced',
  preflight: 'advanced',
  coverLetter: 'advanced',
  credit: 'advanced',
  blind: 'advanced',

  // 전문가 전용 (Expert only)
  comparativeBoard: 'expert',
  insightGraph: 'expert',
  workflowChain: 'expert',
  customLayout: 'expert',
};

let currentState = {
  userLevel: localStorage.getItem('aicra.workbench.userLevel') || 'beginner',
};

// 상태에서 현재 수준을 가져옴
export function getUserLevel() {
  return currentState.userLevel;
}

// 사용자 수준을 설정 (localStorage에도 저장)
export function setUserLevel(level) {
  if (!LEVELS.includes(level)) {
    console.warn(`Invalid user level: ${level}`);
    return;
  }
  currentState.userLevel = level;
  localStorage.setItem('aicra.workbench.userLevel', level);
  bus.emit(EVT.STATE_CHANGED, { path: 'userLevel', value: level });
}

// 특정 기능이 현재 수준에서 표시되어야 하는지 확인
export function shouldShowFeature(featureId) {
  const requiredLevel = FEATURE_LEVELS[featureId];
  if (!requiredLevel) {
    // 목록에 없는 기능은 기본적으로 모든 수준에 표시
    return true;
  }

  const currentLevelIndex = LEVEL_METADATA[currentState.userLevel].index;
  const requiredLevelIndex = LEVEL_METADATA[requiredLevel].index;

  return currentLevelIndex >= requiredLevelIndex;
}

// 수준 선택 모달 표시
export function showLevelChooser() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  `;

  const container = document.createElement('div');
  container.style.cssText = `
    background: var(--bg);
    border-radius: var(--radius);
    padding: 32px;
    max-width: 900px;
    width: 90vw;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  `;

  const title = document.createElement('h2');
  title.textContent = '당신의 경험 수준은 어느 정도인가요?';
  title.style.cssText = `
    color: var(--text);
    margin: 0 0 12px 0;
    font-size: 24px;
    font-weight: 600;
  `;

  const subtitle = document.createElement('p');
  subtitle.textContent = '가장 맞는 수준을 선택하면, Paper Workbench가 필요한 기능들을 맞춤형으로 보여줍니다.';
  subtitle.style.cssText = `
    color: var(--muted);
    margin: 0 0 32px 0;
    font-size: 14px;
  `;

  container.appendChild(title);
  container.appendChild(subtitle);

  const cardsContainer = document.createElement('div');
  cardsContainer.style.cssText = `
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 32px;
  `;

  // 각 수준별 카드 생성
  LEVELS.forEach(level => {
    const meta = LEVEL_METADATA[level];
    const card = document.createElement('div');
    card.style.cssText = `
      border: 2px solid var(--line);
      border-radius: var(--radius);
      padding: 20px;
      cursor: pointer;
      transition: all 0.2s ease;
      background: var(--surface);
    `;
    card.onmouseover = () => {
      card.style.borderColor = 'var(--brand)';
      card.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
    };
    card.onmouseout = () => {
      card.style.borderColor = 'var(--line)';
      card.style.boxShadow = 'none';
    };

    const icon = document.createElement('div');
    icon.textContent = meta.icon;
    icon.style.cssText = `
      font-size: 32px;
      margin-bottom: 12px;
      text-align: center;
    `;

    const label = document.createElement('h3');
    label.textContent = meta.label;
    label.style.cssText = `
      color: var(--text);
      margin: 0 0 8px 0;
      font-size: 16px;
      font-weight: 600;
    `;

    const desc = document.createElement('p');
    desc.textContent = meta.description;
    desc.style.cssText = `
      color: var(--muted);
      margin: 0;
      font-size: 13px;
      line-height: 1.4;
    `;

    card.appendChild(icon);
    card.appendChild(label);
    card.appendChild(desc);

    card.onclick = () => {
      setUserLevel(level);
      modal.remove();
      bus.emit(EVT.USER_LEVEL_CHOSEN, { level });
    };

    cardsContainer.appendChild(card);
  });

  container.appendChild(cardsContainer);

  const footer = document.createElement('div');
  footer.style.cssText = `
    text-align: center;
    color: var(--muted);
    font-size: 12px;
  `;
  footer.textContent = '나중에 설정에서 수준을 변경할 수 있습니다.';
  container.appendChild(footer);

  modal.appendChild(container);
  document.body.appendChild(modal);

  // ESC로 닫기 (선택 사항)
  const closeOnEscape = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', closeOnEscape);
    }
  };
  document.addEventListener('keydown', closeOnEscape);
}

// 초기화 함수
export function initUserLevel(state, eventBus) {
  // 현재 상태 동기화
  if (state && state.userLevel) {
    currentState.userLevel = state.userLevel;
    localStorage.setItem('aicra.workbench.userLevel', state.userLevel);
  }

  // 처음 방문이면 수준 선택 창 표시
  if (!localStorage.getItem('aicra.workbench.levelChosen')) {
    localStorage.setItem('aicra.workbench.levelChosen', 'true');
    showLevelChooser();
  }
}
