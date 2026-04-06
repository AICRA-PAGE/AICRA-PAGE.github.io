/**
 * router.js -- Phase 전환 관리자
 *
 * 설계 의도:
 * - URL hash로 현재 phase를 관리한다 (예: #research, #draft)
 * - 각 phase 모듈을 지연 로딩(lazy load)한다 -- 첫 방문 시에만 JS 로드
 * - phase 전환 시 이전 phase의 deactivate()를 호출하여 정리
 * - phase별 "준비도(readyCheck)"를 표시하여 사용자를 안내
 * - phase 전환을 차단하지 않고, 경고만 표시 (자유로운 이동 보장)
 *
 * Phase 모듈 인터페이스 (각 phase .js가 export해야 하는 함수):
 *   init(state, bus)  -- 최초 1회: state, eventBus 주입
 *   activate()        -- phase로 전환 시: UI 렌더링
 *   deactivate()      -- phase에서 떠날 때: 정리 작업
 *   getStatus()       -- 진행 상태: { progress: 0~100, summary: '...' }
 */

import { bus, EVT } from './event-bus.js';


/* ═══════════════════════════════════════════
 * Phase 정의
 *
 * 각 phase의 메타데이터: id, 표시 이름, 모듈 경로, 진입 조건
 *
 * readyCheck(paper) 반환값:
 *   { ready: boolean, hint: string }
 *   ready=false여도 진입을 차단하지 않음 (hint만 표시)
 * ═══════════════════════════════════════════ */
export const PHASES = [
  {
    id: 'research',
    label: '논문 찾기',
    labelFull: '관련 논문 찾기 (문헌 조사)',
    labelEn: 'Research',
    order: 1,
    module: '../phases/1-research/research.js',
    /** 항상 진입 가능 (첫 단계) */
    readyCheck: () => ({ ready: true, hint: '' }),
  },
  {
    id: 'plan',
    label: '구조 잡기',
    labelFull: '주장과 구조 만들기 (논증 설계)',
    labelEn: 'Plan',
    order: 2,
    module: '../phases/2-plan/plan.js',
    /** 연구 질문이 있으면 이상적이지만, 없어도 진입 가능 */
    readyCheck: (paper) => {
      const hasRQ = paper.research.researchQuestions.length > 0;
      const hasBody = (paper.draft.body || '').length > 0;
      return {
        ready: hasRQ || hasBody,
        hint: !hasRQ && !hasBody ? '연구 질문(RQ)을 먼저 정의하면 더 효과적입니다.' : '',
      };
    },
  },
  {
    id: 'draft',
    label: '글쓰기',
    labelFull: '논문 쓰기 (집필)',
    labelEn: 'Draft',
    order: 3,
    module: '../phases/3-draft/draft.js',
    /** 항상 진입 가능 (기존 에디터의 주 기능) */
    readyCheck: () => ({ ready: true, hint: '' }),
  },
  {
    id: 'refine',
    label: '품질 높이기',
    labelFull: '논문 품질 점검 (품질 검증)',
    labelEn: 'Refine',
    order: 4,
    module: '../phases/4-refine/refine.js',
    /** 본문이 500자 이상이어야 의미 있는 검증 가능 */
    readyCheck: (paper) => {
      const bodyLen = (paper.draft.body || '').length;
      return {
        ready: bodyLen >= 500,
        hint: bodyLen < 500 ? `본문이 ${bodyLen}자입니다. 500자 이상이어야 의미 있는 검증이 가능합니다.` : '',
      };
    },
  },
  {
    id: 'review',
    label: '심사 준비',
    labelFull: '심사 준비와 대응 (심사 대응)',
    labelEn: 'Review',
    order: 5,
    module: '../phases/5-review/review.js',
    /** 본문이 2000자 이상이어야 심사 시뮬레이션 가능 */
    readyCheck: (paper) => {
      const bodyLen = (paper.draft.body || '').length;
      return {
        ready: bodyLen >= 2000,
        hint: bodyLen < 2000 ? '본문이 충분히 작성되어야 심사 대응이 가능합니다.' : '',
      };
    },
  },
  {
    id: 'submit',
    label: '제출하기',
    labelFull: '저널/학회에 투고하기 (투고)',
    labelEn: 'Submit',
    order: 6,
    module: '../phases/6-submit/submit.js',
    /** 검증 결과가 있어야 이상적 */
    readyCheck: (paper) => {
      const hasRefine = paper.refine.validationResults.length > 0;
      return {
        ready: (paper.draft.body || '').length > 0,
        hint: !hasRefine ? '품질 검증을 먼저 실행하면 투고 준비가 더 수월합니다.' : '',
      };
    },
  },
  {
    id: 'postpub',
    label: '게재 후',
    labelFull: '게재 후 관리 (출판 후)',
    labelEn: 'Post-pub',
    order: 7,
    module: '../phases/7-postpub/postpub.js',
    /** 논문이 게재 상태이면 이상적 */
    readyCheck: (paper) => ({
      ready: paper.meta.status === 'published',
      hint: paper.meta.status !== 'published' ? '논문이 게재(published) 상태가 아닙니다.' : '',
    }),
  },
];


/* ═══════════════════════════════════════════
 * PaperRouter 클래스
 * ═══════════════════════════════════════════ */
export class PaperRouter {
  /**
   * @param {import('./state.js').StateManager} state - 상태 관리자
   */
  constructor(state) {
    /** 상태 관리자 참조 */
    this.state = state;

    /** 로딩된 phase 모듈 캐시 -- { phaseId: moduleExports } */
    this._loadedModules = {};

    /** 현재 활성 phase ID */
    this._currentPhase = null;

    /** phase 전환 진행 중 플래그 (이중 전환 방지) */
    this._transitioning = false;
  }

  /**
   * init -- 라우터 초기화
   *
   * 1. URL hash에서 초기 phase 결정
   * 2. phase navigation UI 렌더링
   * 3. hashchange 이벤트 리스너 등록
   * 4. 초기 phase로 이동
   */
  async init() {
    /* phase navigation 탭 렌더링 */
    this._renderPhaseNav();

    /* URL hash에서 초기 phase 결정 */
    const hashPhase = window.location.hash.replace('#', '');
    const validPhase = PHASES.find(p => p.id === hashPhase);

    /* Paper Object에 저장된 마지막 phase 또는 기본값 사용 */
    const savedPhase = this.state.get('meta.currentPhase') || 'draft';
    const startPhase = validPhase ? validPhase.id : savedPhase;

    /* hashchange 이벤트로 URL 뒤로/앞으로 지원 */
    window.addEventListener('hashchange', () => {
      const newPhase = window.location.hash.replace('#', '');
      if (newPhase && newPhase !== this._currentPhase) {
        this.navigateTo(newPhase);
      }
    });

    /* 초기 phase로 이동 */
    await this.navigateTo(startPhase);
  }

  /**
   * navigateTo -- phase 전환 실행
   *
   * @param {string} phaseId - 이동할 phase ID
   * @returns {Promise<boolean>} 전환 성공 여부
   */
  async navigateTo(phaseId) {
    /* 유효성 검증 */
    const phase = PHASES.find(p => p.id === phaseId);
    if (!phase) {
      console.warn(`[Router] 유효하지 않은 phase: ${phaseId}`);
      return false;
    }

    /* 이미 같은 phase에 있으면 무시 */
    if (phaseId === this._currentPhase) return true;

    /* 이중 전환 방지 */
    if (this._transitioning) return false;
    this._transitioning = true;

    try {
      /* 1. 현재 phase 정리 */
      if (this._currentPhase && this._loadedModules[this._currentPhase]) {
        try {
          this._loadedModules[this._currentPhase].deactivate();
        } catch (err) {
          console.error(`[Router] ${this._currentPhase} deactivate 오류:`, err);
        }
      }

      /* 2. 준비도 확인 -- 경고만 표시, 차단하지 않음 */
      const paper = this.state.getAll();
      const check = phase.readyCheck(paper);
      if (check.hint) {
        bus.emit(EVT.HINT, { phase: phaseId, message: check.hint });
      }

      /* 3. 모듈 지연 로딩 (최초 1회) */
      if (!this._loadedModules[phaseId]) {
        try {
          const mod = await import(phase.module);
          this._loadedModules[phaseId] = mod;
          /* init 호출: state와 bus 주입 */
          if (typeof mod.init === 'function') {
            mod.init(this.state, bus);
          }
        } catch (err) {
          console.error(`[Router] ${phaseId} 모듈 로딩 실패:`, err);
          this._transitioning = false;
          return false;
        }
      }

      /* 4. phase 활성화 */
      this._currentPhase = phaseId;
      this.state.set('meta.currentPhase', phaseId);

      /* 컨텐츠 영역 초기화 + 모듈 activate 호출 */
      const contentEl = document.getElementById('phase-content');
      if (contentEl) contentEl.innerHTML = '';

      if (typeof this._loadedModules[phaseId].activate === 'function') {
        this._loadedModules[phaseId].activate();
      }

      /* 5. URL hash 갱신 (히스토리 추가) */
      if (window.location.hash !== '#' + phaseId) {
        window.history.pushState(null, '', '#' + phaseId);
      }

      /* 6. navigation UI 갱신 */
      this._updatePhaseNav(phaseId);

      /* 7. phase 전환 이벤트 발행 */
      bus.emit(EVT.PHASE_CHANGED, { phase: phaseId, label: phase.label });

      return true;

    } finally {
      this._transitioning = false;
    }
  }

  /**
   * getCurrentPhase -- 현재 활성 phase ID 반환
   * @returns {string|null}
   */
  getCurrentPhase() {
    return this._currentPhase;
  }

  /**
   * getProgressSummary -- 전 phase 진행 상태 요약
   *
   * 대시보드/상태바에서 사용.
   * @returns {Array<{id, label, order, ready, hint, progress, summary, isCurrent}>}
   */
  getProgressSummary() {
    const paper = this.state.getAll();
    return PHASES.map(phase => {
      const check = phase.readyCheck(paper);
      let progress = 0;
      let summary = '';

      /* 로딩된 모듈의 getStatus()가 있으면 사용 */
      const mod = this._loadedModules[phase.id];
      if (mod && typeof mod.getStatus === 'function') {
        const status = mod.getStatus();
        progress = status.progress || 0;
        summary = status.summary || '';
      }

      return {
        id: phase.id,
        label: phase.label,
        labelEn: phase.labelEn,
        order: phase.order,
        ready: check.ready,
        hint: check.hint,
        progress,
        summary,
        isCurrent: phase.id === this._currentPhase,
      };
    });
  }


  /* ═══════════════════════════════════════════
   * Phase Navigation UI
   * ═══════════════════════════════════════════ */

  /**
   * _renderPhaseNav -- phase 탭 네비게이션 렌더링
   * @private
   */
  _renderPhaseNav() {
    const nav = document.getElementById('phase-nav');
    if (!nav) return;

    nav.innerHTML = PHASES.map(phase => `
      <button
        id="phase-tab-${phase.id}"
        class="phase-tab"
        data-phase="${phase.id}"
        title="${phase.label} (${phase.labelEn})"
      >
        <span class="phase-num">${phase.order}</span>
        <span class="phase-label">${phase.label}</span>
        <span class="phase-progress" style="width:24px;height:3px;border-radius:2px;background:var(--line);overflow:hidden;flex-shrink:0">
          <span class="phase-progress-bar" style="display:block;height:100%;width:0%;background:var(--brand);border-radius:2px;transition:width .3s"></span>
        </span>
        <span class="ready-dot pending"></span>
      </button>
    `).join('');

    /* 클릭 이벤트 위임 */
    nav.addEventListener('click', (e) => {
      const tab = e.target.closest('.phase-tab');
      if (tab) {
        this.navigateTo(tab.dataset.phase);
      }
    });
  }

  /**
   * _updatePhaseNav -- 현재 phase에 맞게 탭 UI 갱신
   * @private
   * @param {string} activePhaseId - 활성 phase ID
   */
  _updatePhaseNav(activePhaseId) {
    const paper = this.state.getAll();

    PHASES.forEach(phase => {
      const tab = document.getElementById(`phase-tab-${phase.id}`);
      if (!tab) return;

      /* 활성 상태 토글 */
      tab.classList.toggle('active', phase.id === activePhaseId);

      /* 준비도 표시 (초록 점 / 노란 점) */
      const check = phase.readyCheck(paper);
      const dot = tab.querySelector('.ready-dot');
      if (dot) {
        dot.className = 'ready-dot ' + (check.ready ? 'ready' : 'pending');
        dot.title = check.hint || (check.ready ? '준비 완료' : '');
      }

      /* Progress bar 갱신 -- getStatus()가 있으면 진행률 표시 */
      const progressBar = tab.querySelector('.phase-progress-bar');
      if (progressBar) {
        const mod = this._loadedModules[phase.id];
        let pct = 0;
        if (mod && typeof mod.getStatus === 'function') {
          pct = mod.getStatus().progress || 0;
        }
        progressBar.style.width = Math.min(100, pct) + '%';
        progressBar.style.background = pct >= 80 ? '#2E7D32' : pct >= 30 ? 'var(--accent)' : 'var(--brand)';
      }
    });
  }
}
