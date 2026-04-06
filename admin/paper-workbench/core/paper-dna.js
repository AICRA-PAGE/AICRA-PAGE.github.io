// Paper DNA Engine - 논문 완성도 분석 및 다음 액션 추천
// Analyzes paper state across all 7 phases and produces completeness profile

import { bus, EVT } from './event-bus.js';

let state = null;
let eventBus = null;

/**
 * Paper DNA 엔진 초기화
 * @param {Object} appState - 전체 애플리케이션 상태
 * @param {Object} eventBusInstance - 이벤트 버스 인스턴스
 */
export function initPaperDNA(appState, eventBusInstance) {
  state = appState;
  eventBus = eventBusInstance;
}

/**
 * 논문의 DNA(완성도 프로필) 분석
 * @param {Object} paper - 논문 객체
 * @returns {Object} DNA 분석 결과
 */
export function analyzeDNA(paper) {
  if (!paper) {
    return {
      dimensions: {},
      overallScore: 0,
      phase: 'plan',
    };
  }

  // 각 차원별 점수 계산
  const contentScore = calculateContentScore(paper);
  const referencesScore = calculateReferencesScore(paper);
  const structureScore = calculateStructureScore(paper);
  const evidenceScore = calculateEvidenceScore(paper);
  const validationScore = calculateValidationScore(paper);
  const reviewScore = calculateReviewScore(paper);
  const submissionScore = calculateSubmissionScore(paper);

  const dimensions = {
    content: {
      score: contentScore.score,
      label: '본문',
      detail: contentScore.detail,
    },
    references: {
      score: referencesScore.score,
      label: '참고문헌',
      detail: referencesScore.detail,
    },
    structure: {
      score: structureScore.score,
      label: '구조',
      detail: structureScore.detail,
    },
    evidence: {
      score: evidenceScore.score,
      label: '근거',
      detail: evidenceScore.detail,
    },
    validation: {
      score: validationScore.score,
      label: '검증',
      detail: validationScore.detail,
    },
    review: {
      score: reviewScore.score,
      label: '심사',
      detail: reviewScore.detail,
    },
    submission: {
      score: submissionScore.score,
      label: '투고',
      detail: submissionScore.detail,
    },
  };

  // 전체 점수 계산 (7개 차원의 평균)
  const scores = Object.values(dimensions).map(d => d.score);
  const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  // 현재 단계 추천
  const phase = recommendCurrentPhase(dimensions, overallScore);

  // 이벤트 발생
  if (eventBus) {
    eventBus.emit(EVT.DNA_ANALYZED, { dimensions, overallScore, phase });
  }

  return {
    dimensions,
    overallScore,
    phase,
  };
}

/**
 * 추천 액션 도출
 * @param {Object} dna - DNA 분석 결과
 * @returns {Array} 추천 액션 배열 (priority 순서)
 */
export function getRecommendedActions(dna) {
  const actions = [];
  const paper = state?.paper || {};

  const bodyLength = paper.body ? paper.body.length : 0;
  const refCount = paper.references ? paper.references.length : 0;
  const hasOutline = paper.outline && paper.outline.sections && paper.outline.sections.length > 0;
  const evidenceCount = paper.evidenceCards ? paper.evidenceCards.length : 0;
  const hasValidation = paper.refine && paper.refine.validationResults && paper.refine.validationResults.length > 0;
  const reviewSimCount = paper.review && paper.review.simulations ? paper.review.simulations.length : 0;
  const hasVenue = paper.submission && paper.submission.venue;

  // Rule 1: 본문이 있는데 참고문헌이 없음 -> 참고문헌 추가 (high priority)
  if (bodyLength > 3000 && refCount === 0) {
    actions.push({
      id: 'action-cite-urgent',
      label: '참고문헌 추가가 시급합니다',
      description: '본문 대비 참고문헌 비율이 낮습니다. 최소 15편 이상의 학술자료를 수집하세요.',
      commandId: 'draft.cite',
      priority: 'high',
      phase: 'draft',
    });
  }

  // Rule 2: 본문이 없지만 아웃라인이 있음 -> 집필 시작 (high priority)
  if (bodyLength === 0 && hasOutline) {
    actions.push({
      id: 'action-write-start',
      label: '아웃라인을 바탕으로 집필을 시작하세요',
      description: '5개 섹션의 구조가 준비되어 있습니다. 이제 각 섹션의 본문을 작성할 시간입니다.',
      commandId: 'draft.write',
      priority: 'high',
      phase: 'draft',
    });
  }

  // Rule 3: 본문이 충분하고 검증이 되지 않음 -> 품질 검증 (medium priority)
  if (bodyLength > 5000 && !hasValidation) {
    actions.push({
      id: 'action-validate-quality',
      label: '품질 검증 실행을 권장합니다',
      description: '본문이 5000자 이상입니다. 논리성, 증거 연결, 문맥 일관성을 점검하세요.',
      commandId: 'refine.validate',
      priority: 'medium',
      phase: 'refine',
    });
  }

  // Rule 4: 참고문헌은 있지만 증거 카드가 없음 -> 증거 카드 추출 (medium priority)
  if (refCount > 5 && evidenceCount === 0) {
    actions.push({
      id: 'action-extract-evidence',
      label: '읽은 논문에서 증거 카드를 추출하세요',
      description: `${refCount}편의 참고문헌을 수집했습니다. 각 자료에서 핵심 증거를 카드 형태로 정리하면 본문 작성이 수월해집니다.`,
      commandId: 'draft.evidence',
      priority: 'medium',
      phase: 'draft',
    });
  }

  // Rule 5: 본문이 충분한데 투고 대상이 없음 -> 학회 선택 (medium priority)
  if (bodyLength > 10000 && !hasVenue) {
    actions.push({
      id: 'action-select-venue',
      label: '투고 대상 학회를 선택하세요',
      description: '본문 10000자 이상, 참고문헌도 충분합니다. 학회 특성에 맞게 투고 형식을 조정할 수 있도록 대상을 정하세요.',
      commandId: 'submission.venue',
      priority: 'medium',
      phase: 'submission',
    });
  }

  // Rule 6: 모든 점수 > 60인데 심사 시뮬레이션이 없음 -> 시뮬레이션 (low priority)
  if (dna.dimensions &&
      Object.values(dna.dimensions).every(d => d.score > 60) &&
      reviewSimCount === 0) {
    actions.push({
      id: 'action-review-simulation',
      label: '심사 시뮬레이션으로 약점을 발견하세요',
      description: '모든 항목이 60점 이상입니다. 가상의 심사 과정을 거쳐 개선점을 찾으면 최종 품질이 높아집니다.',
      commandId: 'review.simulate',
      priority: 'low',
      phase: 'review',
    });
  }

  // Rule 7: 참고문헌이 부족함 -> 참고문헌 추가 (medium priority, 이미 있으면 스킵)
  if (refCount < 15 && refCount > 0 && !actions.some(a => a.commandId === 'draft.cite')) {
    actions.push({
      id: 'action-expand-refs',
      label: `참고문헌을 더 추가하세요 (현재 ${refCount}편, 목표 15편)`,
      description: '학술 신뢰성을 위해 최소 15편 이상의 참고문헌이 필요합니다.',
      commandId: 'draft.cite',
      priority: 'medium',
      phase: 'draft',
    });
  }

  // Rule 8: 증거 카드는 있지만 본문에 연결되지 않음 -> 증거 연결 (low priority)
  if (evidenceCount > 0 && bodyLength < 10000) {
    actions.push({
      id: 'action-link-evidence',
      label: '증거 카드를 본문에 연결하세요',
      description: '추출한 증거를 본문 내 적절한 위치에 인용하여 논지를 강화하세요.',
      commandId: 'draft.linkEvidence',
      priority: 'low',
      phase: 'draft',
    });
  }

  // Priority 정렬: high > medium > low
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // 상위 3-5개만 반환
  return actions.slice(0, 5);
}

// ============================================================================
// 내부 함수들: 각 차원별 점수 계산
// ============================================================================

/**
 * 본문 점수 계산
 */
function calculateContentScore(paper) {
  const body = paper.body || '';
  const bodyLength = body.length;
  const targetLength = 15000; // 목표: 15000자

  let score = Math.min(100, (bodyLength / targetLength) * 100);

  // 아웃라인 섹션별 커버리지 확인
  if (paper.outline && paper.outline.sections) {
    const sections = paper.outline.sections;
    let coveredSections = 0;

    sections.forEach(section => {
      if (section.content && section.content.trim().length > 0) {
        coveredSections++;
      }
    });

    const sectionCoverageRatio = sections.length > 0 ? coveredSections / sections.length : 0;
    const coverageBonus = sectionCoverageRatio * 30; // 최대 30점 보너스

    score = Math.min(100, score + (coverageBonus * 0.5));
  }

  const detail = `${bodyLength}자 / 목표 ${targetLength}자`;

  return { score: Math.round(score), detail };
}

/**
 * 참고문헌 점수 계산
 */
function calculateReferencesScore(paper) {
  const references = paper.references || [];
  const refCount = references.length;

  // 기본 점수: 15편 이상 = 100%
  let score = Math.min(100, (refCount / 15) * 100);

  // 인용 밀도 체크: 1000자당 인용수
  const bodyLength = paper.body ? paper.body.length : 0;
  if (bodyLength > 0) {
    const citationDensity = (refCount / (bodyLength / 1000)); // 1000자당 인용수
    // 이상적인 인용 밀도: 1000자당 1편 정도
    if (citationDensity > 1) {
      score = Math.min(100, score + 10);
    }
  }

  const detail = `${refCount}편 수집`;

  return { score: Math.round(score), detail };
}

/**
 * 구조 점수 계산
 */
function calculateStructureScore(paper) {
  let score = 0;

  // 아웃라인 존재 여부 (40점)
  if (paper.outline && paper.outline.sections && paper.outline.sections.length > 0) {
    score += 40;

    // 섹션 수 (최대 20점)
    const sectionCount = paper.outline.sections.length;
    score += Math.min(20, (sectionCount / 5) * 20); // 5섹션 = 20점

    // 각 섹션이 내용을 가지고 있는지 (최대 20점)
    const sections = paper.outline.sections;
    const sectionsWithContent = sections.filter(s => s.content && s.content.trim().length > 0).length;
    score += (sectionsWithContent / sections.length) * 20;

    // 핵심 질문(RQ) 정의 여부 (20점)
    if (paper.researchQuestion && paper.researchQuestion.trim().length > 0) {
      score += 20;
    }
  } else if (paper.researchQuestion && paper.researchQuestion.trim().length > 0) {
    // RQ만 있으면 30점
    score = 30;
  }

  score = Math.min(100, score);
  const sectionCount = paper.outline ? paper.outline.sections.length : 0;
  const detail = sectionCount > 0 ? `아웃라인 ${sectionCount}섹션` : '아웃라인 미작성';

  return { score: Math.round(score), detail };
}

/**
 * 근거 점수 계산
 */
function calculateEvidenceScore(paper) {
  const evidenceCards = paper.evidenceCards || [];
  const cardCount = evidenceCards.length;

  // 기본 점수: 10개 이상 = 100%
  let score = Math.min(100, (cardCount / 10) * 100);

  // 링킹 비율 확인 (카드가 본문에 인용되고 있는지)
  if (cardCount > 0) {
    const linkedCount = evidenceCards.filter(card => card.linkedTo && card.linkedTo.length > 0).length;
    const linkingRatio = linkedCount / cardCount;

    if (linkingRatio > 0.7) {
      // 70% 이상 링킹됨 -> 추가 점수
      score = Math.min(100, score + 15);
    } else if (linkingRatio > 0.3) {
      // 30-70% 링킹됨 -> 약간의 추가 점수
      score = Math.min(100, score + 5);
    }
  }

  const detail = cardCount > 0 ? `증거카드 ${cardCount}개` : '증거카드 미작성';

  return { score: Math.round(score), detail };
}

/**
 * 검증 점수 계산
 */
function calculateValidationScore(paper) {
  const refine = paper.refine || {};
  const validationResults = refine.validationResults || [];

  let score = 0;

  if (validationResults.length > 0) {
    // 검증이 실행됨 (기본 50점)
    score = 50;

    // 검증 항목별 점수
    // 논리성, 증거 연결, 문맥 일관성 등
    const passedChecks = validationResults.filter(r => r.status === 'pass').length;
    const checkRatio = passedChecks / Math.max(1, validationResults.length);

    score += checkRatio * 50; // 최대 50점
  }

  score = Math.min(100, score);

  const detail = validationResults.length > 0
    ? `${validationResults.length}회 검증 완료`
    : '검증 미실행';

  return { score: Math.round(score), detail };
}

/**
 * 심사 점수 계산
 */
function calculateReviewScore(paper) {
  const review = paper.review || {};
  const simulations = review.simulations || [];
  const annotations = review.externalAnnotations || [];

  let score = 0;

  // 시뮬레이션 (기본 70점)
  if (simulations.length > 0) {
    score = 70;
    // 시뮬레이션 횟수 보너스 (최대 15점)
    score += Math.min(15, simulations.length * 5);
  }

  // 외부 피드백 (최대 15점)
  if (annotations.length > 0) {
    score += Math.min(15, annotations.length * 3);
  }

  score = Math.min(100, score);

  const detail = simulations.length > 0
    ? `시뮬레이션 ${simulations.length}회`
    : '시뮬레이션 0회';

  return { score: Math.round(score), detail };
}

/**
 * 투고 점수 계산
 */
function calculateSubmissionScore(paper) {
  const submission = paper.submission || {};

  let score = 0;

  // 학회 선택 (40점)
  if (submission.venue && submission.venue.trim().length > 0) {
    score += 40;
  }

  // 프리플라이트 실행 (30점)
  if (submission.preflightRun && submission.preflightRun.length > 0) {
    score += 30;
  }

  // 커버레터 작성 (30점)
  if (submission.coverLetter && submission.coverLetter.trim().length > 0) {
    score += 30;
  }

  score = Math.min(100, score);

  const detail = submission.venue
    ? `학회: ${submission.venue}`
    : '학회 미선택';

  return { score: Math.round(score), detail };
}

/**
 * 현재 단계 추천
 */
function recommendCurrentPhase(dimensions, overallScore) {
  // 점수에 따른 단계 추천
  if (!dimensions || Object.keys(dimensions).length === 0) {
    return 'plan';
  }

  const contentScore = dimensions.content?.score || 0;
  const structureScore = dimensions.structure?.score || 0;
  const validationScore = dimensions.validation?.score || 0;
  const reviewScore = dimensions.review?.score || 0;

  // plan -> draft (아웃라인이 준비되고 본문 작성 시작)
  if (structureScore > 50 && contentScore < 50) {
    return 'draft';
  }

  // draft -> refine (본문이 충분하면 검증 단계로)
  if (contentScore > 50 && validationScore < 30) {
    return 'refine';
  }

  // refine -> review (검증이 완료되면 심사 단계로)
  if (validationScore > 50 && reviewScore < 30) {
    return 'review';
  }

  // review -> submission (심사 준비가 완료되면 투고 단계로)
  if (reviewScore > 50 && overallScore > 70) {
    return 'submission';
  }

  // 기본값
  if (contentScore < 30) return 'draft';
  if (validationScore < 30) return 'refine';
  if (reviewScore < 30) return 'review';
  return 'submission';
}

export default {
  initPaperDNA,
  analyzeDNA,
  getRecommendedActions,
};
