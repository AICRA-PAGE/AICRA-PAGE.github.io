// 컨텍스트 액션 메뉴 - 텍스트 선택 시 나타나는 플로팅 도구모음
import { bus, EVT } from '../core/event-bus.js';

let menuElement = null;
let isVisible = false;
let registeredItems = new Map();
let currentContext = null;
let hideTimeout = null;

// 기본 메뉴 아이템 정의
const DEFAULT_ITEMS = {
  editor: [
    { id: 'bold', label: 'B', title: 'Bold', action: 'formatBold' },
    { id: 'italic', label: 'I', title: 'Italic', action: 'formatItalic' },
    { id: 'cite', label: 'cite', title: 'Insert Citation', action: 'insertCitation' },
    { id: 'fn', label: 'fn', title: 'Footnote', action: 'insertFootnote' },
    { id: 'verify', label: 'verify', title: 'Verify Claim', action: 'verifyClaim' }
  ],
  reader: [
    { id: 'card', label: 'card', title: 'Evidence Card', action: 'createEvidenceCard' },
    { id: 'cite', label: 'cite', title: 'Add as Reference', action: 'addReference' },
    { id: 'note', label: 'note', title: 'Add Note', action: 'addNote' },
    { id: 'copy', label: 'copy', title: 'Copy', action: 'copyText' }
  ]
};

/**
 * 컨텍스트 메뉴 UI 엘리먼트 생성
 */
function createMenuElement() {
  const menu = document.createElement('div');
  menu.id = 'context-menu';
  menu.className = 'context-menu';
  menu.style.cssText = `
    position: fixed;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 4px 8px;
    display: flex;
    gap: 2px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 900;
    opacity: 0;
    transform: translateY(-8px);
    pointer-events: none;
    transition: opacity 0.1s ease, transform 0.1s ease, pointer-events 0.1s ease;
  `;
  document.body.appendChild(menu);
  return menu;
}

/**
 * 메뉴 버튼 생성
 */
function createMenuButton(item, selectedText) {
  const btn = document.createElement('button');
  btn.className = 'context-menu-btn';
  btn.title = item.title;
  btn.textContent = item.label;
  btn.style.cssText = `
    background: transparent;
    border: 1px solid var(--line);
    border-radius: calc(var(--radius) / 2);
    padding: 4px 8px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text);
    cursor: pointer;
    transition: all 0.15s ease;
  `;

  btn.addEventListener('mouseenter', () => {
    btn.style.background = 'var(--brand)';
    btn.style.color = 'white';
  });

  btn.addEventListener('mouseleave', () => {
    btn.style.background = 'transparent';
    btn.style.color = 'var(--text)';
  });

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleMenuAction(item, selectedText);
    hideContextMenu();
  });

  return btn;
}

/**
 * 메뉴 액션 처리
 */
function handleMenuAction(item, selectedText) {
  const action = item.action;

  switch (action) {
    case 'formatBold':
      bus.emit(EVT.CMD_EXECUTED, {
        commandId: 'editor.format.bold',
        text: selectedText
      });
      wrapSelection('**', '**');
      break;

    case 'formatItalic':
      bus.emit(EVT.CMD_EXECUTED, {
        commandId: 'editor.format.italic',
        text: selectedText
      });
      wrapSelection('*', '*');
      break;

    case 'insertCitation':
      bus.emit(EVT.CMD_EXECUTED, {
        commandId: 'draft.cite',
        text: selectedText
      });
      break;

    case 'insertFootnote':
      bus.emit(EVT.CMD_EXECUTED, {
        commandId: 'draft.footnote',
        text: selectedText
      });
      break;

    case 'verifyClaim':
      bus.emit(EVT.CMD_EXECUTED, {
        commandId: 'refine.claims',
        text: selectedText
      });
      break;

    case 'createEvidenceCard':
      bus.emit(EVT.EVIDENCE_CREATED, {
        text: selectedText,
        timestamp: Date.now()
      });
      break;

    case 'addReference':
      bus.emit(EVT.CITATION_ADDED, {
        text: selectedText,
        timestamp: Date.now()
      });
      break;

    case 'addNote':
      promptForNote(selectedText);
      break;

    case 'copyText':
      navigator.clipboard.writeText(selectedText).catch(err => {
        console.error('Failed to copy:', err);
      });
      break;

    default:
      // 커스텀 액션 처리
      if (typeof item.customAction === 'function') {
        item.customAction(selectedText);
      }
  }
}

/**
 * 선택 텍스트를 마크업으로 감싸기
 */
function wrapSelection(prefix, suffix) {
  const selection = window.getSelection();
  if (selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const selectedText = range.toString();

  if (!selectedText) return;

  const span = document.createElement('span');
  span.textContent = prefix + selectedText + suffix;

  range.deleteContents();
  range.insertNode(span);
  selection.removeAllRanges();
}

/**
 * 노트 입력 프롬프트
 */
function promptForNote(selectedText) {
  const noteText = prompt('Add a note about this selection:', '');
  if (noteText !== null) {
    bus.emit(EVT.NOTE_ADDED, {
      text: selectedText,
      note: noteText,
      timestamp: Date.now()
    });
  }
}

/**
 * 선택 텍스트 기반으로 메뉴 위치 계산
 */
function calculateMenuPosition(x, y) {
  if (!menuElement) return { x, y };

  const rect = menuElement.getBoundingClientRect();
  const menuWidth = rect.width || 250;
  const menuHeight = rect.height || 40;

  let posX = x - menuWidth / 2;
  let posY = y - menuHeight - 10; // 선택 위에 표시

  // 뷰포트 경계 확인
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (posX < 10) posX = 10;
  if (posX + menuWidth + 10 > viewportWidth) {
    posX = viewportWidth - menuWidth - 10;
  }

  // 선택이 상단에 있으면 아래로 이동
  if (posY < 10) {
    posY = y + 10;
  }

  if (posY + menuHeight > viewportHeight) {
    posY = viewportHeight - menuHeight - 10;
  }

  return { x: posX, y: posY };
}

/**
 * 컨텍스트 메뉴 표시
 * @param {number} x - 마우스 X 좌표
 * @param {number} y - 마우스 Y 좌표
 * @param {string} selectedText - 선택된 텍스트
 * @param {string} context - 'editor' 또는 'reader'
 */
export function showContextMenu(x, y, selectedText, context = 'editor') {
  if (!selectedText || selectedText.trim().length === 0) {
    hideContextMenu();
    return;
  }

  if (!menuElement) {
    menuElement = createMenuElement();
  }

  currentContext = context;
  const items = registeredItems.has(context)
    ? registeredItems.get(context)
    : DEFAULT_ITEMS[context] || [];

  // 기존 버튼 제거
  menuElement.innerHTML = '';

  // 새 버튼 추가
  items.forEach(item => {
    const btn = createMenuButton(item, selectedText);
    menuElement.appendChild(btn);
  });

  // 위치 계산 및 표시
  const pos = calculateMenuPosition(x, y);
  menuElement.style.left = pos.x + 'px';
  menuElement.style.top = pos.y + 'px';
  menuElement.style.opacity = '1';
  menuElement.style.transform = 'translateY(0)';
  menuElement.style.pointerEvents = 'auto';

  isVisible = true;

  // 자동 숨김 토글
  clearTimeout(hideTimeout);
}

/**
 * 컨텍스트 메뉴 숨김
 */
export function hideContextMenu() {
  if (!menuElement) return;

  menuElement.style.opacity = '0';
  menuElement.style.transform = 'translateY(-8px)';
  menuElement.style.pointerEvents = 'none';
  isVisible = false;
  currentContext = null;

  clearTimeout(hideTimeout);
}

/**
 * 메뉴 아이템 등록 (커스텀 아이템 추가)
 * @param {string} context - 'editor' 또는 'reader'
 * @param {Array} items - 메뉴 아이템 배열
 */
export function registerMenuItems(context, items) {
  if (!Array.isArray(items)) return;
  registeredItems.set(context, items);
}

/**
 * 컨텍스트 메뉴 초기화
 * @param {Object} state - 애플리케이션 상태
 * @param {Object} eventBus - 이벤트 버스
 */
export function initContextMenu(state, eventBus) {
  // 선택 변경 감지
  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    if (!selection || selection.toString().length === 0) {
      hideContextMenu();
    }
  });

  // 마우스업 이벤트로 메뉴 표시
  document.addEventListener('mouseup', (e) => {
    const selection = window.getSelection();
    if (!selection || selection.toString().length === 0) {
      hideContextMenu();
      return;
    }

    // 메뉴 버튼 클릭 시 무시
    if (e.target.closest('.context-menu')) return;

    // 포커스된 요소 확인
    const activeElement = document.activeElement;
    let context = 'reader';

    if (activeElement?.classList.contains('draft-textarea') ||
        activeElement?.tagName === 'TEXTAREA') {
      context = 'editor';
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top;

    showContextMenu(x, y, selection.toString(), context);
  });

  // 스크롤 시 메뉴 숨김
  document.addEventListener('scroll', hideContextMenu, true);

  // 클릭 외부 영역 시 메뉴 숨김
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.context-menu')) {
      hideContextMenu();
    }
  });

  // 이벤트 버스 리스너
  eventBus.on(EVT.EDITOR_FOCUS, () => {
    currentContext = 'editor';
  });

  eventBus.on(EVT.READER_FOCUS, () => {
    currentContext = 'reader';
  });

  // 메뉴 엘리먼트 생성
  menuElement = createMenuElement();
}

export default {
  initContextMenu,
  showContextMenu,
  hideContextMenu,
  registerMenuItems
};
