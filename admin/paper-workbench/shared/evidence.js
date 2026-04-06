// evidence.js - 증거 카드 시스템
// 논문 읽기와 집필 사이의 다리 역할

import { bus, EVT } from '../core/event-bus.js';

// 내부 상태
let state = null;

// 타입별 색상 및 레이블
const EVIDENCE_CONFIG = {
  claim: { color: '#2196F3', label: '주장' },
  method: { color: '#9C27B0', label: '방법론' },
  limitation: { color: '#E65100', label: '한계' },
  result: { color: '#2E7D32', label: '결과' },
  background: { color: '#546E7A', label: '배경' },
  gap: { color: '#C62828', label: '갭' }
};

/**
 * 증거 카드 시스템 초기화
 */
export function initEvidence(initialState, eventBus) {
  state = initialState;

  // state.research.evidenceCards 초기화
  if (!state.research) state.research = {};
  if (!state.research.evidenceCards) state.research.evidenceCards = [];

  return {
    createCard,
    updateCard,
    removeCard,
    getCards,
    getCardsByPaper,
    getCardsByType,
    linkCardToSection,
    renderEvidencePanel,
    renderEvidenceCards
  };
}

/**
 * 새 증거 카드 생성
 */
export function createCard(data) {
  const card = {
    id: 'ec-' + Date.now(),
    paperId: data.paperId,
    type: data.type || 'claim',
    quote: data.quote || '',
    paraphrase: data.paraphrase || '',
    pageOrSection: data.pageOrSection || '',
    tags: data.tags || [],
    confidence: data.confidence || 'medium',
    linkedOutlineSection: data.linkedOutlineSection || null,
    linkedDraftSection: data.linkedDraftSection || null,
    createdAt: new Date().toISOString(),
    usedInDraft: false
  };

  state.research.evidenceCards.push(card);
  bus.emit(EVT.EVIDENCE_CREATED, { card });

  return card;
}

/**
 * 증거 카드 업데이트
 */
export function updateCard(id, data) {
  const cardIndex = state.research.evidenceCards.findIndex(c => c.id === id);
  if (cardIndex === -1) return null;

  const card = state.research.evidenceCards[cardIndex];
  const updated = { ...card, ...data };
  state.research.evidenceCards[cardIndex] = updated;

  bus.emit(EVT.EVIDENCE_UPDATED, { id, updated });

  return updated;
}

/**
 * 증거 카드 삭제
 */
export function removeCard(id) {
  const cardIndex = state.research.evidenceCards.findIndex(c => c.id === id);
  if (cardIndex === -1) return false;

  state.research.evidenceCards.splice(cardIndex, 1);
  bus.emit(EVT.EVIDENCE_REMOVED, { id });

  return true;
}

/**
 * 필터에 맞는 카드 조회
 */
export function getCards(filter = {}) {
  let cards = state.research.evidenceCards;

  if (filter.type) {
    cards = cards.filter(c => c.type === filter.type);
  }

  if (filter.paperId) {
    cards = cards.filter(c => c.paperId === filter.paperId);
  }

  if (filter.tags && filter.tags.length > 0) {
    cards = cards.filter(c =>
      filter.tags.some(tag => c.tags.includes(tag))
    );
  }

  if (filter.linkedOutlineSection) {
    cards = cards.filter(c => c.linkedOutlineSection === filter.linkedOutlineSection);
  }

  if (filter.usedInDraft !== undefined) {
    cards = cards.filter(c => c.usedInDraft === filter.usedInDraft);
  }

  return cards;
}

/**
 * 특정 논문의 카드 조회
 */
export function getCardsByPaper(paperId) {
  return getCards({ paperId });
}

/**
 * 특정 타입의 카드 조회
 */
export function getCardsByType(type) {
  return getCards({ type });
}

/**
 * 카드를 아웃라인 섹션에 링크
 */
export function linkCardToSection(cardId, sectionId) {
  const card = updateCard(cardId, { linkedOutlineSection: sectionId });
  if (card) {
    bus.emit(EVT.EVIDENCE_LINKED, { cardId, sectionId });
  }
  return card;
}

/**
 * 증거 카드 사이드바 패널 렌더링
 */
export function renderEvidencePanel(containerEl) {
  containerEl.innerHTML = '';

  // 패널 레이아웃
  const panel = document.createElement('div');
  panel.className = 'evidence-panel';
  panel.style.cssText = `
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 12px;
    padding: 12px;
    background: var(--panel);
    border-radius: var(--radius);
  `;

  // 헤더
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--line);
  `;

  const title = document.createElement('h3');
  title.textContent = '증거 카드';
  title.style.cssText = `
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
  `;

  const newBtn = document.createElement('button');
  newBtn.textContent = '+ 새 카드';
  newBtn.style.cssText = `
    padding: 4px 8px;
    font-size: 12px;
    background: var(--brand);
    color: white;
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
    transition: opacity 0.2s;
  `;
  newBtn.addEventListener('click', () => {
    bus.emit(EVT.EVIDENCE_CREATE_DIALOG, {});
  });
  newBtn.addEventListener('mouseover', () => newBtn.style.opacity = '0.8');
  newBtn.addEventListener('mouseout', () => newBtn.style.opacity = '1');

  header.appendChild(title);
  header.appendChild(newBtn);

  // 필터 바
  const filterBar = createFilterBar();

  // 카드 리스트 컨테이너
  const listContainer = document.createElement('div');
  listContainer.className = 'evidence-list-container';
  listContainer.style.cssText = `
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  `;

  // 카운트 표시
  const countDiv = document.createElement('div');
  countDiv.style.cssText = `
    font-size: 11px;
    color: var(--muted);
    padding: 0 4px;
  `;

  const updateList = () => {
    const filter = getFilterState(filterBar);
    const cards = getCards(filter);

    countDiv.textContent = `총 ${cards.length}개 카드`;

    listContainer.innerHTML = '';

    if (cards.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = `
        padding: 16px;
        text-align: center;
        color: var(--muted);
        font-size: 12px;
      `;
      empty.textContent = '해당하는 카드가 없습니다.';
      listContainer.appendChild(empty);
    } else {
      cards.forEach(card => {
        const cardEl = createCardElement(card, () => updateList());
        listContainer.appendChild(cardEl);
      });
    }
  };

  // 필터 변경 시 리스트 업데이트
  filterBar.addEventListener('change', () => updateList());

  panel.appendChild(header);
  panel.appendChild(filterBar);
  panel.appendChild(countDiv);
  panel.appendChild(listContainer);
  containerEl.appendChild(panel);

  // 초기 로드
  updateList();

  // 이벤트 리스너
  bus.on(EVT.EVIDENCE_CREATED, () => updateList());
  bus.on(EVT.EVIDENCE_UPDATED, () => updateList());
  bus.on(EVT.EVIDENCE_REMOVED, () => updateList());
}

/**
 * 증거 카드 목록만 렌더링 (다른 패널에 임베드용)
 */
export function renderEvidenceCards(containerEl, filter = {}) {
  containerEl.innerHTML = '';

  const cards = getCards(filter);

  if (cards.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = `
      padding: 12px;
      text-align: center;
      color: var(--muted);
      font-size: 12px;
    `;
    empty.textContent = '증거 카드가 없습니다.';
    containerEl.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  list.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 8px;
  `;

  cards.forEach(card => {
    const cardEl = createCardElement(card);
    list.appendChild(cardEl);
  });

  containerEl.appendChild(list);
}

// ===== 내부 헬퍼 함수 =====

/**
 * 필터 바 생성
 */
function createFilterBar() {
  const bar = document.createElement('div');
  bar.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 8px;
  `;

  // 타입 필터
  const typeFilter = document.createElement('div');
  typeFilter.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  `;

  // "전체" 버튼
  const allBtn = document.createElement('button');
  allBtn.textContent = '전체';
  allBtn.className = 'filter-btn active';
  allBtn.dataset.type = 'all';
  styleFilterButton(allBtn, true);
  allBtn.addEventListener('click', () => {
    typeFilter.querySelectorAll('.filter-btn').forEach(b => {
      b.classList.remove('active');
      styleFilterButton(b, false);
    });
    allBtn.classList.add('active');
    styleFilterButton(allBtn, true);
    bar.dispatchEvent(new Event('change'));
  });
  typeFilter.appendChild(allBtn);

  // 각 타입별 버튼
  Object.entries(EVIDENCE_CONFIG).forEach(([type, config]) => {
    const btn = document.createElement('button');
    btn.textContent = config.label;
    btn.className = 'filter-btn';
    btn.dataset.type = type;
    styleFilterButton(btn, false);
    btn.style.borderColor = config.color;
    btn.addEventListener('click', () => {
      allBtn.classList.remove('active');
      styleFilterButton(allBtn, false);
      btn.classList.toggle('active');
      if (btn.classList.contains('active')) {
        styleFilterButton(btn, true);
        btn.style.backgroundColor = config.color;
      } else {
        styleFilterButton(btn, false);
      }
      bar.dispatchEvent(new Event('change'));
    });
    typeFilter.appendChild(btn);
  });

  // 논문 필터 드롭다운
  const paperFilter = document.createElement('select');
  paperFilter.style.cssText = `
    padding: 6px 8px;
    font-size: 12px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--text);
    border-radius: 4px;
    cursor: pointer;
  `;

  const allPaperOpt = document.createElement('option');
  allPaperOpt.value = '';
  allPaperOpt.textContent = '모든 논문';
  paperFilter.appendChild(allPaperOpt);

  if (state.research && state.research.papers) {
    state.research.papers.forEach(paper => {
      const opt = document.createElement('option');
      opt.value = paper.id;
      opt.textContent = paper.title || `논문 #${paper.id}`;
      paperFilter.appendChild(opt);
    });
  }

  paperFilter.addEventListener('change', () => {
    bar.dispatchEvent(new Event('change'));
  });

  bar.appendChild(typeFilter);
  bar.appendChild(paperFilter);

  // 필터 상태 저장용 데이터 속성
  bar.dataset.paperFilter = paperFilter;
  bar.dataset.typeFilter = typeFilter;

  return bar;
}

/**
 * 필터 버튼 스타일링
 */
function styleFilterButton(btn, isActive) {
  if (isActive) {
    btn.style.cssText = `
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      border: 2px solid;
      background: var(--brand);
      color: white;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
    `;
  } else {
    btn.style.cssText = `
      padding: 4px 10px;
      font-size: 11px;
      border: 1px solid var(--line);
      background: transparent;
      color: var(--text);
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
    `;
  }
}

/**
 * 현재 필터 상태 조회
 */
function getFilterState(filterBar) {
  const typeFilter = filterBar.dataset.typeFilter;
  const paperFilter = filterBar.dataset.paperFilter;

  const filter = {};

  // 활성화된 타입들
  const activeTypes = [];
  typeFilter.querySelectorAll('.filter-btn.active').forEach(btn => {
    if (btn.dataset.type !== 'all') {
      activeTypes.push(btn.dataset.type);
    }
  });

  // 여러 타입 선택되면 OR 로직이 필요하므로 여기서는 첫 번째만
  if (activeTypes.length === 1) {
    filter.type = activeTypes[0];
  } else if (activeTypes.length > 1) {
    filter.typeList = activeTypes; // 여러 타입 필터링
  }

  // 논문 필터
  const paperId = parseInt(paperFilter.value);
  if (paperId) {
    filter.paperId = paperId;
  }

  return filter;
}

/**
 * 수정된 필터 상태 조회 (여러 타입 지원)
 */
function getFilterStateMulti(filterBar) {
  const typeFilter = filterBar.dataset.typeFilter;
  const paperFilter = filterBar.dataset.paperFilter;

  const filter = {};

  // 활성화된 타입들
  const activeTypes = [];
  typeFilter.querySelectorAll('.filter-btn.active').forEach(btn => {
    if (btn.dataset.type !== 'all') {
      activeTypes.push(btn.dataset.type);
    }
  });

  // 논문 필터
  const paperId = parseInt(paperFilter.value);
  if (paperId) {
    filter.paperId = paperId;
  }

  // 여러 타입을 OR로 필터링
  if (activeTypes.length > 0) {
    const cards = state.research.evidenceCards;
    const filtered = cards.filter(c => {
      const typeMatch = activeTypes.length === 0 || activeTypes.includes(c.type);
      const paperMatch = !filter.paperId || c.paperId === filter.paperId;
      return typeMatch && paperMatch;
    });
    return { __filtered: filtered };
  }

  return filter;
}

/**
 * 증거 카드 엘리먼트 생성
 */
function createCardElement(card, onUpdate) {
  const cardEl = document.createElement('div');
  cardEl.className = 'evidence-card';
  cardEl.style.cssText = `
    padding: 10px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-left: 4px solid ${EVIDENCE_CONFIG[card.type].color};
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  `;

  // 마우스 오버 효과
  cardEl.addEventListener('mouseover', () => {
    cardEl.style.backgroundColor = 'var(--bg)';
    cardEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
  });
  cardEl.addEventListener('mouseout', () => {
    cardEl.style.backgroundColor = 'var(--surface)';
    cardEl.style.boxShadow = 'none';
  });

  // 카드 헤더
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    gap: 6px;
    align-items: center;
    margin-bottom: 6px;
  `;

  // 타입 배지
  const badge = document.createElement('span');
  badge.textContent = EVIDENCE_CONFIG[card.type].label;
  badge.style.cssText = `
    padding: 2px 6px;
    font-size: 10px;
    font-weight: 600;
    background: ${EVIDENCE_CONFIG[card.type].color};
    color: white;
    border-radius: 3px;
  `;

  // 신뢰도 표시
  const confBadge = document.createElement('span');
  const confColors = { high: '#2E7D32', medium: '#F57C00', low: '#C62828' };
  confBadge.textContent = {
    high: '높음',
    medium: '중간',
    low: '낮음'
  }[card.confidence];
  confBadge.style.cssText = `
    padding: 2px 4px;
    font-size: 9px;
    color: ${confColors[card.confidence]};
    border: 1px solid ${confColors[card.confidence]};
    border-radius: 2px;
  `;

  header.appendChild(badge);
  header.appendChild(confBadge);

  // 인용문
  const quote = document.createElement('div');
  quote.textContent = card.quote.length > 60
    ? card.quote.substring(0, 60) + '...'
    : card.quote;
  quote.style.cssText = `
    font-size: 12px;
    color: var(--text);
    margin-bottom: 6px;
    line-height: 1.4;
    font-style: italic;
  `;

  // 논문 + 페이지
  const meta = document.createElement('div');
  meta.style.cssText = `
    font-size: 11px;
    color: var(--muted);
    display: flex;
    gap: 8px;
    margin-bottom: 6px;
  `;

  if (state.research && state.research.papers) {
    const paper = state.research.papers.find(p => p.id === card.paperId);
    if (paper) {
      const paperSpan = document.createElement('span');
      paperSpan.textContent = paper.title || `논문 #${card.paperId}`;
      meta.appendChild(paperSpan);
    }
  }

  if (card.pageOrSection) {
    const pageSpan = document.createElement('span');
    pageSpan.textContent = card.pageOrSection;
    meta.appendChild(pageSpan);
  }

  // 태그
  if (card.tags && card.tags.length > 0) {
    const tagDiv = document.createElement('div');
    tagDiv.style.cssText = `
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      margin-top: 6px;
    `;

    card.tags.forEach(tag => {
      const tagEl = document.createElement('span');
      tagEl.textContent = '#' + tag;
      tagEl.style.cssText = `
        padding: 1px 4px;
        font-size: 10px;
        background: rgba(33, 150, 243, 0.1);
        color: #2196F3;
        border-radius: 2px;
      `;
      tagDiv.appendChild(tagEl);
    });

    cardEl.appendChild(header);
    cardEl.appendChild(quote);
    cardEl.appendChild(meta);
    cardEl.appendChild(tagDiv);
  } else {
    cardEl.appendChild(header);
    cardEl.appendChild(quote);
    cardEl.appendChild(meta);
  }

  // 확장 상태 관리
  let expanded = false;

  const toggleExpand = () => {
    expanded = !expanded;

    if (expanded) {
      // 전체 내용 표시
      quote.textContent = card.quote;
      quote.style.fontStyle = 'italic';

      // 요약 추가
      if (card.paraphrase) {
        const summary = document.createElement('div');
        summary.style.cssText = `
          padding: 8px;
          margin-top: 6px;
          background: rgba(0,0,0,0.05);
          border-radius: 3px;
          font-size: 12px;
          color: var(--text);
          line-height: 1.4;
        `;
        summary.innerHTML = `<strong>요약:</strong> ${card.paraphrase}`;
        cardEl.appendChild(summary);
      }

      // 액션 버튼
      const actions = document.createElement('div');
      actions.style.cssText = `
        display: flex;
        gap: 6px;
        margin-top: 8px;
      `;

      const editBtn = document.createElement('button');
      editBtn.textContent = '수정';
      editBtn.style.cssText = `
        padding: 4px 8px;
        font-size: 11px;
        background: var(--brand);
        color: white;
        border: none;
        border-radius: 3px;
        cursor: pointer;
      `;
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        bus.emit(EVT.EVIDENCE_EDIT_DIALOG, { card });
      });

      const delBtn = document.createElement('button');
      delBtn.textContent = '삭제';
      delBtn.style.cssText = `
        padding: 4px 8px;
        font-size: 11px;
        background: #C62828;
        color: white;
        border: none;
        border-radius: 3px;
        cursor: pointer;
      `;
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('이 카드를 삭제하시겠습니까?')) {
          removeCard(card.id);
          if (onUpdate) onUpdate();
        }
      });

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      cardEl.appendChild(actions);

      cardEl.style.backgroundColor = 'var(--bg)';
    } else {
      // 최소 내용만 표시
      quote.textContent = card.quote.length > 60
        ? card.quote.substring(0, 60) + '...'
        : card.quote;
      quote.style.fontStyle = 'italic';

      // 추가 내용 제거
      const toRemove = cardEl.querySelectorAll('div:not(.evidence-card > *:nth-child(-n+3))');
      toRemove.forEach(el => {
        if (el !== header && el !== quote && el !== meta) {
          el.remove();
        }
      });

      cardEl.style.backgroundColor = 'var(--surface)';
    }
  };

  cardEl.addEventListener('click', toggleExpand);

  return cardEl;
}
