/**
 * event-bus.js -- Phase 간 느슨한 통신 채널
 *
 * 설계 의도:
 * - Phase 모듈들이 서로를 직접 import하지 않는다.
 * - 데이터 변경 시 이벤트를 발행(emit)하면, 관심 있는 Phase가 구독(on)해서 반응한다.
 * - 예: Draft에서 인용 추가 -> 'citation:added' 발행 -> Research가 문헌 목록 갱신
 *
 * 사용법:
 *   import { bus, EVT } from './event-bus.js';
 *   bus.on(EVT.BODY_CHANGED, (data) => { ... });
 *   bus.emit(EVT.BODY_CHANGED, { section: 'intro' });
 */

class EventBus {
  constructor() {
    /** @type {Object<string, Function[]>} 이벤트별 구독자 목록 */
    this._listeners = {};
  }

  /**
   * on -- 이벤트 구독
   * @param {string} event    이벤트 이름 (예: 'citation:added')
   * @param {Function} callback  이벤트 발생 시 호출할 함수
   * @returns {Function} 구독 해제 함수 (cleanup용)
   */
  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
    /* 구독 해제 함수를 반환 -- deactivate()에서 정리할 때 사용 */
    return () => this.off(event, callback);
  }

  /**
   * once -- 1회성 구독 (이벤트 발생 후 자동 해제)
   * @param {string} event
   * @param {Function} callback
   */
  once(event, callback) {
    const wrapper = (data) => {
      this.off(event, wrapper);
      callback(data);
    };
    this.on(event, wrapper);
  }

  /**
   * emit -- 이벤트 발행 (모든 구독자에게 데이터 전달)
   * @param {string} event  이벤트 이름
   * @param {*} data        전달할 데이터 (임의 형태)
   */
  emit(event, data) {
    /* 해당 이벤트 구독자 호출 */
    const handlers = this._listeners[event];
    if (handlers) {
      handlers.forEach(fn => {
        try { fn(data); }
        catch (err) { console.error(`[EventBus] ${event} 핸들러 오류:`, err); }
      });
    }
    /* 와일드카드('*') 구독자에게도 전달 -- 로깅, 디버깅, 자동저장 등 */
    const wildcards = this._listeners['*'];
    if (wildcards) {
      wildcards.forEach(fn => {
        try { fn(event, data); }
        catch (err) { console.error('[EventBus] 와일드카드 핸들러 오류:', err); }
      });
    }
  }

  /**
   * off -- 구독 해제
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(fn => fn !== callback);
    /* 구독자가 0명이면 키 자체를 제거 (메모리 정리) */
    if (this._listeners[event].length === 0) delete this._listeners[event];
  }

  /**
   * removeAll -- 특정 이벤트의 모든 구독자 제거
   * @param {string} [event]  생략하면 전체 초기화
   */
  removeAll(event) {
    if (event) delete this._listeners[event];
    else this._listeners = {};
  }
}


/* ────────────────────────────────────────────
 * 표준 이벤트 카탈로그
 *
 * 모든 이벤트 이름을 상수로 정의하여
 * 오타로 인한 구독 누락을 방지한다.
 * ──────────────────────────────────────────── */
export const EVT = {
  /* ── Phase 전환 ── */
  PHASE_CHANGED:      'phase:changed',       // phase 전환 완료
  PHASE_READY:        'phase:ready',         // phase 모듈 로딩 완료

  /* ── Research (문헌 조사) ── */
  PAPER_ADDED:        'research:paper-added',       // 논문 수집됨
  PAPER_REMOVED:      'research:paper-removed',     // 논문 제거됨
  GAP_IDENTIFIED:     'research:gap-identified',    // 연구 갭 발견됨
  RQ_ADDED:           'research:rq-added',          // 연구 질문 추가됨
  RQ_UPDATED:         'research:rq-updated',        // 연구 질문 수정됨
  LIT_MATRIX_UPDATED: 'research:matrix-updated',    // 문헌 매트릭스 갱신됨

  /* ── Plan (논증 설계) ── */
  OUTLINE_UPDATED:    'plan:outline-updated',       // 아웃라인 변경됨
  ARGUMENT_MAPPED:    'plan:argument-mapped',       // 논증 구조 매핑됨
  MILESTONE_UPDATED:  'plan:milestone-updated',     // 일정 갱신됨

  /* ── Draft (집필) ── */
  BODY_CHANGED:       'draft:body-changed',         // 본문 변경됨
  SECTION_COMPLETED:  'draft:section-completed',    // 섹션 완성됨
  ABSTRACT_UPDATED:   'draft:abstract-updated',     // 초록 갱신됨

  /* ── Refine (품질 검증) ── */
  VALIDATION_DONE:    'refine:validation-done',     // 검증 실행 완료됨
  ISSUE_FOUND:        'refine:issue-found',         // 문제 발견됨
  ISSUE_RESOLVED:     'refine:issue-resolved',      // 문제 해결됨

  /* ── Review (심사 대응) ── */
  REVIEW_RECEIVED:    'review:received',            // 심사 의견 수신됨
  REBUTTAL_DRAFTED:   'review:rebuttal-drafted',    // 반박문 작성됨
  REVISION_SAVED:     'review:revision-saved',      // 수정본 저장됨

  /* ── Submit (투고) ── */
  PREFLIGHT_DONE:     'submit:preflight-done',      // 투고 전 점검 완료됨
  VENUE_SELECTED:     'submit:venue-selected',      // 투고 대상 선택됨
  SUBMISSION_DONE:    'submit:submission-done',      // 투고 완료됨

  /* ── 공유 자원 ── */
  CITATION_ADDED:     'shared:citation-added',      // 참고문헌 추가됨
  CITATION_REMOVED:   'shared:citation-removed',    // 참고문헌 제거됨
  FIGURE_ADDED:       'shared:figure-added',        // 그림 추가됨
  TABLE_ADDED:        'shared:table-added',         // 표 추가됨

  /* ── 저장/불러오기 ── */
  PROJECT_SAVED:      'store:saved',                // 프로젝트 저장됨
  PROJECT_LOADED:     'store:loaded',               // 프로젝트 불러와짐
  SNAPSHOT_CREATED:   'store:snapshot-created',      // 스냅샷 생성됨

  /* ── UI 알림 ── */
  TOAST:              'ui:toast',                    // 토스트 메시지 표시 요청
  HINT:               'ui:hint',                     // Phase 진입 힌트 표시

  /* ── Command Palette (v2) ── */
  CMD_EXECUTED:       'cmd:executed',                // 명령 팔레트에서 명령 실행됨
  CMD_PALETTE_OPEN:   'cmd:palette-open',            // 팔레트 열림
  CMD_PALETTE_CLOSE:  'cmd:palette-close',           // 팔레트 닫힘

  /* ── Evidence Cards (v2) ── */
  EVIDENCE_CREATED:   'evidence:created',            // 증거 카드 생성됨
  EVIDENCE_UPDATED:   'evidence:updated',            // 증거 카드 갱신됨
  EVIDENCE_LINKED:    'evidence:linked',             // 증거 카드가 섹션에 연결됨
  EVIDENCE_REMOVED:   'evidence:removed',            // 증거 카드 제거됨

  /* ── Paper Reader (v2) ── */
  READER_OPENED:      'reader:opened',               // 리더 패널 열림
  READER_CLOSED:      'reader:closed',               // 리더 패널 닫힘
  READER_HIGHLIGHT:   'reader:highlight',             // 리더에서 텍스트 선택됨
  DIGEST_GENERATED:   'reader:digest-generated',      // AI Digest 생성됨

  /* ── Paper DNA (v2) ── */
  DNA_ANALYZED:       'dna:analyzed',                // 논문 상태 분석 완료
  DNA_ACTION_SUGGEST: 'dna:action-suggested',        // 추천 액션 갱신됨

  /* ── Templates (v2) ── */
  TEMPLATE_APPLIED:   'template:applied',            // 템플릿 적용됨

  /* ── Phase 3 확장 (v2) ── */
  RELATION_ADDED:     'graph:relation-added',        // Insight Graph 관계 추가
  RELATION_REMOVED:   'graph:relation-removed',      // Insight Graph 관계 제거
  NOTE_ADDED:         'shared:note-added',           // 메모 추가됨
  STATE_CHANGED:      'state:changed',               // 상태 변경 (범용)

  /* ── 모듈 간 요청 이벤트 (v2) ── */
  EDITOR_FOCUS:       'editor:focus',                // 에디터 포커스 요청
  READER_FOCUS:       'reader:focus',                // 리더 포커스 요청
  EVIDENCE_ADDED:     'evidence:added',              // 증거 카드 추가됨 (alias)
  EVIDENCE_CREATE_DIALOG: 'evidence:create-dialog',  // 증거 카드 생성 다이얼로그 요청
  EVIDENCE_EDIT_DIALOG:   'evidence:edit-dialog',    // 증거 카드 편집 다이얼로그 요청

  /* ── Dock 렌더링 요청 (v2) ── */
  REQUEST_RENDER_EVIDENCE_CARDS: 'dock:render-evidence',     // 증거 카드 패널 렌더 요청
  REQUEST_RENDER_COMPARATIVE:    'dock:render-comparative',  // 비교 보드 렌더 요청
  REQUEST_RENDER_INSIGHT_GRAPH:  'dock:render-graph',        // 인사이트 그래프 렌더 요청
  REQUEST_ANALYZE_DNA:           'dock:render-dna',          // Paper DNA 분석 요청
};


/* ── 싱글턴 인스턴스 ── */
export const bus = new EventBus();

/* ── 디버그 모드: URL에 ?debug=events 추가하면 모든 이벤트를 콘솔에 출력 ── */
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === 'events') {
  bus.on('*', (event, data) => {
    console.log(`%c[EVT] ${event}`, 'color:#2f5d50;font-weight:bold', data);
  });
}
