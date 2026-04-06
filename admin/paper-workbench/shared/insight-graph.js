/**
 * Insight Graph - 논문, 증거, 아이디어 간의 관계를 시각화하는 SVG 기반 그래프
 * ES Module: { bus, EVT } from '../core/event-bus.js' 필수
 */

import { bus, EVT } from '../core/event-bus.js';

// 관계 타입 정의 및 스타일
const RELATION_TYPES = {
  supports: { color: '#2E7D32', label: '지지' },
  contradicts: { color: '#C62828', label: '반박' },
  extends: { color: '#2196F3', label: '확장' },
  uses_same_dataset: { color: '#9C27B0', label: '동일 데이터' },
  shares_limitation: { color: '#E65100', label: '공통 한계' }
};

// 노드 타입별 색상
const NODE_COLORS = {
  paper: '#2196F3',
  evidence: '#FF9800',
  idea: '#9C27B0'
};

// 상태 저장소
let state = null;
let containerEl = null;
let selectedNodes = new Set();
let isDragging = false;
let draggedNode = null;
let nodePositions = new Map(); // node id -> {x, y}
let svgElement = null;

/**
 * 초기화: 상태와 버스 설정
 */
export function initInsightGraph(stateRef, eventBus) {
  state = stateRef;

  // 그래프 데이터 구조 초기화
  if (!state.research) state.research = {};
  if (!state.research.insightGraph) {
    state.research.insightGraph = {
      nodes: [],
      edges: []
    };
  }

  // 이벤트 리스너 등록
  eventBus.on(EVT.PAPER_ADDED, () => updateGraphFromPapers());
  eventBus.on(EVT.EVIDENCE_ADDED, () => updateGraphFromEvidence());
}

/**
 * 논문과 증거 데이터에서 노드 동기화
 */
function updateGraphFromPapers() {
  const graph = state.research.insightGraph;

  if (state.research.papers) {
    state.research.papers.forEach(paper => {
      const exists = graph.nodes.some(n => n.id === `paper-${paper.id}`);
      if (!exists) {
        graph.nodes.push({
          id: `paper-${paper.id}`,
          type: 'paper',
          label: paper.title.substring(0, 30),
          paperId: paper.id
        });
      }
    });
  }
}

function updateGraphFromEvidence() {
  const graph = state.research.insightGraph;

  if (state.research.evidenceCards) {
    state.research.evidenceCards.forEach(card => {
      const exists = graph.nodes.some(n => n.id === `evidence-${card.id}`);
      if (!exists) {
        const quote = card.quote || card.text || '';
        graph.nodes.push({
          id: `evidence-${card.id}`,
          type: 'evidence',
          label: quote.substring(0, 25),
          paperId: card.paperId
        });
      }
    });
  }
}

/**
 * 그래프 렌더링
 */
export function renderInsightGraph(container) {
  containerEl = container;
  containerEl.innerHTML = '';

  const graph = state.research.insightGraph;
  if (!graph.nodes || graph.nodes.length === 0) {
    containerEl.innerHTML = '<div style="padding: 20px; color: var(--muted);">노드가 없습니다. 논문이나 증거를 추가하세요.</div>';
    return;
  }

  // 초기 위치 설정
  initializeNodePositions();

  // 힘 시뮬레이션 실행 (100번 반복)
  runForceSimulation(100);

  // SVG 렌더링
  const width = containerEl.clientWidth || 800;
  const height = containerEl.clientHeight || 600;

  svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgElement.setAttribute('width', width);
  svgElement.setAttribute('height', height);
  svgElement.style.border = '1px solid var(--line)';
  svgElement.style.background = 'var(--bg)';

  // 엣지 렌더링 (노드 뒤에)
  const edgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  graph.edges.forEach(edge => {
    const sourceNode = graph.nodes.find(n => n.id === edge.source);
    const targetNode = graph.nodes.find(n => n.id === edge.target);
    if (sourceNode && targetNode) {
      const sourcePosNode = nodePositions.get(edge.source);
      const targetPosNode = nodePositions.get(edge.target);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', sourcePosNode.x);
      line.setAttribute('y1', sourcePosNode.y);
      line.setAttribute('x2', targetPosNode.x);
      line.setAttribute('y2', targetPosNode.y);
      line.setAttribute('stroke', RELATION_TYPES[edge.type]?.color || '#999');
      line.setAttribute('stroke-width', 2);
      line.setAttribute('opacity', 0.6);
      edgeGroup.appendChild(line);

      // 엣지 라벨
      const midX = (sourcePosNode.x + targetPosNode.x) / 2;
      const midY = (sourcePosNode.y + targetPosNode.y) / 2;
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', midX);
      label.setAttribute('y', midY);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '11');
      label.setAttribute('fill', 'var(--muted)');
      label.setAttribute('pointer-events', 'none');
      label.textContent = RELATION_TYPES[edge.type]?.label || edge.type;
      edgeGroup.appendChild(label);
    }
  });
  svgElement.appendChild(edgeGroup);

  // 노드 렌더링
  const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  graph.nodes.forEach(node => {
    const pos = nodePositions.get(node.id);
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', pos.x);
    circle.setAttribute('cy', pos.y);
    circle.setAttribute('r', 20);
    circle.setAttribute('fill', NODE_COLORS[node.type] || '#999');
    circle.setAttribute('stroke', selectedNodes.has(node.id) ? '#FFF' : 'none');
    circle.setAttribute('stroke-width', selectedNodes.has(node.id) ? 3 : 0);
    circle.style.cursor = 'pointer';
    circle.dataset.nodeId = node.id;
    circle.dataset.nodeType = node.type;
    circle.dataset.nodeLabel = node.label;
    circle.dataset.paperId = node.paperId || '';

    circle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNodeSelection(node.id);
      renderInsightGraph(containerEl);
    });

    circle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = true;
      draggedNode = node.id;
    });

    circle.addEventListener('mouseover', () => {
      circle.setAttribute('opacity', 0.8);
    });

    circle.addEventListener('mouseout', () => {
      circle.setAttribute('opacity', 1);
    });

    nodeGroup.appendChild(circle);

    // 노드 라벨
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', pos.x);
    text.setAttribute('y', pos.y + 4);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '10');
    text.setAttribute('fill', '#FFF');
    text.setAttribute('pointer-events', 'none');
    text.textContent = node.label;
    nodeGroup.appendChild(text);
  });
  svgElement.appendChild(nodeGroup);

  // 마우스 이벤트
  svgElement.addEventListener('mousemove', (e) => {
    if (isDragging && draggedNode) {
      const rect = svgElement.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const pos = nodePositions.get(draggedNode);
      pos.x = x;
      pos.y = y;
      renderInsightGraph(containerEl);
    }
  });

  svgElement.addEventListener('mouseup', () => {
    isDragging = false;
    draggedNode = null;
  });

  containerEl.appendChild(svgElement);

  // UI 컨트롤
  renderControls();
}

/**
 * 노드 위치 초기화 (원형 배치)
 */
function initializeNodePositions() {
  const graph = state.research.insightGraph;
  const width = containerEl.clientWidth || 800;
  const height = containerEl.clientHeight || 600;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 3;

  graph.nodes.forEach((node, index) => {
    if (!nodePositions.has(node.id)) {
      const angle = (index / graph.nodes.length) * 2 * Math.PI;
      nodePositions.set(node.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        vx: 0,
        vy: 0
      });
    }
  });
}

/**
 * 간단한 힘 시뮬레이션 (Verlet 적분)
 */
function runForceSimulation(iterations) {
  const graph = state.research.insightGraph;
  const width = containerEl.clientWidth || 800;
  const height = containerEl.clientHeight || 600;

  for (let iter = 0; iter < iterations; iter++) {
    // 반발력 계산 (노드 간)
    graph.nodes.forEach(nodeA => {
      const posA = nodePositions.get(nodeA.id);
      if (!posA) return;

      let fx = 0, fy = 0;

      graph.nodes.forEach(nodeB => {
        if (nodeA.id === nodeB.id) return;

        const posB = nodePositions.get(nodeB.id);
        if (!posB) return;

        const dx = posA.x - posB.x;
        const dy = posA.y - posB.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 1;
        const repulsion = 5000 / (dist * dist);

        fx += (dx / dist) * repulsion;
        fy += (dy / dist) * repulsion;
      });

      posA.vx = (posA.vx + fx) * 0.9;
      posA.vy = (posA.vy + fy) * 0.9;
    });

    // 인력 계산 (연결된 노드)
    graph.edges.forEach(edge => {
      const posA = nodePositions.get(edge.source);
      const posB = nodePositions.get(edge.target);
      if (!posA || !posB) return;

      const dx = posB.x - posA.x;
      const dy = posB.y - posA.y;
      const dist = Math.sqrt(dx * dx + dy * dy) + 1;
      const attraction = 0.05 * dist;

      posA.vx += (dx / dist) * attraction;
      posA.vy += (dy / dist) * attraction;
      posB.vx -= (dx / dist) * attraction;
      posB.vy -= (dy / dist) * attraction;
    });

    // 위치 업데이트 및 경계 체크
    graph.nodes.forEach(node => {
      const pos = nodePositions.get(node.id);
      if (!pos) return;

      pos.x += pos.vx;
      pos.y += pos.vy;

      // 경계 내 유지
      pos.x = Math.max(30, Math.min(width - 30, pos.x));
      pos.y = Math.max(30, Math.min(height - 30, pos.y));
    });
  }
}

/**
 * UI 컨트롤 패널 렌더링
 */
function renderControls() {
  const controlPanel = document.createElement('div');
  controlPanel.style.marginTop = '15px';
  controlPanel.style.display = 'flex';
  controlPanel.style.gap = '10px';
  controlPanel.style.flexWrap = 'wrap';

  // 관계 추가 버튼
  const addRelationBtn = document.createElement('button');
  addRelationBtn.textContent = '관계 추가';
  addRelationBtn.style.padding = '8px 12px';
  addRelationBtn.style.backgroundColor = 'var(--brand)';
  addRelationBtn.style.color = '#FFF';
  addRelationBtn.style.border = 'none';
  addRelationBtn.style.borderRadius = '4px';
  addRelationBtn.style.cursor = 'pointer';
  addRelationBtn.disabled = selectedNodes.size !== 2;
  addRelationBtn.addEventListener('click', () => {
    const [source, target] = Array.from(selectedNodes);
    showRelationTypeDialog(source, target);
  });
  controlPanel.appendChild(addRelationBtn);

  // 서브그래프 내보내기 버튼
  const exportBtn = document.createElement('button');
  exportBtn.textContent = '서브그래프 → 텍스트';
  exportBtn.style.padding = '8px 12px';
  exportBtn.style.backgroundColor = 'var(--brand)';
  exportBtn.style.color = '#FFF';
  exportBtn.style.border = 'none';
  exportBtn.style.borderRadius = '4px';
  exportBtn.style.cursor = 'pointer';
  exportBtn.disabled = selectedNodes.size === 0;
  exportBtn.addEventListener('click', () => {
    const text = exportSubgraphAsText(Array.from(selectedNodes));
    showExportDialog(text);
  });
  controlPanel.appendChild(exportBtn);

  // 선택 해제 버튼
  const clearBtn = document.createElement('button');
  clearBtn.textContent = '선택 해제';
  clearBtn.style.padding = '8px 12px';
  clearBtn.style.backgroundColor = 'var(--muted)';
  clearBtn.style.color = '#FFF';
  clearBtn.style.border = 'none';
  clearBtn.style.borderRadius = '4px';
  clearBtn.style.cursor = 'pointer';
  clearBtn.disabled = selectedNodes.size === 0;
  clearBtn.addEventListener('click', () => {
    selectedNodes.clear();
    renderInsightGraph(containerEl);
  });
  controlPanel.appendChild(clearBtn);

  // 노드 선택 상태 표시
  const statusDiv = document.createElement('div');
  statusDiv.style.color = 'var(--muted)';
  statusDiv.style.fontSize = '12px';
  statusDiv.textContent = `선택됨: ${selectedNodes.size}/${state.research.insightGraph.nodes.length}`;
  controlPanel.appendChild(statusDiv);

  containerEl.appendChild(controlPanel);
}

/**
 * 노드 선택 토글
 */
function toggleNodeSelection(nodeId) {
  if (selectedNodes.has(nodeId)) {
    selectedNodes.delete(nodeId);
  } else {
    selectedNodes.add(nodeId);
  }
}

/**
 * 관계 타입 선택 다이얼로그
 */
function showRelationTypeDialog(source, target) {
  const dialog = document.createElement('div');
  dialog.style.position = 'fixed';
  dialog.style.top = '50%';
  dialog.style.left = '50%';
  dialog.style.transform = 'translate(-50%, -50%)';
  dialog.style.background = 'var(--panel)';
  dialog.style.border = '1px solid var(--line)';
  dialog.style.borderRadius = '8px';
  dialog.style.padding = '20px';
  dialog.style.zIndex = '1000';
  dialog.style.minWidth = '300px';

  const title = document.createElement('h3');
  title.textContent = '관계 타입 선택';
  title.style.margin = '0 0 15px 0';
  title.style.color = 'var(--text)';
  dialog.appendChild(title);

  const typeButtons = document.createElement('div');
  typeButtons.style.display = 'flex';
  typeButtons.style.flexDirection = 'column';
  typeButtons.style.gap = '8px';

  Object.entries(RELATION_TYPES).forEach(([type, { color, label }]) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.padding = '8px 12px';
    btn.style.backgroundColor = color;
    btn.style.color = '#FFF';
    btn.style.border = 'none';
    btn.style.borderRadius = '4px';
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', () => {
      addRelation(source, target, type);
      selectedNodes.clear();
      renderInsightGraph(containerEl);
      document.body.removeChild(overlay);
    });
    typeButtons.appendChild(btn);
  });

  dialog.appendChild(typeButtons);

  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.right = '0';
  overlay.style.bottom = '0';
  overlay.style.background = 'rgba(0, 0, 0, 0.5)';
  overlay.style.zIndex = '999';
  overlay.addEventListener('click', () => document.body.removeChild(overlay));

  document.body.appendChild(overlay);
  document.body.appendChild(dialog);
}

/**
 * 서브그래프 내보내기 다이얼로그
 */
function showExportDialog(text) {
  const dialog = document.createElement('div');
  dialog.style.position = 'fixed';
  dialog.style.top = '50%';
  dialog.style.left = '50%';
  dialog.style.transform = 'translate(-50%, -50%)';
  dialog.style.background = 'var(--panel)';
  dialog.style.border = '1px solid var(--line)';
  dialog.style.borderRadius = '8px';
  dialog.style.padding = '20px';
  dialog.style.zIndex = '1000';
  dialog.style.maxWidth = '600px';
  dialog.style.maxHeight = '80vh';
  dialog.style.overflow = 'auto';

  const title = document.createElement('h3');
  title.textContent = '관련 연구 텍스트';
  title.style.margin = '0 0 15px 0';
  title.style.color = 'var(--text)';
  dialog.appendChild(title);

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.width = '100%';
  textarea.style.height = '200px';
  textarea.style.padding = '10px';
  textarea.style.border = '1px solid var(--line)';
  textarea.style.borderRadius = '4px';
  textarea.style.fontFamily = 'monospace';
  textarea.style.fontSize = '12px';
  textarea.style.color = 'var(--text)';
  textarea.style.background = 'var(--bg)';
  textarea.style.resize = 'vertical';
  dialog.appendChild(textarea);

  const btnContainer = document.createElement('div');
  btnContainer.style.marginTop = '15px';
  btnContainer.style.display = 'flex';
  btnContainer.style.gap = '10px';

  const copyBtn = document.createElement('button');
  copyBtn.textContent = '복사';
  copyBtn.style.padding = '8px 12px';
  copyBtn.style.backgroundColor = 'var(--brand)';
  copyBtn.style.color = '#FFF';
  copyBtn.style.border = 'none';
  copyBtn.style.borderRadius = '4px';
  copyBtn.style.cursor = 'pointer';
  copyBtn.addEventListener('click', () => {
    textarea.select();
    document.execCommand('copy');
    copyBtn.textContent = '복사됨!';
    setTimeout(() => { copyBtn.textContent = '복사'; }, 2000);
  });
  btnContainer.appendChild(copyBtn);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '닫기';
  closeBtn.style.padding = '8px 12px';
  closeBtn.style.backgroundColor = 'var(--muted)';
  closeBtn.style.color = '#FFF';
  closeBtn.style.border = 'none';
  closeBtn.style.borderRadius = '4px';
  closeBtn.style.cursor = 'pointer';
  closeBtn.addEventListener('click', () => {
    document.body.removeChild(overlay);
    document.body.removeChild(dialog);
  });
  btnContainer.appendChild(closeBtn);

  dialog.appendChild(btnContainer);

  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.right = '0';
  overlay.style.bottom = '0';
  overlay.style.background = 'rgba(0, 0, 0, 0.5)';
  overlay.style.zIndex = '999';
  overlay.addEventListener('click', () => {
    document.body.removeChild(overlay);
    document.body.removeChild(dialog);
  });

  document.body.appendChild(overlay);
  document.body.appendChild(dialog);
}

/**
 * 관계 추가
 */
export function addRelation(sourceId, targetId, type) {
  const graph = state.research.insightGraph;
  const edgeId = `edge-${Date.now()}`;

  graph.edges.push({
    id: edgeId,
    source: sourceId,
    target: targetId,
    type: type,
    note: ''
  });

  bus.emit(EVT.RELATION_ADDED, { edgeId, sourceId, targetId, type });
}

/**
 * 관계 제거
 */
export function removeRelation(edgeId) {
  const graph = state.research.insightGraph;
  const index = graph.edges.findIndex(e => e.id === edgeId);

  if (index !== -1) {
    graph.edges.splice(index, 1);
    bus.emit(EVT.RELATION_REMOVED, { edgeId });
  }
}

/**
 * 모든 관계 조회
 */
export function getRelations() {
  return state.research.insightGraph.edges || [];
}

/**
 * 서브그래프를 텍스트로 내보내기
 */
export function exportSubgraphAsText(nodeIds) {
  const graph = state.research.insightGraph;
  const selectedPapers = new Map();
  const selectedEvidence = new Map();

  // 선택된 노드와 연결된 논문/증거 수집
  nodeIds.forEach(nodeId => {
    const node = graph.nodes.find(n => n.id === nodeId);
    if (!node) return;

    if (node.type === 'paper') {
      selectedPapers.set(node.id, node);
    } else if (node.type === 'evidence') {
      selectedEvidence.set(node.id, node);
      if (node.paperId) {
        const paper = graph.nodes.find(n => n.id === `paper-${node.paperId}`);
        if (paper) selectedPapers.set(paper.id, paper);
      }
    }
  });

  // 선택된 노드 간 엣지 수집
  const relevantEdges = graph.edges.filter(edge =>
    nodeIds.includes(edge.source) && nodeIds.includes(edge.target)
  );

  // 논문과 관계로부터 텍스트 생성
  let segments = [];

  relevantEdges.forEach((edge, index) => {
    const sourceNode = graph.nodes.find(n => n.id === edge.source);
    const targetNode = graph.nodes.find(n => n.id === edge.target);

    if (!sourceNode || !targetNode) return;

    const sourceLabel = sourceNode.label;
    const targetLabel = targetNode.label;
    const relationLabel = RELATION_TYPES[edge.type]?.label || edge.type;

    let segment = '';
    if (index === 0) {
      segment = `[${sourceLabel}] [cite] ${relationLabel === '지지' ? '에서' : ''} ${targetLabel}`;
    } else {
      segment = `한편 [${targetLabel}] [cite] ${relationLabel} 관계를 보임`;
    }

    segments.push(segment);
  });

  if (segments.length === 0) {
    return '선택된 노드 간의 관계가 없습니다.';
  }

  return segments.join('. ') + '.';
}
