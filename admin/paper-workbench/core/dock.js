/**
 * dock.js - Multi-Panel Dock System
 * 편집기 하단/우측의 독 패널 시스템
 * 탭 기반 다중 패널, 리사이즈, 상태 지속
 */

import { bus, EVT } from './event-bus.js';

// 내부 상태
let state = null;
let _bus = null;
let dockRoot = null;
let toggleBar = null;
let dockPanel = null;
let contentArea = null;
let resizeHandle = null;

// 탭 레지스트리
const tabs = new Map();
let activeTabId = null;

/**
 * 독 시스템 초기화
 * @param {Object} appState - 애플리케이션 상태
 * @param {Object} eventBus - 이벤트 버스
 */
export function initDock(appState, eventBus) {
  state = appState;
  _bus = eventBus;

  // localStorage에서 저장된 상태 복구
  const savedState = localStorage.getItem('aicra.workbench.dock');
  const dockState = savedState ? JSON.parse(savedState) : {
    visible: false,
    activeTab: 'evidence',
    height: 200
  };

  // 기본 탭 등록
  registerDefaultTabs();

  // DOM 구축
  buildDockUI();

  // 저장된 상태 적용
  if (dockState.visible) {
    showDock();
  }
  if (dockState.activeTab && tabs.has(dockState.activeTab)) {
    activateDockTab(dockState.activeTab);
  }
  setPanelHeight(dockState.height);

  // 이벤트 리스너 등록
  setupEventListeners();
}

/**
 * 기본 탭 등록
 */
function registerDefaultTabs() {
  // 증거 카드
  addDockTab('evidence', '증거 카드', async (container) => {
    container.innerHTML = '<div class="dock-loading">증거 카드 로딩 중...</div>';
    try {
      _bus.emit(EVT.REQUEST_RENDER_EVIDENCE_CARDS, { container });
    } catch (err) {
      console.error('증거 카드 렌더링 오류:', err);
      container.innerHTML = '<div class="dock-error">렌더링 실패</div>';
    }
  });

  // Paper DNA
  addDockTab('dna', 'Paper DNA', async (container) => {
    container.innerHTML = '<div class="dock-loading">DNA 분석 중...</div>';
    try {
      _bus.emit(EVT.REQUEST_ANALYZE_DNA, { container });
    } catch (err) {
      console.error('DNA 분석 오류:', err);
      container.innerHTML = '<div class="dock-error">분석 실패</div>';
    }
  });

  // 비교 보드
  addDockTab('comparative', '비교 보드', async (container) => {
    container.innerHTML = '<div class="dock-loading">비교 보드 로딩 중...</div>';
    try {
      _bus.emit(EVT.REQUEST_RENDER_COMPARATIVE, { container });
    } catch (err) {
      console.error('비교 보드 렌더링 오류:', err);
      container.innerHTML = '<div class="dock-error">렌더링 실패</div>';
    }
  });

  // Insight Graph
  addDockTab('graph', 'Insight Graph', async (container) => {
    container.innerHTML = '<div class="dock-loading">그래프 로딩 중...</div>';
    try {
      _bus.emit(EVT.REQUEST_RENDER_INSIGHT_GRAPH, { container });
    } catch (err) {
      console.error('그래프 렌더링 오류:', err);
      container.innerHTML = '<div class="dock-error">렌더링 실패</div>';
    }
  });

  // 연구 메모
  addDockTab('notes', '연구 메모', (container) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'dock-notes-wrapper';

    const textarea = document.createElement('textarea');
    textarea.className = 'dock-notes-textarea';
    textarea.placeholder = '연구 노트를 자유 형식으로 작성하세요...';
    textarea.value = state.researchNotes || '';

    textarea.addEventListener('change', () => {
      state.researchNotes = textarea.value;
      _bus.emit(EVT.STATE_CHANGED, { path: 'researchNotes', value: textarea.value });
    });

    wrapper.appendChild(textarea);
    container.appendChild(wrapper);
  });
}

/**
 * DOM 구조 구축
 */
function buildDockUI() {
  // 루트 컨테이너
  dockRoot = document.createElement('div');
  dockRoot.id = 'dock-root';
  dockRoot.className = 'dock-root';

  // 토글 바
  toggleBar = document.createElement('div');
  toggleBar.className = 'dock-toggle-bar';
  toggleBar.innerHTML = `
    <div class="dock-toggle-content">
      <span class="dock-label">Dock</span>
      <span class="dock-arrow">▲</span>
    </div>
  `;
  toggleBar.addEventListener('click', toggleDock);

  // 독 패널
  dockPanel = document.createElement('div');
  dockPanel.className = 'dock-panel';

  // 탭 바
  const tabBar = document.createElement('div');
  tabBar.className = 'dock-tab-bar';
  tabBar.id = 'dock-tab-bar';

  // 클로즈 버튼
  const closeBtn = document.createElement('button');
  closeBtn.className = 'dock-close-btn';
  closeBtn.innerHTML = '✕';
  closeBtn.title = '독 닫기';
  closeBtn.addEventListener('click', hideDock);
  tabBar.appendChild(closeBtn);

  dockPanel.appendChild(tabBar);

  // 컨텐츠 영역
  contentArea = document.createElement('div');
  contentArea.className = 'dock-content-area';
  contentArea.id = 'dock-content-area';
  dockPanel.appendChild(contentArea);

  // 리사이즈 핸들
  resizeHandle = document.createElement('div');
  resizeHandle.className = 'dock-resize-handle';
  dockPanel.appendChild(resizeHandle);

  // 구조 조립
  dockRoot.appendChild(toggleBar);
  dockRoot.appendChild(dockPanel);

  // DOM에 삽입
  const mainContent = document.querySelector('.main-content') || document.body;
  mainContent.appendChild(dockRoot);

  // 초기 상태: 숨김
  dockPanel.style.display = 'none';
}

/**
 * 탭 추가/등록
 * @param {string} id - 탭 ID
 * @param {string} label - 탭 레이블
 * @param {Function} renderFn - 렌더링 함수 (container 매개변수)
 */
export function addDockTab(id, label, renderFn) {
  tabs.set(id, { id, label, renderFn });
  updateTabBar();
}

/**
 * 탭 바 업데이트
 */
function updateTabBar() {
  const tabBar = document.getElementById('dock-tab-bar');
  if (!tabBar) return;

  // 기존 탭 제거 (클로즈 버튼 제외)
  const oldTabs = tabBar.querySelectorAll('.dock-tab');
  oldTabs.forEach(t => t.remove());

  // 새 탭 생성
  tabs.forEach(({ id, label }) => {
    const tab = document.createElement('button');
    tab.className = 'dock-tab';
    tab.dataset.tabId = id;
    tab.textContent = label;

    if (id === activeTabId) {
      tab.classList.add('active');
    }

    tab.addEventListener('click', () => activateDockTab(id));
    tabBar.appendChild(tab);
  });
}

/**
 * 탭 활성화
 * @param {string} tabId - 탭 ID
 */
export function activateDockTab(tabId) {
  if (!tabs.has(tabId)) {
    console.warn(`탭 ${tabId}가 존재하지 않습니다`);
    return;
  }

  // 이전 탭 비활성화
  document.querySelectorAll('.dock-tab').forEach(t => {
    t.classList.remove('active');
  });

  // 새 탭 활성화
  const tab = document.querySelector(`[data-tab-id="${tabId}"]`);
  if (tab) {
    tab.classList.add('active');
  }

  activeTabId = tabId;

  // 컨텐츠 렌더링
  contentArea.innerHTML = '';
  const { renderFn } = tabs.get(tabId);

  if (renderFn) {
    try {
      renderFn(contentArea);
    } catch (err) {
      console.error(`탭 ${tabId} 렌더링 오류:`, err);
      contentArea.innerHTML = '<div class="dock-error">렌더링 오류 발생</div>';
    }
  }

  // 상태 저장
  saveDockState();
}

/**
 * 독 표시
 */
export function showDock() {
  if (!dockPanel) return;
  dockPanel.style.display = 'flex';
  updateArrow();

  if (activeTabId) {
    activateDockTab(activeTabId);
  }

  saveDockState();
}

/**
 * 독 숨김
 */
export function hideDock() {
  if (!dockPanel) return;
  dockPanel.style.display = 'none';
  updateArrow();
  saveDockState();
}

/**
 * 독 표시/숨김 토글
 */
export function toggleDock() {
  if (!dockPanel) return;

  if (dockPanel.style.display === 'none' || dockPanel.style.display === '') {
    showDock();
  } else {
    hideDock();
  }
}

/**
 * 독 표시 여부 확인
 * @returns {boolean}
 */
export function isDockVisible() {
  return dockPanel && dockPanel.style.display !== 'none';
}

/**
 * 화살표 업데이트
 */
function updateArrow() {
  const arrow = document.querySelector('.dock-arrow');
  if (!arrow) return;
  arrow.textContent = isDockVisible() ? '▼' : '▲';
}

/**
 * 패널 높이 설정
 * @param {number} height - 높이 (px)
 */
function setPanelHeight(height) {
  if (!dockPanel) return;
  const clampedHeight = Math.max(150, Math.min(400, height));
  dockPanel.style.height = `${clampedHeight}px`;
  saveDockState();
}

/**
 * 이벤트 리스너 설정
 */
function setupEventListeners() {
  // 리사이즈 핸들
  if (resizeHandle) {
    let isResizing = false;
    let startY = 0;
    let startHeight = 0;

    resizeHandle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startY = e.clientY;
      startHeight = dockPanel.offsetHeight;
      document.addEventListener('mousemove', onResizeMove);
      document.addEventListener('mouseup', onResizeEnd);
      e.preventDefault();
    });

    const onResizeMove = (e) => {
      if (!isResizing) return;
      const delta = startY - e.clientY;
      const newHeight = startHeight + delta;
      setPanelHeight(newHeight);
    };

    const onResizeEnd = () => {
      isResizing = false;
      document.removeEventListener('mousemove', onResizeMove);
      document.removeEventListener('mouseup', onResizeEnd);
    };
  }
}

/**
 * 독 상태 localStorage에 저장
 */
function saveDockState() {
  const dockState = {
    visible: isDockVisible(),
    activeTab: activeTabId || 'evidence',
    height: dockPanel ? dockPanel.offsetHeight : 200
  };
  localStorage.setItem('aicra.workbench.dock', JSON.stringify(dockState));
}
