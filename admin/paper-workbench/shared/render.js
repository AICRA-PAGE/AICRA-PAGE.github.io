/**
 * render.js -- 학술 논문 렌더링 파이프라인
 *
 * 설계: Option C (독립 프로세서 + 명시적 조합) -- Codex 추천
 *
 * 구조:
 *   - 각 프로세서는 독립적이고 unit-testable
 *   - renderDraft() / renderReview()가 phase별 파이프라인을 정의
 *   - runPipeline()이 프로세서를 순서대로 실행
 *   - context 객체로 인용 스타일, 블라인드 모드 등 설정 전달
 *
 * 기존 에디터 함수 매핑 (line numbers from paper-editor.html):
 *   render(1736)              -> renderDraft()
 *   hydrateMermaid(1636)      -> hydrateMermaid()
 *   processEnvs(1875)         -> processEnvs()
 *   restoreEnvs(1892)         -> restoreEnvs()
 *   processNumberedEq(1894)   -> processNumberedEq()
 *   processCitations(1896)    -> processCitations()
 *   processFootnotes(1915)    -> processFootnotes()
 *   processSubfigures(1938)   -> processSubfigures()
 *   preprocessRefsAndCaptions(1968) -> preprocessRefsAndCaptions()
 *   processAppendix(1994)     -> processAppendix()
 *   processImageSize(2010)    -> processImageSize()
 *   autoFitVisuals(1797)      -> autoFitVisuals()
 *   buildPreviewHeader(1649)  -> buildPreviewHeader()
 *   buildTOC(1706)            -> buildTOC()
 */

import { escHtml, escAttr, sanitizeHtml, simpleHash } from './ui.js';


/* ═══════════════════════════════════════════
 * 렌더링 컨텍스트 (프로세서에 전달되는 설정)
 * ═══════════════════════════════════════════ */

/**
 * 기본 렌더링 컨텍스트 생성
 *
 * @param {Object} overrides - 오버라이드할 설정
 * @returns {Object} 렌더링 컨텍스트
 */
export function createRenderContext(overrides = {}) {
  return {
    /* 인용 스타일: numeric | author-year | superscript */
    citeStyle: 'numeric',
    /* 블라인드 모드 (저자 정보 숨김) */
    blindMode: false,
    /* 참고문헌 배열 (raw 문자열) */
    references: [],
    /* 논문 메타데이터 */
    meta: { title: '', firstAuthor: '', coauthors: '', abstract: '', keywords: '', domain: '', affiliation: '' },
    /* 저자 이름 매핑 */
    nameMap: {},
    /* 교신저자 목록 */
    correspondingAuthors: [],
    /* 학회 양식 코드 */
    venueTemplate: '',
    /* Phase별 추가 설정 */
    phase: 'draft',
    /* diff 데이터 (review phase용) */
    diffData: null,
    ...overrides,
  };
}


/* ═══════════════════════════════════════════
 * 프로세서 상태 (환경/수식 카운터)
 *
 * 기존 에디터: envCounters, eqCounter, envPH[], labelRegistry
 * 프로세서 간 공유되는 mutable 상태.
 * ═══════════════════════════════════════════ */

let envCounters = { theorem: 0, lemma: 0, definition: 0, corollary: 0, proposition: 0, algorithm: 0 };
let eqCounter = 0;
let envPlaceholders = [];
let labelRegistry = {};

/** 카운터 초기화 (렌더 시작 시 호출) */
function resetCounters() {
  envCounters = { theorem: 0, lemma: 0, definition: 0, corollary: 0, proposition: 0, algorithm: 0 };
  eqCounter = 0;
  envPlaceholders = [];
  labelRegistry = {};
}


/* ═══════════════════════════════════════════
 * 프로세서 #1: 교차참조 + 자동 번호매기기
 *
 * 기존: preprocessRefsAndCaptions(1968)
 * 실행 시점: 섹션 분할 전 (전체 텍스트에 대해 1회)
 * ═══════════════════════════════════════════ */

/**
 * preprocessRefsAndCaptions -- Fig.N / Table N 자동 번호 + \label{} / \ref{} 처리
 *
 * @param {string} text - 전처리할 Markdown 텍스트
 * @returns {string} 번호가 매겨지고 교차참조가 처리된 텍스트
 */
export function preprocessRefsAndCaptions(text) {
  let figN = 0, tblN = 0, eqN = 0, curSec = '';
  labelRegistry = {};

  const lines = text.split('\n').map(line => {
    /* 현재 섹션 추적 */
    if (/^##\s+/.test(line)) curSec = line.replace(/^##\s+/, '').trim();

    /* Fig. N. / Table N. 자동 번호 */
    line = line.replace(/\*Fig\.?\s*N\.\s*/gi, () => { figN++; return '*Fig. ' + figN + '. '; });
    line = line.replace(/\*Table\s*N\.\s*/gi, () => { tblN++; return '*Table ' + tblN + '. '; });

    /* $$ 수식 카운터 */
    if (/^\$\$/.test(line.trim())) eqN++;

    /* \label{id} -> 앵커 + 레지스트리 등록 */
    line = line.replace(/\\label\{([^}]+)\}/g, (m, id) => {
      labelRegistry[id] = id.startsWith('fig:') ? 'Fig. ' + figN :
        /^(tbl|tab):/.test(id) ? 'Table ' + tblN :
        id.startsWith('eq:') ? 'Eq. (' + eqN + ')' :
        id.startsWith('sec:') ? curSec : id;
      return '<a id="ref-' + id + '"></a>';
    });

    /* \ref{id} -> 교차참조 링크 */
    line = line.replace(/\\ref\{([^}]+)\}/g, (m, id) => {
      const label = labelRegistry[id] || '??';
      return '<a href="#ref-' + id + '" class="xref" data-ref-target="ref-' + id + '" style="color:var(--brand,#2f5d50);text-decoration:none;font-weight:600">' + escHtml(label) + '</a>';
    });

    return line;
  });

  return lines.join('\n');
}


/* ═══════════════════════════════════════════
 * 프로세서 #2: 학술 환경 블록 (정리/증명 등)
 *
 * 기존: processEnvs(1875) + restoreEnvs(1892)
 * ═══════════════════════════════════════════ */

/**
 * processEnvs -- :::theorem, :::proof 등 학술 환경 블록을 HTML로 변환
 *
 * Markdown 파싱 전에 호출. 플레이스홀더로 대체 후 restoreEnvs()에서 복원.
 *
 * @param {string} t - 처리할 텍스트
 * @returns {string} 플레이스홀더로 대체된 텍스트
 */
export function processEnvs(t) {
  /* 초록 블록 */
  t = t.replace(/:::abstract\n([\s\S]*?)\n:::/g, (m, body) => {
    const ph = '\x00E' + envPlaceholders.length + '\x00';
    envPlaceholders.push('<div class="abstract-box"><strong>Abstract</strong>' + (typeof marked !== 'undefined' ? marked.parse(body.trim()) : body.trim()) + '</div>');
    return ph;
  });

  /* 정리/보조정리/정의/따름정리/명제/알고리즘/증명 */
  const types = ['theorem', 'lemma', 'definition', 'corollary', 'proposition', 'algorithm', 'proof'];
  const typeNames = { theorem: 'Theorem', lemma: 'Lemma', definition: 'Definition', corollary: 'Corollary', proposition: 'Proposition', algorithm: 'Algorithm' };

  for (const ty of types) {
    const re = new RegExp(':::' + ty + '(?:\\s+(.+?))?\\n([\\s\\S]*?)\\n:::', 'g');
    t = t.replace(re, (m, title, body) => {
      let html;
      if (ty === 'proof') {
        html = '<div class="proof"><span class="proof-label">Proof.</span> ' + (title ? '(' + title + ') ' : '') + body.trim() + '</div>';
      } else {
        envCounters[ty]++;
        html = '<div class="env-block"><div class="env-label">' + typeNames[ty] + ' ' + envCounters[ty] + (title ? '. ' + title : '') + '.</div>' + body.trim() + '</div>';
      }
      const ph = '\x00E' + envPlaceholders.length + '\x00';
      envPlaceholders.push(html);
      return ph;
    });
  }
  return t;
}

/**
 * restoreEnvs -- 환경 블록 플레이스홀더를 원래 HTML로 복원
 *
 * Markdown 파싱 후에 호출.
 *
 * @param {string} html - 플레이스홀더가 포함된 HTML
 * @returns {string} 복원된 HTML
 */
export function restoreEnvs(html) {
  for (let i = 0; i < envPlaceholders.length; i++) {
    html = html.replace('<p>\x00E' + i + '\x00</p>', envPlaceholders[i]);
    html = html.replace('\x00E' + i + '\x00', envPlaceholders[i]);
  }
  return html;
}


/* ═══════════════════════════════════════════
 * 프로세서 #3: 번호 매김 수식
 *
 * 기존: processNumberedEq(1894)
 * ═══════════════════════════════════════════ */

/**
 * processNumberedEq -- $$ 수식 블록에 자동 번호 (1), (2)... 부여
 *
 * @param {string} t - 처리할 텍스트
 * @returns {string} 수식 번호가 추가된 텍스트
 */
export function processNumberedEq(t) {
  return t.replace(/^\$\$\s*\n?([\s\S]*?)\n?\$\$\s*$/gm, (m, eq) => {
    eqCounter++;
    return '<div class="eq-row"><div class="katex-display">$$' + eq.trim() + '$$</div><div class="eq-num">(' + eqCounter + ')</div></div>';
  });
}


/* ═══════════════════════════════════════════
 * 프로세서 #4: 인용
 *
 * 기존: processCitations(1896)
 * ═══════════════════════════════════════════ */

/**
 * processCitations -- [cite:N] -> 인용 링크 변환
 *
 * 스타일: numeric [1], author-year (Author, Year), superscript
 *
 * @param {string} t - 처리할 텍스트
 * @param {Object} ctx - 렌더링 컨텍스트 (citeStyle, references)
 * @returns {string} 인용 링크가 삽입된 텍스트
 */
export function processCitations(t, ctx = {}) {
  const style = ctx.citeStyle || 'numeric';
  const refs = ctx.references || [];

  return t.replace(/\[cite:(\d+)\]/g, (m, n) => {
    const idx = parseInt(n) - 1;
    const ref = refs[idx] || 'Ref ' + n;
    /* ref가 객체일 경우 raw 문자열 추출 */
    const refText = typeof ref === 'string' ? ref : (ref.raw || ref.formatted || 'Ref ' + n);
    const titleAttr = escAttr(refText);

    if (style === 'author-year') {
      const authorMatch = refText.match(/^([^.,"]+)/);
      const yearMatch = refText.match(/(\d{4})/);
      const short = (authorMatch ? authorMatch[1].trim() : 'Author') + (yearMatch ? ' (' + yearMatch[1] + ')' : ' (n.d.)');
      return '<span class="cite cite-ay" title="' + titleAttr + '">' + escHtml(short) + '</span>';
    }
    if (style === 'superscript') {
      return '<sup class="cite" title="' + titleAttr + '" style="font-size:.65em;cursor:help">' + n + '</sup>';
    }
    /* numeric (기본) */
    return '<span class="cite" title="' + titleAttr + '">[' + n + ']</span>';
  });
}


/* ═══════════════════════════════════════════
 * 프로세서 #5: 각주
 *
 * 기존: processFootnotes(1915)
 * ═══════════════════════════════════════════ */

/**
 * processFootnotes -- [^id] 각주 마크업을 하단 각주 리스트로 변환
 *
 * @param {string} t - 처리할 텍스트
 * @returns {string} 각주가 처리된 텍스트
 */
export function processFootnotes(t) {
  const defs = {};
  let idx = 1;

  /* 각주 정의 수집: [^id]: text */
  t = t.replace(/^\[\^(\w+)\]:\s*(.+)$/gm, (m, id, text) => {
    if (!defs[id]) defs[id] = { num: idx++, text: text.trim() };
    return '';
  });

  /* 인라인 참조 변환: [^id] -> 위첨자 */
  t = t.replace(/\[\^(\w+)\]/g, (m, id) => {
    const d = defs[id];
    if (!d) return m;
    return '<sup class="fn-ref" data-fn="fn-' + d.num + '" id="fnref-' + d.num + '" title="' + escHtml(d.text) + '">' + d.num + '</sup>';
  });

  /* 하단 각주 섹션 생성 (back-link 포함) */
  const entries = Object.values(defs).sort((a, b) => a.num - b.num);
  if (entries.length) {
    t += '\n\n<div class="footnotes"><hr><ol>' +
      entries.map(e =>
        '<li id="fn-' + e.num + '">' + escHtml(e.text) +
        ' <a class="fn-back" data-fn-back="fnref-' + e.num + '" style="color:var(--brand);text-decoration:none;font-size:.7em;cursor:pointer">&#8617;</a></li>'
      ).join('') + '</ol></div>';
  }
  return t;
}


/* ═══════════════════════════════════════════
 * 프로세서 #6: 서브피겨
 *
 * 기존: processSubfigures(1938)
 * ═══════════════════════════════════════════ */

/**
 * processSubfigures -- ```figgrid 마크업을 다중 패널 이미지 그리드로 변환
 *
 * @param {string} t - 처리할 텍스트
 * @returns {string} 서브피겨 HTML이 삽입된 텍스트
 */
export function processSubfigures(t) {
  return t.replace(/```figgrid\s*(.*?)\n([\s\S]*?)```/g, (m, opts, body) => {
    const capMatch = opts.match(/caption="([^"]+)"/);
    const colMatch = opts.match(/cols=(\d)/);
    const cols = colMatch ? parseInt(colMatch[1]) : 2;
    const lines = body.trim().split('\n').filter(Boolean);

    let html = '<div class="fig-grid" style="display:flex;gap:8px">';
    let sub = 97; /* 'a' */

    for (const line of lines) {
      const imgM = line.match(/!\[([^\]]*)\]\(([^)]+)\)(?:\{sub="([^"]*)"(?:\s+cap="([^"]*)")?\})?/);
      if (imgM) {
        const alt = imgM[1] || '';
        const src = imgM[2];
        const subLabel = imgM[3] || String.fromCharCode(sub);
        const subCap = imgM[4] || alt;
        html += '<div class="subfig" style="flex:1;text-align:center"><img src="' + src + '" alt="' + escAttr(alt) + '" style="max-width:100%"><div class="sub-label">(' + subLabel + ') ' + escHtml(subCap) + '</div></div>';
        sub++;
      }
    }
    html += '</div>';
    if (capMatch) html += '<div class="fig-grid-caption">' + escHtml(capMatch[1]) + '</div>';

    const ph = '\x00E' + envPlaceholders.length + '\x00';
    envPlaceholders.push(html);
    return ph;
  });
}


/* ═══════════════════════════════════════════
 * 프로세서 #7: 이미지 크기
 *
 * 기존: processImageSize(2010)
 * ═══════════════════════════════════════════ */

/**
 * processImageSize -- {width=50%} 문법으로 이미지 크기 조절
 *
 * @param {string} html - 처리할 HTML
 * @returns {string} 크기가 적용된 HTML
 */
export function processImageSize(html) {
  return html.replace(/(<img[^>]+>)\{width=(\d+%?)\}/g, (m, img, w) => {
    return img.replace('>', ' style="width:' + w + ';display:block;margin:0 auto">');
  });
}


/* ═══════════════════════════════════════════
 * 프로세서 #8: 부록 번호매기기
 *
 * 기존: processAppendix(1994)
 * ═══════════════════════════════════════════ */

/**
 * processAppendix -- 부록 섹션에 Appendix A/B/C 자동 라벨링
 *
 * @param {string} html - 처리할 HTML
 * @returns {string} 부록 라벨이 추가된 HTML
 */
export function processAppendix(html) {
  if (!html) return '';
  let inAppendix = false;
  let appIdx = 0;

  return html.replace(/<h2[^>]*>(.*?)<\/h2>/gi, (m, content) => {
    if (!content) return m;
    if (/appendix|부록/i.test(content)) inAppendix = true;
    if (inAppendix && !/appendix|부록/i.test(content)) {
      appIdx++;
      const letter = String.fromCharCode(64 + appIdx);
      return m.replace(content, 'Appendix ' + letter + '. ' + (content || '').replace(/^\d+\.\s*/, ''));
    }
    return m;
  });
}


/* ═══════════════════════════════════════════
 * 프리뷰 헤더
 *
 * 기존: buildPreviewHeader(1649)
 * ═══════════════════════════════════════════ */

/**
 * buildPreviewHeader -- 미리보기 상단에 제목/저자/초록 헤더 생성
 *
 * @param {Object} ctx - 렌더링 컨텍스트
 * @returns {string} 헤더 HTML
 */
export function buildPreviewHeader(ctx = {}) {
  const { meta = {}, blindMode = false, nameMap = {}, correspondingAuthors = [] } = ctx;
  const { title = '', firstAuthor = '', coauthors = '', abstract: ab = '', keywords = '', domain = '', affiliation = '' } = meta;

  if (!title && !firstAuthor && !domain && !keywords && !ab) return '';

  let h = '<div style="border-bottom:1px solid #bbb;padding-bottom:14px;margin-bottom:18px;text-align:center">';

  if (title) h += '<h1 style="margin-bottom:.3rem">' + escHtml(title) + '</h1>';

  /* 블라인드 모드: 저자 정보 전부 숨김 */
  if (blindMode) {
    h += '<div style="font-size:.82rem;color:#b42318;font-weight:600;margin:.5rem 0">Anonymous Submission</div>';
    if (domain) h += '<div style="font-size:.72rem;color:#666;margin-bottom:.2rem">' + escHtml(domain) + '</div>';
    if (ab) h += '<div class="abstract-box"><strong style="display:block;margin-bottom:2px;font-size:.7rem;text-transform:uppercase;letter-spacing:.5px">Abstract</strong>' + escHtml(ab) + '</div>';
    if (keywords) h += '<div style="font-size:.72rem;color:#555"><strong>Keywords:</strong> ' + escHtml(keywords) + '</div>';
    h += '</div>';
    return h;
  }

  /* 저자 목록 구성 */
  const authors = [firstAuthor];
  if (coauthors) coauthors.split(',').forEach(a => { if (a.trim()) authors.push(a.trim()); });

  const resolvedAuthors = authors.filter(a => a).map(a => {
    const m = nameMap[a];
    return {
      name: m && m.name ? m.name : a,
      login: a,
      isCorr: correspondingAuthors.includes(a),
      affiliation: m && m.affiliation ? m.affiliation : '',
    };
  });

  if (resolvedAuthors.length) {
    h += '<div class="author-list" style="font-size:.92rem;font-weight:700;color:#111;margin-bottom:.2rem">';
    h += resolvedAuthors.map(a => escHtml(a.name) + (a.isCorr ? '<sup style="color:#c00;font-weight:400">&dagger;</sup>' : '')).join(', ');
    h += '</div>';
  }

  /* 소속 */
  const perAuthorAffs = resolvedAuthors.filter(a => a.affiliation).map(a => a.affiliation);
  const uniqueAffs = [...new Set(perAuthorAffs)];
  if (uniqueAffs.length > 0) {
    h += '<div class="affiliations" style="font-size:.78rem;font-style:italic;color:#444;margin-bottom:.2rem">' + uniqueAffs.map(a => escHtml(a)).join('; ') + '</div>';
  } else if (affiliation) {
    h += '<div class="affiliations" style="font-size:.78rem;font-style:italic;color:#444;margin-bottom:.2rem">' + escHtml(affiliation) + '</div>';
  }

  /* 교신저자 */
  const corrNames = resolvedAuthors.filter(a => a.isCorr);
  if (corrNames.length) {
    const corrParts = corrNames.map(a => {
      const m = nameMap[a.login];
      const email = m && m.email ? m.email : '';
      return escHtml(a.name) + (email ? ' (' + escHtml(email) + ')' : '');
    });
    h += '<div class="corresponding-author" style="font-size:.72rem;color:#333;margin-top:.3rem"><sup>&dagger;</sup> Corresponding author: ' + corrParts.join(', ') + '</div>';
  }

  if (domain) h += '<div style="font-size:.72rem;color:#666;margin-bottom:.2rem">' + escHtml(domain) + '</div>';
  if (ab) h += '<div class="abstract-box"><strong style="display:block;margin-bottom:2px;font-size:.7rem;text-transform:uppercase;letter-spacing:.5px">Abstract</strong>' + escHtml(ab) + '</div>';
  if (keywords) h += '<div style="font-size:.72rem;color:#555"><strong>Keywords:</strong> ' + escHtml(keywords) + '</div>';
  h += '</div>';
  return h;
}


/* ═══════════════════════════════════════════
 * TOC 생성
 *
 * 기존: buildTOC(1706)
 * ═══════════════════════════════════════════ */

/**
 * buildTOC -- 미리보기 내 h2/h3에서 목차(Table of Contents) 생성
 *
 * @param {HTMLElement} previewEl - 프리뷰 DOM 요소
 * @returns {string} TOC HTML
 */
export function buildTOC(previewEl) {
  const heads = [...previewEl.querySelectorAll('h2,h3')];
  if (heads.length < 2) return '';

  const slugCount = {};
  const items = heads.map(h => {
    let slug = h.textContent.toLowerCase().replace(/[^a-z0-9가-힣]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (slugCount[slug]) { slugCount[slug]++; slug += '-' + slugCount[slug]; } else { slugCount[slug] = 1; }
    h.id = slug;

    const indent = h.tagName === 'H3' ? '14' : '0';
    const fontSize = h.tagName === 'H3' ? '.68' : '.74';
    return '<a href="#' + slug + '" class="toc-link" data-target="' + slug + '" style="display:block;padding:1px 0 1px ' + indent + 'px;font-size:' + fontSize + 'rem;color:var(--brand,#2f5d50);text-decoration:none;line-height:1.5">' + escHtml(h.textContent) + '</a>';
  });

  return '<nav class="paper-toc" style="border:1px solid #ddd;border-radius:6px;padding:10px 14px;margin-bottom:16px;background:#fafaf8"><div style="font-size:.7rem;font-weight:700;color:#555;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Table of Contents</div>' + items.join('') + '</nav>';
}


/* ═══════════════════════════════════════════
 * Mermaid 렌더링
 *
 * 기존: hydrateMermaid(1636)
 * ═══════════════════════════════════════════ */

/**
 * hydrateMermaid -- ```mermaid 코드 블록을 SVG 다이어그램으로 변환
 *
 * @param {HTMLElement} previewEl - 프리뷰 DOM 요소
 */
export function hydrateMermaid(previewEl) {
  if (!window.mermaid) return;

  previewEl.querySelectorAll('pre code.language-mermaid').forEach(code => {
    const host = document.createElement('div');
    host.className = 'mermaid';
    host.textContent = code.textContent;
    code.parentElement.replaceWith(host);
  });

  try { mermaid.run({ nodes: previewEl.querySelectorAll('.mermaid') }); }
  catch (e) { console.warn('[Render] Mermaid 렌더링 오류:', e); }
}


/* ═══════════════════════════════════════════
 * 시각 요소 자동 조절
 *
 * 기존: autoFitVisuals(1797)
 * ═══════════════════════════════════════════ */

/**
 * autoFitVisuals -- 표/수식/이미지/Mermaid/코드 블록 크기를 컨테이너에 맞게 조절
 *
 * @param {HTMLElement} previewEl - 프리뷰 DOM 요소
 */
export function autoFitVisuals(previewEl) {
  /* 표: 스크롤 래퍼 + 축소 폰트 */
  previewEl.querySelectorAll('table').forEach(table => {
    if (table.parentElement && table.parentElement.classList.contains('table-scroll')) return;
    const wrap = document.createElement('div');
    wrap.className = 'table-scroll';
    table.parentNode.insertBefore(wrap, table);
    wrap.appendChild(table);
  });
  previewEl.querySelectorAll('.table-scroll').forEach(wrap => {
    wrap.classList.remove('is-tight');
    const table = wrap.querySelector('table');
    if (!table) return;
    table.style.removeProperty('fontSize');
    if (table.scrollWidth > wrap.clientWidth + 2) {
      wrap.classList.add('is-tight');
      const ratio = wrap.clientWidth / table.scrollWidth;
      if (ratio >= 0.85) table.style.fontSize = Math.max(0.72, 0.82 * ratio).toFixed(3) + 'rem';
    }
  });

  /* Mermaid SVG: viewBox + 크기 조절 */
  previewEl.querySelectorAll('.mermaid svg').forEach(svg => {
    try {
      const bb = svg.getBBox();
      if (!svg.getAttribute('viewBox') && bb && bb.width > 0) {
        svg.setAttribute('viewBox', (bb.x || 0) + ' ' + (bb.y || 0) + ' ' + bb.width + ' ' + bb.height);
      }
      const origW = parseFloat(svg.getAttribute('width')) || bb.width || 400;
      const containerW = svg.parentElement ? svg.parentElement.clientWidth : 600;
      const targetW = Math.max(origW, Math.min(containerW, 800));
      svg.style.width = '100%';
      svg.style.minWidth = Math.min(targetW, 300) + 'px';
      svg.style.maxWidth = Math.max(targetW, containerW) + 'px';
      svg.style.height = 'auto';
      svg.style.minHeight = '80px';
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    } catch (e) { /* SVG 접근 오류 무시 */ }
  });

  /* 수식: 오버플로 시 축소 */
  previewEl.querySelectorAll('.katex-display').forEach(d => {
    d.classList.remove('is-scaled');
    d.style.removeProperty('--fit-scale');
    const inner = d.querySelector('.katex');
    if (!inner) return;
    inner.style.removeProperty('transform');
    const avail = d.clientWidth || previewEl.clientWidth;
    const natural = inner.scrollWidth || inner.getBoundingClientRect().width;
    if (natural > avail + 2) {
      const scale = Math.max(0.65, avail / natural);
      d.classList.add('is-scaled');
      d.style.setProperty('--fit-scale', scale.toFixed(4));
      inner.style.transform = 'scale(' + scale.toFixed(4) + ')';
      inner.style.transformOrigin = 'left center';
    }
  });

  /* 코드 블록: 오버플로 표시 */
  previewEl.querySelectorAll('pre').forEach(pre => {
    pre.classList.toggle('has-overflow', pre.scrollWidth > pre.clientWidth + 2);
  });

  /* 이미지: max-width 보장 */
  previewEl.querySelectorAll('img').forEach(img => {
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
  });

  /* 코드 구문 강조 */
  if (window.hljs) {
    previewEl.querySelectorAll('pre code').forEach(block => {
      if (!block.dataset.highlighted) {
        hljs.highlightElement(block);
        block.dataset.highlighted = 'true';
      }
    });
  }

  /* DOI 자동 링크 (참고문헌 섹션) */
  previewEl.querySelectorAll('.bib-list p,.references p,.references li').forEach(el => {
    if (el.dataset.doiLinked) return;
    el.dataset.doiLinked = 'true';
    el.innerHTML = el.innerHTML.replace(/DOI:\s*(10\.\d{4,}\/[^\s<]+)/gi, 'DOI: <a href="https://doi.org/$1" target="_blank" rel="noopener" style="color:var(--brand);text-decoration:underline">$1</a>');
    el.innerHTML = el.innerHTML.replace(/https?:\/\/doi\.org\/(10\.\d{4,}\/[^\s<"]+)/gi, '<a href="https://doi.org/$1" target="_blank" rel="noopener" style="color:var(--brand);text-decoration:underline">doi:$1</a>');
  });
}


/* ═══════════════════════════════════════════
 * 메인 렌더 함수: renderDraft
 *
 * 기존: render(1736) -- 섹션 캐시 포함 전체 파이프라인
 *
 * Codex 추천 구조:
 *   draftSteps = [preprocessRefsAndCaptions, processEnvs, processNumberedEq,
 *                 processCitations, processFootnotes, processSubfigures]
 *   + marked.parse() + restoreEnvs + processImageSize + processAppendix
 *   + sanitize + buildTOC + hydrateMermaid + KaTeX + autoFitVisuals
 * ═══════════════════════════════════════════ */

/** 섹션 캐시 (대용량 문서 성능 최적화) */
const sectionCache = new Map();

/**
 * renderDraft -- Phase 3 (집필) 전용 렌더링 파이프라인
 *
 * @param {string} rawText - 원본 Markdown 텍스트
 * @param {HTMLElement} previewEl - 프리뷰 DOM 요소
 * @param {Object} ctx - 렌더링 컨텍스트
 * @param {number} token - 렌더 토큰 (stale render 방지)
 * @returns {number} 사용된 렌더 토큰
 */
export function renderDraft(rawText, previewEl, ctx = {}, token = 0) {
  /* 빈 문서 처리 */
  const headerHtml = buildPreviewHeader(ctx);
  if (!rawText.trim() && !headerHtml) {
    previewEl.innerHTML = '<p style="color:#999;text-align:center;padding:40px;font-family:sans-serif;font-size:.85rem">양식을 선택하거나 직접 작성을 시작하세요</p>';
    return token;
  }

  /* 카운터 초기화 */
  resetCounters();
  envPlaceholders = [];

  /* 전처리: 교차참조 + 자동 번호 (섹션 분할 전) */
  const preprocessed = preprocessRefsAndCaptions(rawText);

  /* 섹션 분할 */
  const sections = preprocessed.split(/(?=^## )/m);
  const isLargeDoc = rawText.length > 30000;

  let htmlParts;

  if (isLargeDoc) {
    /* 대용량: 섹션 캐시 사용 (변경된 섹션만 재렌더링) */
    let anyChanged = false;
    htmlParts = sections.map((sec, i) => {
      const hash = simpleHash(sec);
      const cached = sectionCache.get(i);

      if (!anyChanged && cached && cached.hash === hash) {
        /* 캐시 히트: 카운터 상태 복원 */
        if (cached.endCounters) Object.assign(envCounters, cached.endCounters);
        if (cached.endEq !== undefined) eqCounter = cached.endEq;
        return cached.html;
      }

      anyChanged = true;
      const startCounters = JSON.parse(JSON.stringify(envCounters));
      const startEq = eqCounter;

      /* 프로세서 파이프라인 실행 */
      let t = sec || '';
      t = processEnvs(t);
      t = processNumberedEq(t);
      t = processCitations(t, ctx);
      t = processFootnotes(t);
      t = processSubfigures(t);

      /* Markdown 파싱 */
      let html = (typeof marked !== 'undefined') ? marked.parse(t) : _fallbackParse(t);
      html = restoreEnvs(html);
      html = processImageSize(html);

      /* 캐시 저장 */
      sectionCache.set(i, {
        hash: hash,
        html: html,
        endCounters: JSON.parse(JSON.stringify(envCounters)),
        endEq: eqCounter,
      });
      return html;
    });

    /* 오래된 캐시 항목 제거 */
    for (const k of sectionCache.keys()) {
      if (k >= sections.length) sectionCache.delete(k);
    }
  } else {
    /* 소형 문서: 전체 렌더링 */
    let t = preprocessed || '';
    t = processEnvs(t);
    t = processNumberedEq(t);
    t = processCitations(t, ctx);
    t = processFootnotes(t);
    t = processSubfigures(t);

    let html = (typeof marked !== 'undefined') ? marked.parse(t) : _fallbackParse(t);
    html = restoreEnvs(html);
    html = processImageSize(html);
    htmlParts = [html];
  }

  /* 최종 조합 */
  let finalHtml = headerHtml + htmlParts.join('');
  finalHtml = processAppendix(finalHtml);
  previewEl.innerHTML = sanitizeHtml(finalHtml);

  /* TOC 삽입 */
  const tocHtml = buildTOC(previewEl);
  if (tocHtml) {
    const headerDiv = previewEl.querySelector('div[style*="border-bottom"]');
    if (headerDiv) headerDiv.insertAdjacentHTML('afterend', tocHtml);
    else previewEl.insertAdjacentHTML('afterbegin', tocHtml);
  }

  /* Mermaid + KaTeX 렌더링 */
  const runPostProcess = () => {
    hydrateMermaid(previewEl);
    if (typeof renderMathInElement !== 'undefined') {
      renderMathInElement(previewEl, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true },
        ],
        throwOnError: false,
      });
    }
    requestAnimationFrame(() => autoFitVisuals(previewEl));
  };

  if (isLargeDoc) {
    /* 대용량: idle callback으로 비동기 처리 */
    if (window.requestIdleCallback) {
      requestIdleCallback(() => runPostProcess(), { timeout: 800 });
    } else {
      setTimeout(runPostProcess, 100);
    }
  } else {
    runPostProcess();
  }

  return token;
}


/**
 * renderReview -- Phase 5 (심사) 전용 렌더링 (향후 구현)
 *
 * Draft 렌더링 + diff 마크업 추가.
 * 현재는 renderDraft를 그대로 호출.
 */
export function renderReview(rawText, previewEl, ctx = {}, token = 0) {
  /* TODO: diff 데이터가 있으면 변경 부분 하이라이트 추가 */
  return renderDraft(rawText, previewEl, { ...ctx, phase: 'review' }, token);
}


/* ═══════════════════════════════════════════
 * Fallback Markdown 파서 (marked.js 미로드 시)
 * ═══════════════════════════════════════════ */

function _fallbackParse(text) {
  let html = escHtml(text);
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/\n\n/g, '</p><p>');
  return '<p>' + html + '</p>';
}
