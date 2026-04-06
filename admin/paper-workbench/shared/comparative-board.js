/**
 * comparative-board.js
 *
 * 비교 읽기 보드 - 여러 논문을 공통 렌즈로 비교
 * Paper Workbench ES module
 *
 * 내보내기: initComparativeBoard(state, bus), renderComparativeBoard(containerEl),
 *         addPaperToBoard(paperId), removePaperFromBoard(paperId)
 */

import { bus, EVT } from '../core/event-bus.js';

// 비교 차원 정의
const DIMENSIONS = [
  { id: 'problem', label: '연구 문제' },
  { id: 'method', label: '방법론' },
  { id: 'dataset', label: '데이터셋' },
  { id: 'results', label: '주요 결과' },
  { id: 'limitations', label: '한계' },
  { id: 'novelty', label: '기여/신규성' }
];

const MAX_PAPERS = 8;

let state = null;
let containerRef = null;

/**
 * 비교 보드 초기화
 */
export function initComparativeBoard(appState, eventBus) {
  state = appState;

  // state.research에 comparativeBoard 섹션 생성
  if (!state.research) state.research = {};
  if (!state.research.comparativeBoard) {
    state.research.comparativeBoard = {
      papers: [],
      cells: {},
      synthesisRows: []
    };
  }
}

/**
 * 비교 보드 렌더링
 */
export function renderComparativeBoard(containerEl) {
  containerRef = containerEl;
  const board = state.research.comparativeBoard;

  containerEl.innerHTML = '';

  // 최상단 바: 제목 + 논문 추가 + Synthesis Row 생성
  const topBar = createTopBar(board);
  containerEl.appendChild(topBar);

  // 메인 비교 테이블
  if (board.papers.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'comparative-board__empty';
    emptyState.innerHTML = `
      <p style="color: var(--muted); text-align: center; padding: 2rem;">
        논문을 추가하여 비교 읽기를 시작하세요.
      </p>
    `;
    containerEl.appendChild(emptyState);
  } else {
    const table = createComparisonTable(board);
    containerEl.appendChild(table);
  }

  // Synthesis Rows 섹션
  if (board.synthesisRows.length > 0) {
    const synthesisSection = createSynthesisSection(board);
    containerEl.appendChild(synthesisSection);
  }
}

/**
 * 최상단 바 생성: 제목, 논문 추가 드롭다운, Synthesis Row 생성 버튼
 */
function createTopBar(board) {
  const bar = document.createElement('div');
  bar.className = 'comparative-board__top-bar';
  bar.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    background-color: var(--panel);
    border-bottom: 1px solid var(--line);
    gap: 1rem;
    flex-wrap: wrap;
  `;

  // 제목
  const title = document.createElement('h2');
  title.textContent = '비교 읽기 보드';
  title.style.cssText = `
    margin: 0;
    font-size: 1.25rem;
    color: var(--text);
  `;
  bar.appendChild(title);

  // 오른쪽 영역 (버튼들)
  const rightSection = document.createElement('div');
  rightSection.style.cssText = `
    display: flex;
    gap: 1rem;
    align-items: center;
    flex-wrap: wrap;
  `;

  // 논문 추가 드롭다운
  if (board.papers.length < MAX_PAPERS) {
    const addPaperDropdown = createAddPaperDropdown(board);
    rightSection.appendChild(addPaperDropdown);
  }

  // Synthesis Row 생성 버튼
  const createSynthesisBtn = document.createElement('button');
  createSynthesisBtn.textContent = 'Synthesis Row 생성';
  createSynthesisBtn.className = 'btn btn--primary';
  createSynthesisBtn.onclick = () => createSynthesisRow(board);
  rightSection.appendChild(createSynthesisBtn);

  bar.appendChild(rightSection);
  return bar;
}

/**
 * 논문 추가 드롭다운 생성
 */
function createAddPaperDropdown(board) {
  const container = document.createElement('div');
  container.className = 'comparative-board__add-paper';
  container.style.cssText = `
    position: relative;
    display: inline-block;
  `;

  const btn = document.createElement('button');
  btn.textContent = '+ 논문 추가';
  btn.className = 'btn btn--secondary';
  btn.style.cssText = `
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
  `;

  const dropdown = document.createElement('div');
  dropdown.className = 'comparative-board__dropdown';
  dropdown.style.cssText = `
    position: absolute;
    top: 100%;
    left: 0;
    background-color: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    min-width: 200px;
    max-height: 300px;
    overflow-y: auto;
    display: none;
    z-index: 100;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  `;

  btn.onclick = () => {
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';

    // 드롭다운 채우기
    if (dropdown.innerHTML === '') {
      const papers = state.research.papers || [];
      const availablePapers = papers.filter(p => !board.papers.includes(p.id));

      if (availablePapers.length === 0) {
        dropdown.innerHTML = '<div style="padding: 0.5rem; color: var(--muted);">추가할 논문이 없습니다.</div>';
      } else {
        availablePapers.forEach(paper => {
          const item = document.createElement('div');
          item.className = 'comparative-board__dropdown-item';
          item.style.cssText = `
            padding: 0.75rem 1rem;
            cursor: pointer;
            border-bottom: 1px solid var(--line);
            transition: background-color 0.2s;
          `;
          item.textContent = paper.title || `Paper ${paper.id}`;
          item.onmouseenter = () => item.style.backgroundColor = 'var(--surface)';
          item.onmouseleave = () => item.style.backgroundColor = 'transparent';
          item.onclick = () => {
            addPaperToBoard(paper.id);
            dropdown.style.display = 'none';
            dropdown.innerHTML = ''; // 다시 열 때 갱신되도록
          };
          dropdown.appendChild(item);
        });
      }
    }
  };

  // 외부 클릭 시 드롭다운 닫기
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });

  container.appendChild(btn);
  container.appendChild(dropdown);
  return container;
}

/**
 * 비교 테이블 생성
 */
function createComparisonTable(board) {
  const table = document.createElement('table');
  table.className = 'comparative-board__table';
  table.style.cssText = `
    width: 100%;
    border-collapse: collapse;
    background-color: var(--bg);
    margin: 1rem 0;
  `;

  // 헤더: 첫 열은 비차원, 나머지는 논문 제목
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headerRow.style.borderBottom = '2px solid var(--line)';

  // 왼쪽 상단 코너 (비어있음)
  const cornerCell = document.createElement('th');
  cornerCell.style.cssText = `
    background-color: var(--panel);
    padding: 1rem;
    text-align: left;
    color: var(--text);
    font-weight: 600;
    border-right: 1px solid var(--line);
  `;
  cornerCell.textContent = '차원';
  headerRow.appendChild(cornerCell);

  // 논문 헤더들
  board.papers.forEach(paperId => {
    const paper = findPaper(paperId);
    const th = document.createElement('th');
    th.style.cssText = `
      background-color: var(--panel);
      padding: 1rem;
      text-align: left;
      color: var(--text);
      font-weight: 600;
      border-right: 1px solid var(--line);
      max-width: 250px;
      word-wrap: break-word;
    `;

    // 제목 + 삭제 버튼
    const titleContainer = document.createElement('div');
    titleContainer.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.5rem;
    `;

    const titleSpan = document.createElement('span');
    titleSpan.textContent = paper?.title || `Paper ${paperId}`;
    titleSpan.style.flex = '1';
    titleContainer.appendChild(titleSpan);

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.className = 'btn btn--icon';
    removeBtn.style.cssText = `
      background: none;
      border: none;
      color: var(--muted);
      cursor: pointer;
      font-size: 1.2rem;
      padding: 0;
      width: 1.5rem;
      height: 1.5rem;
      flex-shrink: 0;
    `;
    removeBtn.onclick = () => removePaperFromBoard(paperId);
    titleContainer.appendChild(removeBtn);

    th.appendChild(titleContainer);
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // 바디: 각 차원별 행
  const tbody = document.createElement('tbody');

  DIMENSIONS.forEach((dim, idx) => {
    const row = document.createElement('tr');
    if (idx % 2 === 0) {
      row.style.backgroundColor = 'var(--surface)';
    }
    row.style.borderBottom = '1px solid var(--line)';

    // 차원 레이블 셀
    const dimCell = document.createElement('td');
    dimCell.style.cssText = `
      background-color: var(--panel);
      padding: 1rem;
      font-weight: 600;
      color: var(--text);
      border-right: 1px solid var(--line);
      min-width: 100px;
    `;
    dimCell.textContent = dim.label;
    row.appendChild(dimCell);

    // 각 논문의 셀
    board.papers.forEach(paperId => {
      const cell = document.createElement('td');
      cell.style.cssText = `
        padding: 1rem;
        border-right: 1px solid var(--line);
        min-height: 100px;
        vertical-align: top;
      `;

      const cellKey = `${paperId}-${dim.id}`;
      const cellData = board.cells[cellKey] || { text: '', source: 'manual', evidenceCardId: null };

      // 편집 가능한 셀 컨텐츠
      const cellContent = document.createElement('div');
      cellContent.className = 'comparative-board__cell';
      cellContent.contentEditable = 'true';
      cellContent.style.cssText = `
        outline: none;
        min-height: 60px;
        padding: 0.5rem;
        border-radius: var(--radius);
        border: 1px dashed var(--line);
        cursor: text;
        word-wrap: break-word;
        color: var(--text);
        font-size: 0.9rem;
        line-height: 1.4;
      `;
      cellContent.textContent = cellData.text || '';

      // 플레이스홀더
      if (!cellData.text) {
        cellContent.innerHTML = '<span style="color: var(--muted);">[입력]</span>';
      }

      // 입력 이벤트
      cellContent.oninput = () => {
        const text = cellContent.textContent.trim();
        if (!board.cells[cellKey]) {
          board.cells[cellKey] = { text: '', source: 'manual', evidenceCardId: null };
        }
        board.cells[cellKey].text = text;
      };

      cellContent.onfocus = () => {
        if (cellContent.innerHTML === '<span style="color: var(--muted);">[입력]</span>') {
          cellContent.innerHTML = '';
        }
      };

      cellContent.onblur = () => {
        if (!cellContent.textContent.trim()) {
          cellContent.innerHTML = '<span style="color: var(--muted);">[입력]</span>';
        }
      };

      cell.appendChild(cellContent);
      row.appendChild(cell);
    });

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  return table;
}

/**
 * Synthesis Rows 섹션 생성
 */
function createSynthesisSection(board) {
  const section = document.createElement('div');
  section.className = 'comparative-board__synthesis';
  section.style.cssText = `
    background-color: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 1.5rem;
    margin-top: 2rem;
  `;

  const title = document.createElement('h3');
  title.textContent = '크로스 페이퍼 Synthesis';
  title.style.cssText = `
    margin-top: 0;
    color: var(--text);
    font-size: 1.1rem;
  `;
  section.appendChild(title);

  const container = document.createElement('div');
  container.className = 'comparative-board__synthesis-rows';
  container.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 1rem;
  `;

  board.synthesisRows.forEach((row, idx) => {
    const synthesisRow = createSynthesisRowElement(row, board, idx);
    container.appendChild(synthesisRow);
  });

  section.appendChild(container);
  return section;
}

/**
 * 개별 Synthesis Row 요소 생성
 */
function createSynthesisRowElement(synthesisRow, board, idx) {
  const rowEl = document.createElement('div');
  rowEl.className = 'comparative-board__synthesis-row';
  rowEl.style.cssText = `
    background-color: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 1rem;
  `;

  // 차원 + 스테이트먼트
  const content = document.createElement('div');
  content.style.cssText = `
    margin-bottom: 0.5rem;
  `;

  const dimLabel = document.createElement('span');
  dimLabel.textContent = synthesisRow.dimension;
  dimLabel.style.cssText = `
    color: var(--brand);
    font-weight: 600;
    margin-right: 0.5rem;
  `;
  content.appendChild(dimLabel);

  const statement = document.createElement('span');
  statement.textContent = synthesisRow.statement;
  statement.style.color = 'var(--text)';
  content.appendChild(statement);

  rowEl.appendChild(content);

  // Citation 배지들
  if (synthesisRow.citations && synthesisRow.citations.length > 0) {
    const citationContainer = document.createElement('div');
    citationContainer.style.cssText = `
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-bottom: 0.5rem;
    `;

    synthesisRow.citations.forEach(citation => {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.style.cssText = `
        background-color: var(--muted);
        color: white;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        font-size: 0.8rem;
      `;
      badge.textContent = citation;
      citationContainer.appendChild(badge);
    });

    rowEl.appendChild(citationContainer);
  }

  // 버튼들
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  `;

  // Related Work에 삽입 버튼
  const insertBtn = document.createElement('button');
  insertBtn.textContent = 'Related Work에 삽입';
  insertBtn.className = 'btn btn--secondary';
  insertBtn.style.cssText = `
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
  `;
  insertBtn.onclick = () => {
    bus.emit(EVT.CMD_EXECUTED, {
      commandId: 'draft.cite',
      synthesisRowId: synthesisRow.id,
      synthesisStatement: synthesisRow.statement,
      citations: synthesisRow.citations || []
    });
  };
  buttonContainer.appendChild(insertBtn);

  // 삭제 버튼
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = '삭제';
  deleteBtn.className = 'btn btn--icon';
  deleteBtn.style.cssText = `
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0;
    width: 1.5rem;
    height: 1.5rem;
  `;
  deleteBtn.onclick = () => {
    board.synthesisRows.splice(idx, 1);
    renderComparativeBoard(containerRef);
  };
  buttonContainer.appendChild(deleteBtn);

  rowEl.appendChild(buttonContainer);
  return rowEl;
}

/**
 * 비교 보드에 논문 추가
 */
export function addPaperToBoard(paperId) {
  if (!state.research.comparativeBoard) return;

  const board = state.research.comparativeBoard;
  if (board.papers.includes(paperId) || board.papers.length >= MAX_PAPERS) return;

  board.papers.push(paperId);
  renderComparativeBoard(containerRef);
}

/**
 * 비교 보드에서 논문 제거
 */
export function removePaperFromBoard(paperId) {
  if (!state.research.comparativeBoard) return;

  const board = state.research.comparativeBoard;
  board.papers = board.papers.filter(id => id !== paperId);

  // 해당 논문의 모든 셀 제거
  Object.keys(board.cells).forEach(key => {
    if (key.startsWith(`${paperId}-`)) {
      delete board.cells[key];
    }
  });

  renderComparativeBoard(containerRef);
}

/**
 * Synthesis Row 생성 대화상자
 */
function createSynthesisRow(board) {
  // 간단한 프롬프트 대화상자
  const dimensionStr = DIMENSIONS.map(d => d.id).join(', ');
  const dimension = prompt(`차원을 선택하세요 (${dimensionStr}):`);

  if (!dimension || !DIMENSIONS.find(d => d.id === dimension)) {
    alert('유효한 차원을 선택하세요.');
    return;
  }

  const statement = prompt('크로스 페이퍼 Synthesis 스테이트먼트를 입력하세요:');
  if (!statement) return;

  const synthesisRow = {
    id: `synth-${Date.now()}`,
    dimension: dimension,
    statement: statement,
    citations: []
  };

  board.synthesisRows.push(synthesisRow);
  renderComparativeBoard(containerRef);
}

/**
 * 논문 객체 찾기
 */
function findPaper(paperId) {
  const papers = state.research?.papers || [];
  return papers.find(p => p.id === paperId);
}
