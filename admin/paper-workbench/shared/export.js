/**
 * export.js -- 논문 내보내기 엔진
 *
 * 지원 형식: Markdown, LaTeX, DOCX, 본문+부록 분리
 * (PPTX는 ppt-export.js 외부 모듈로 별도 처리)
 *
 * 기존 paper-editor.html 함수 매핑:
 *   exportMD(2749)            -> exportMarkdown()
 *   exportTeX(2759)           -> exportLaTeX()
 *   exportDOCX(4449)          -> exportDOCX()
 *   exportSplit(4147)         -> exportSplit()
 *   downloadMarkdown(2721)    -> _downloadMarkdown()
 *   buildExportContent(4346)  -> buildExportContent()
 *   escapeLatex(2917)         -> escapeLatex()
 *   askFileName(2741)         -> askFileName()
 *   _mathmlToOmml(4360)       -> (DOCX 내부)
 *   _latexToDocxMath(4384)    -> (DOCX 내부)
 *   _mermaidToTikz(4400)      -> mermaidToTikz()
 *   parseNode(4408)           -> (DOCX 내부)
 */


/* ═══════════════════════════════════════════
 * ���틸리티
 * ═══════════════════════════════════════════ */

/**
 * escapeLatex -- LaTeX 특수문자 이스케이프
 *
 * 기존: paper-editor.html line 2917
 *
 * @param {string} s - 이스케이프할 문자열
 * @returns {string}
 */
export function escapeLatex(s) {
  return s.replace(/[&%$#_{}~^]/g, m => '\\' + m);
}

/**
 * askFileName -- 사용자에게 파일명 입력 받기
 *
 * 기존: paper-editor.html line 2741
 *
 * @param {string} defaultBase - 기본 파일명 (확장자 제외)
 * @param {string} ext - 확장자
 * @returns {string|null} 파일명 (취소 시 null)
 */
export function askFileName(defaultBase, ext) {
  const name = prompt('파일명을 입력하세요 (.' + ext + '):', defaultBase);
  if (!name) return null;
  return name.endsWith('.' + ext) ? name : name + '.' + ext;
}


/* ═══════════════════════════════════════════
 * Markdown 내보내기
 *
 * 기존: exportMD(2749) + downloadMarkdown(2721)
 * ═══════════════════════════════════════════ */

/**
 * exportMarkdown -- YAML 프론트매터 + 본문 + 참고문헌을 .md로 다운로드
 *
 * @param {Object} paper - Paper Object 전체
 */
export function exportMarkdown(paper) {
  const meta = paper.meta || {};
  const title = meta.title || 'Untitled';
  const fileName = askFileName(
    title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9가-힣-]/g, '').substring(0, 50) || 'paper',
    'md'
  );
  if (!fileName) return;

  const content = buildExportContent(paper);
  _downloadFile(fileName, content, 'text/markdown');
}

/**
 * buildExportContent -- 프론트매터 + 본문 + 참고문헌 결합
 *
 * 기존: buildExportContent(4346) + downloadMarkdown(2721)
 *
 * @param {Object} paper - Paper Object
 * @returns {string} 완성된 Markdown 텍스트
 */
export function buildExportContent(paper) {
  const meta = paper.meta || {};
  const refs = paper.references || [];

  /* YAML 프론트매터 */
  let md = '---\n';
  md += 'title: "' + (meta.title || '') + '"\n';
  md += 'author: "' + (meta.firstAuthor || '') + '"\n';
  if (meta.coauthors) md += 'coauthors: "' + meta.coauthors + '"\n';
  if (meta.abstract) md += 'abstract: "' + meta.abstract.replace(/"/g, '\\"') + '"\n';
  if (meta.keywords) md += 'keywords: "' + meta.keywords + '"\n';
  if (meta.domain) md += 'domain: "' + meta.domain + '"\n';
  md += 'date: "' + new Date().toISOString().split('T')[0] + '"\n';
  md += '---\n\n';

  /* 본문 */
  md += (paper.draft.body || '') + '\n\n';

  /* 참고문헌 */
  if (refs.length) {
    md += '---\n\n## References\n\n';
    refs.forEach((r, i) => {
      const text = typeof r === 'string' ? r : (r.raw || r.formatted || '');
      md += '[' + (i + 1) + '] ' + text + '\n\n';
    });
  }

  return md;
}


/* ═══════════════════════════════════════════
 * LaTeX 내보내기
 *
 * 기존: exportTeX(2759) -- 전체 변환 파이프라인
 * ═══════════════════════════════════════════ */

/**
 * exportLaTeX -- Markdown -> LaTeX 변환 + .tex 다운로드
 *
 * @param {Object} paper - Paper Object
 */
export function exportLaTeX(paper) {
  const meta = paper.meta || {};
  const title = meta.title || 'Untitled';
  const body = paper.draft?.body || '';
  const refs = paper.references || [];

  if (!body.trim()) { alert('내용을 입력해 주세요.'); return; }

  /* LaTeX 클래스 선택 */
  const venue = prompt(
    'LaTeX 클래스를 선택하세요:\n1) IEEEtran compsoc (IEEE S&P/TDSC)\n2) IEEEtran conference\n3) acmart sigconf (ACM CCS)\n4) article (일반)\n\n번호 입력:', '1'
  );
  const classes = { '1': 'IEEEtran-compsoc', '2': 'IEEEtran', '3': 'acmart', '4': 'article' };
  const cls = classes[venue] || 'article';

  /* 프리앰블 */
  let tex = '';
  if (cls === 'IEEEtran-compsoc') {
    tex += '\\documentclass[conference,compsoc]{IEEEtran}\n';
    tex += '\\usepackage{amsmath,amssymb,amsfonts}\n\\usepackage{algorithmic}\n\\usepackage{graphicx}\n\\usepackage{textcomp}\n\\usepackage{kotex}\n\\usepackage{hyperref}\n\\usepackage{cite}\n\\usepackage{booktabs}\n\\usepackage{listings}\n';
  } else if (cls === 'IEEEtran') {
    tex += '\\documentclass[conference]{IEEEtran}\n';
    tex += '\\usepackage{amsmath,amssymb,amsfonts}\n\\usepackage{algorithmic}\n\\usepackage{graphicx}\n\\usepackage{kotex}\n\\usepackage{hyperref}\n';
  } else if (cls === 'acmart') {
    tex += '\\documentclass[sigconf]{acmart}\n';
    tex += '\\usepackage{amsmath,amssymb}\n\\usepackage{graphicx}\n\\usepackage{kotex}\n';
  } else {
    tex += '\\documentclass[11pt,a4paper]{article}\n';
    tex += '\\usepackage{amsmath,amssymb}\n\\usepackage{graphicx}\n\\usepackage{hyperref}\n\\usepackage{kotex}\n\\usepackage{amsthm}\n\\newtheorem{theorem}{Theorem}\n\\newtheorem{definition}{Definition}\n\\newtheorem{lemma}{Lemma}\n';
  }
  tex += '\\usepackage[utf8]{inputenc}\n\n';

  /* 제목/저자 */
  tex += '\\title{' + escapeLatex(title) + '}\n';
  const blindMode = paper.draft?.submissionOptions?.blindMode || false;
  if (blindMode) {
    tex += '% Anonymous submission\n\\author{Anonymous Author(s)}\n';
  } else {
    const allAuthors = [meta.firstAuthor, ...(meta.coauthors ? meta.coauthors.split(',').map(s => s.trim()) : [])].filter(Boolean);
    const nameMap = paper.nameMap || {};
    const authorNames = allAuthors.map(a => { const m = nameMap[a]; return m && m.name ? m.name : a; });
    tex += '\\author{' + authorNames.join(' \\and ') + '}\n';
  }
  tex += '\\date{' + new Date().toISOString().split('T')[0] + '}\n\n';
  tex += '\\begin{document}\n\\maketitle\n\n';

  /* 초록 */
  if (meta.abstract) {
    tex += '\\begin{abstract}\n' + escapeLatex(meta.abstract) + '\n\\end{abstract}\n\n';
  }
  if (meta.keywords) {
    tex += '\\textbf{Keywords:} ' + escapeLatex(meta.keywords) + '\n\n';
  }

  /* 본문 변환 */
  let b = body;
  b = b.replace(/:::abstract\n[\s\S]*?\n:::\n*/g, '');
  b = b.replace(/^# (.+)$/gm, '');
  b = b.replace(/^## (?:\d+\.?\s*)?(.+)$/gm, '\\section{$1}');
  b = b.replace(/^### (?:\d+\.\d+\.?\s*)?(.+)$/gm, '\\subsection{$1}');
  b = b.replace(/^#### (.+)$/gm, '\\subsubsection{$1}');
  b = b.replace(/:::theorem\s*(.*?)\n([\s\S]*?)\n:::/g, '\\begin{theorem}[$1]\n$2\n\\end{theorem}');
  b = b.replace(/:::definition\s*(.*?)\n([\s\S]*?)\n:::/g, '\\begin{definition}[$1]\n$2\n\\end{definition}');
  b = b.replace(/:::lemma\s*(.*?)\n([\s\S]*?)\n:::/g, '\\begin{lemma}[$1]\n$2\n\\end{lemma}');
  b = b.replace(/:::proof\n([\s\S]*?)\n:::/g, '\\begin{proof}\n$1\n\\end{proof}');
  b = b.replace(/:::algorithm\s*(.*?)\n([\s\S]*?)\n:::/g, '\\begin{algorithm}\n\\caption{$1}\n\\begin{algorithmic}\n$2\n\\end{algorithmic}\n\\end{algorithm}');
  b = b.replace(/\[cite:(\d+)\]/g, '\\cite{ref$1}');

  /* 각주 */
  const fnDefs = {};
  b = b.replace(/^\[\^(\w+)\]:\s*(.+)$/gm, (m, id, text) => { fnDefs[id] = text; return ''; });
  b = b.replace(/\[\^(\w+)\]/g, (m, id) => fnDefs[id] ? '\\footnote{' + escapeLatex(fnDefs[id]) + '}' : m);

  /* 서식 */
  b = b.replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}');
  b = b.replace(/\*(.+?)\*/g, '\\textit{$1}');
  b = b.replace(/`([^`]+)`/g, '\\texttt{$1}');

  /* Mermaid -> TikZ 또는 주석 */
  b = b.replace(/```mermaid\n([\s\S]*?)```/g, (m, code) => {
    return '% [Mermaid diagram - export as image]\n' + code.trim().split('\n').map(l => '% ' + l).join('\n');
  });

  /* 코드 블록 */
  b = b.replace(/```(\w+)\n([\s\S]*?)```/g, '\\begin{lstlisting}[language=$1]\n$2\\end{lstlisting}');
  b = b.replace(/```\n([\s\S]*?)```/g, '\\begin{verbatim}\n$1\\end{verbatim}');

  /* 이미지 */
  b = b.replace(/!\[([^\]]*)\]\(([^)]+)\)(?:\{width=(\d+%?)\})?/g, (m, cap, src, w) => {
    const width = w ? w.replace('%', '') + '\\textwidth' : '0.8\\textwidth';
    return '\\begin{figure}[htbp]\n\\centering\n\\includegraphics[width=' + width + ']{' + src + '}\n\\caption{' + escapeLatex(cap) + '}\n\\end{figure}';
  });

  /* 표 */
  b = b.replace(/(\*Table[^*]*\*)\n((?:\|.+\|\n?)+)/g, (m, caption, tblBody) => {
    const rows = tblBody.trim().split('\n').filter(Boolean);
    if (rows.length < 2) return m;
    const headerCells = rows[0].split('|').filter(Boolean).map(c => c.trim());
    const colSpec = headerCells.map(() => 'l').join('');
    let result = '\\begin{table}[htbp]\n\\centering\n\\caption{' + escapeLatex(caption.replace(/\*/g, '').trim()) + '}\n\\begin{tabular}{' + colSpec + '}\n\\toprule\n';
    rows.forEach(row => {
      const cells = row.split('|').filter(Boolean).map(c => c.trim());
      if (cells.every(c => /^[-:]+$/.test(c))) { result += '\\midrule\n'; return; }
      result += cells.join(' & ') + ' \\\\\n';
    });
    result += '\\bottomrule\n\\end{tabular}\n\\end{table}';
    return result;
  });

  b = b.replace(/^- (.+)$/gm, '\\item $1');
  b = b.replace(/\n{3,}/g, '\n\n');

  tex += b + '\n\n';

  /* 참고문헌 */
  if (refs.length) {
    tex += '\\begin{thebibliography}{' + refs.length + '}\n';
    refs.forEach((r, i) => {
      const text = typeof r === 'string' ? r : (r.raw || '');
      tex += '\\bibitem{ref' + (i + 1) + '} ' + escapeLatex(text) + '\n';
    });
    tex += '\\end{thebibliography}\n';
  }

  tex += '\\end{document}\n';

  /* 다운로드 */
  const texFileName = askFileName(title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'paper', 'tex');
  if (!texFileName) return;
  _downloadFile(texFileName, tex, 'application/x-tex');
}


/* ═══════════════════════════════════════════
 * 본문+부록 분리 내보내기
 *
 * 기존: exportSplit(4147)
 * ═══════════════════════════════════════════ */

/**
 * exportSplit -- 본문과 부록을 별도 .md 파일로 분리 다운로드
 *
 * @param {Object} paper - Paper Object
 */
export function exportSplit(paper) {
  const body = paper.draft?.body || '';
  const splitIdx = body.search(/^##\s*(appendix|부록)/im);

  let main, appendix;
  if (splitIdx >= 0) {
    main = body.substring(0, splitIdx).trim();
    appendix = body.substring(splitIdx).trim();
  } else {
    main = body;
    appendix = '';
  }

  const title = (paper.meta?.title || 'paper').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  _downloadFile(title + '-main.md', main, 'text/markdown');
  if (appendix) {
    _downloadFile(title + '-appendix.md', appendix, 'text/markdown');
  }
}


/* ═══════════════════════════════════════════
 * DOCX 내보내기 (완전 구현)
 *
 * 기존: exportDOCX(4449) + _latexToDocxMath(4384) + _mathmlToOmml(4360)
 * docx.js CDN이 로드되어 있어야 동작 (index.html에서 로드).
 * ═══════════════════════════════════════════ */

/**
 * exportDOCX -- Word 문서(.docx) 내보내기
 *
 * 기�� paper-editor.html line 4449-4591 완전 이관.
 * 제목, ��자, 초록, 키워드, 본문(제목/표/코드/수식/인용/각주), 참고문헌.
 * 블라인드 모드 지원.
 *
 * @param {Object} paper - Paper Object
 */
export async function exportDOCX(paper) {
  const D = window.docx;
  if (!D) { alert('docx.js 라이브러리가 로드되지 않았습니다. index.html에 CDN을 추가하세요.'); return; }

  const meta = paper.meta || {};
  const title = meta.title || 'Untitled';
  const isBlind = paper.draft?.submissionOptions?.blindMode || false;
  const body = paper.draft?.body || '';
  const refs = paper.references || [];
  const nameMap = paper.nameMap || {};

  const docxFileName = askFileName(
    title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'paper', 'docx'
  );
  if (!docxFileName) return;

  const children = [];

  /* ── 제목 ── */
  children.push(new D.Paragraph({
    children: [new D.TextRun({ text: title, bold: true, size: 32, font: 'Times New Roman' })],
    alignment: D.AlignmentType.CENTER, spacing: { after: 120 },
  }));

  /* ── 저자 (블라인드 시 Anonymous) ── */
  const allAuthors = isBlind ? ['Anonymous Author(s)'] : [meta.firstAuthor || ''];
  if (!isBlind && meta.coauthors) meta.coauthors.split(',').forEach(a => { if (a.trim()) allAuthors.push(a.trim()); });
  const authorNames = allAuthors.map(a => { const m = nameMap[a]; return m && m.name ? m.name : a; }).filter(Boolean);
  children.push(new D.Paragraph({
    children: [new D.TextRun({ text: authorNames.join(', '), size: 22, font: 'Times New Roman' })],
    alignment: D.AlignmentType.CENTER, spacing: { after: isBlind ? 200 : 80 },
  }));

  /* ── 소속 (블라인드 시 숨김) ── */
  if (!isBlind && meta.affiliation) {
    children.push(new D.Paragraph({
      children: [new D.TextRun({ text: meta.affiliation, size: 20, font: 'Times New Roman', italics: true })],
      alignment: D.AlignmentType.CENTER, spacing: { after: 200 },
    }));
  }

  /* ── 초록 ── */
  if (meta.abstract) {
    children.push(new D.Paragraph({ children: [new D.TextRun({ text: 'Abstract', bold: true, size: 20, font: 'Times New Roman' })], spacing: { before: 200, after: 80 } }));
    children.push(new D.Paragraph({ children: [new D.TextRun({ text: meta.abstract, italics: true, size: 20, font: 'Times New Roman' })], spacing: { after: 120 }, alignment: D.AlignmentType.BOTH }));
  }

  /* ── 키워드 ── */
  if (meta.keywords) {
    children.push(new D.Paragraph({
      children: [new D.TextRun({ text: 'Keywords: ', bold: true, size: 18, font: 'Times New Roman' }), new D.TextRun({ text: meta.keywords, size: 18, font: 'Times New Roman' })],
      spacing: { after: 200 },
    }));
  }

  /* ── 본문 파싱 ── */
  const lines = body.split('\n');
  let inCodeBlock = false, inEnv = false, envType = '', envContent = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    /* 코드 블록 */
    if (line.startsWith('```')) { inCodeBlock = !inCodeBlock; continue; }
    if (inCodeBlock) {
      children.push(new D.Paragraph({ children: [new D.TextRun({ text: line, font: 'Courier New', size: 18 })], shading: { fill: 'F4F4F4' }, spacing: { after: 40 } }));
      continue;
    }

    /* 환경 블록 (:::theorem 등) */
    if (line.startsWith(':::')) {
      if (inEnv) {
        const label = envType.charAt(0).toUpperCase() + envType.slice(1);
        children.push(new D.Paragraph({
          children: [new D.TextRun({ text: label + '. ', bold: true, size: 20, font: 'Times New Roman' }), new D.TextRun({ text: envContent.join('\n'), italics: envType === 'proof', size: 20, font: 'Times New Roman' })],
          spacing: { before: 100, after: 100 },
          border: { top: { style: D.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }, bottom: { style: D.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } },
        }));
        inEnv = false; envContent = [];
      } else {
        const m = line.match(/^:::(\w+)\s*(.*)/);
        if (m) { envType = m[1]; inEnv = true; envContent = []; if (m[2]) envContent.push(m[2]); }
      }
      continue;
    }
    if (inEnv) { envContent.push(line); continue; }

    /* 제목 (블라인드 시 감사의 글 건너뛰기) */
    const hm = line.match(/^(#{1,4})\s+(.+)/);
    if (hm) {
      if (isBlind && /acknowledgment|감사의?\s?글|사사/i.test(hm[2])) {
        while (i + 1 < lines.length && !/^#{1,4}\s/.test(lines[i + 1])) i++;
        continue;
      }
      const level = hm[1].length;
      const hStyle = [D.HeadingLevel.HEADING_1, D.HeadingLevel.HEADING_2, D.HeadingLevel.HEADING_3, D.HeadingLevel.HEADING_4];
      children.push(new D.Paragraph({
        children: [new D.TextRun({ text: hm[2], bold: true, size: level === 1 ? 28 : level === 2 ? 24 : 22, font: 'Times New Roman' })],
        heading: hStyle[level - 1], spacing: { before: 240, after: 80 },
      }));
      continue;
    }

    /* 수평선 */
    if (/^---+$/.test(line)) {
      children.push(new D.Paragraph({ children: [], spacing: { after: 80 }, border: { bottom: { style: D.BorderStyle.SINGLE, size: 1, color: '999999' } } }));
      continue;
    }

    /* 표 */
    if (line.startsWith('|') && line.includes('|')) {
      const rows = [];
      let j = i;
      while (j < lines.length && lines[j].startsWith('|')) {
        if (!/^\|[-\s:|]+\|$/.test(lines[j])) {
          rows.push(lines[j].split('|').filter(c => c.trim()).map(c => c.trim()));
        }
        j++;
      }
      if (rows.length > 0) {
        const tblRows = rows.map((r, ri) => new D.TableRow({
          children: r.map(c => new D.TableCell({
            children: [new D.Paragraph({ children: [new D.TextRun({ text: c, bold: ri === 0, size: 18, font: 'Times New Roman' })] })],
            width: { size: Math.floor(9000 / r.length), type: D.WidthType.DXA },
          })),
        }));
        children.push(new D.Table({ rows: tblRows, width: { size: 9000, type: D.WidthType.DXA } }));
        children.push(new D.Paragraph({ children: [], spacing: { after: 80 } }));
      }
      i = j - 1; continue;
    }

    /* 캡션 */
    if (line.startsWith('*') && line.endsWith('*')) {
      children.push(new D.Paragraph({
        children: [new D.TextRun({ text: line.replace(/^\*|\*$/g, ''), italics: true, size: 18, font: 'Times New Roman' })],
        alignment: D.AlignmentType.CENTER, spacing: { after: 80 },
      }));
      continue;
    }

    /* 디스플레이 수식 ($$) */
    if (line.startsWith('$$')) {
      let mathContent = '';
      let k = i + 1;
      while (k < lines.length && !lines[k].startsWith('$$')) { mathContent += lines[k] + '\n'; k++; }
      try {
        const mathObj = _latexToDocxMath(mathContent.trim(), D, true);
        children.push(new D.Paragraph({ children: [mathObj], alignment: D.AlignmentType.CENTER, spacing: { before: 80, after: 80 } }));
      } catch {
        children.push(new D.Paragraph({ children: [new D.TextRun({ text: mathContent.trim(), font: 'Cambria Math', size: 20 })], alignment: D.AlignmentType.CENTER }));
      }
      i = k; continue;
    }

    /* 일반 문단 (볼드, 이탤릭, 인용, 각주, 인라인 수식) */
    if (line.trim()) {
      const runs = [];
      const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[cite:\d+\]|\[\^\w+\]|\$[^$]+\$)/g);
      parts.forEach(p => {
        if (!p) return;
        if (p.startsWith('**') && p.endsWith('**')) { runs.push(new D.TextRun({ text: p.slice(2, -2), bold: true, size: 20, font: 'Times New Roman' })); }
        else if (p.startsWith('*') && p.endsWith('*')) { runs.push(new D.TextRun({ text: p.slice(1, -1), italics: true, size: 20, font: 'Times New Roman' })); }
        else if (/\[cite:(\d+)\]/.test(p)) { const n = p.match(/\d+/)[0]; runs.push(new D.TextRun({ text: '[' + n + ']', size: 20, font: 'Times New Roman' })); }
        else if (/\[\^(\w+)\]/.test(p)) { const n = p.match(/\w+/)[0]; runs.push(new D.TextRun({ text: n, superScript: true, size: 16, font: 'Times New Roman' })); }
        else if (p.startsWith('$') && p.endsWith('$') && p.length > 2) {
          try { runs.push(_latexToDocxMath(p.slice(1, -1), D, false)); }
          catch { runs.push(new D.TextRun({ text: p.slice(1, -1), font: 'Cambria Math', size: 20 })); }
        }
        else { runs.push(new D.TextRun({ text: p, size: 20, font: 'Times New Roman' })); }
      });
      if (runs.length) children.push(new D.Paragraph({ children: runs, spacing: { after: 80 }, alignment: D.AlignmentType.BOTH }));
    } else {
      children.push(new D.Paragraph({ children: [], spacing: { after: 40 } }));
    }
  }

  /* ── 참고문헌 ── */
  if (refs.length) {
    children.push(new D.Paragraph({
      children: [new D.TextRun({ text: 'References', bold: true, size: 24, font: 'Times New Roman' })],
      heading: D.HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 },
    }));
    refs.forEach((r, i) => {
      const text = typeof r === 'string' ? r : (r.raw || '');
      children.push(new D.Paragraph({
        children: [new D.TextRun({ text: '[' + (i + 1) + '] ' + text, size: 18, font: 'Times New Roman' })],
        spacing: { after: 40 }, indent: { left: 360, hanging: 360 },
      }));
    });
  }

  /* ── 문서 빌드 + ��운로드 ── */
  const doc = new D.Document({
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children: children,
    }],
  });
  const blob = await D.Packer.toBlob(doc);
  if (window.saveAs) saveAs(blob, docxFileName);
  else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = docxFileName; a.click(); }
}


/* ═══════════════════════════════════════════
 * LaTeX -> DOCX 수식 변환 헬퍼
 *
 * 기존: _latexToDocxMath(4384) + _mathmlToOmml(4360)
 * KaTeX로 MathML 렌더링 -> OMML로 변환 -> docx.js XML 컴포넌트
 * ═══════════════════════════════════════════ */

/**
 * _latexToDocxMath -- LaTeX를 DOCX 네이티브 수식 객체로 변환
 *
 * @param {string} latex - LaTeX 수식 문자열
 * @param {Object} D - docx 모듈 참조
 * @param {boolean} display - 디스플레이 모드 여부
 * @returns {Object} docx 수식 객체
 */
function _latexToDocxMath(latex, D, display) {
  try {
    const html = katex.renderToString(latex, { throwOnError: false, output: 'mathml', displayMode: !!display });
    const mathEl = new DOMParser().parseFromString(html, 'text/html').querySelector('math');
    if (!mathEl) throw new Error('no math');
    const omml = '<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' + _mathmlToOmml(mathEl) + '</m:oMath>';
    const xmlDoc = new DOMParser().parseFromString(omml, 'application/xml');
    if (xmlDoc.querySelector('parsererror')) throw new Error('xml parse error');
    return D.convertToXmlComponent(xmlDoc.documentElement);
  } catch {
    return new D.TextRun({ text: latex, font: 'Cambria Math', size: 20 });
  }
}

/**
 * _mathmlToOmml -- MathML DOM 노드를 재귀적으로 OMML(Office Math ML)로 변환
 *
 * @param {Node} node - MathML DOM 노드
 * @returns {string} OMML XML 문자열
 */
function _mathmlToOmml(node) {
  if (node.nodeType === 3) {
    const t = node.textContent.trim();
    return t ? '<m:r><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr><m:t>' + _escXml(t) + '</m:t></m:r>' : '';
  }
  if (node.nodeType !== 1) return '';

  const ch = () => Array.from(node.childNodes).map(_mathmlToOmml).join('');

  switch (node.localName) {
    case 'math': case 'semantics': case 'mrow': case 'mstyle': return ch();
    case 'annotation': return '';
    case 'mi': case 'mn': case 'mo': case 'mtext':
      return '<m:r><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr><m:t>' + _escXml(node.textContent || '') + '</m:t></m:r>';
    case 'mfrac': { const [n, d] = node.children; return '<m:f><m:num>' + _mathmlToOmml(n) + '</m:num><m:den>' + _mathmlToOmml(d) + '</m:den></m:f>'; }
    case 'msup': { const [b, s] = node.children; return '<m:sSup><m:e>' + _mathmlToOmml(b) + '</m:e><m:sup>' + _mathmlToOmml(s) + '</m:sup></m:sSup>'; }
    case 'msub': { const [b, s] = node.children; return '<m:sSub><m:e>' + _mathmlToOmml(b) + '</m:e><m:sub>' + _mathmlToOmml(s) + '</m:sub></m:sSub>'; }
    case 'msubsup': { const [b, sub, sup] = node.children; return '<m:sSubSup><m:e>' + _mathmlToOmml(b) + '</m:e><m:sub>' + _mathmlToOmml(sub) + '</m:sub><m:sup>' + _mathmlToOmml(sup) + '</m:sup></m:sSubSup>'; }
    case 'msqrt': return '<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:e>' + ch() + '</m:e></m:rad>';
    case 'mroot': { const [b, d] = node.children; return '<m:rad><m:deg>' + _mathmlToOmml(d) + '</m:deg><m:e>' + _mathmlToOmml(b) + '</m:e></m:rad>'; }
    case 'munder': { const [b, u] = node.children; return '<m:limLow><m:e>' + _mathmlToOmml(b) + '</m:e><m:lim>' + _mathmlToOmml(u) + '</m:lim></m:limLow>'; }
    case 'mover': { const [b, o] = node.children; return '<m:limUpp><m:e>' + _mathmlToOmml(b) + '</m:e><m:lim>' + _mathmlToOmml(o) + '</m:lim></m:limUpp>'; }
    case 'munderover': { const [b, u, o] = node.children; return '<m:nary><m:naryPr><m:chr m:val="' + _escXml(b.textContent || '\u2211') + '"/></m:naryPr><m:sub>' + _mathmlToOmml(u) + '</m:sub><m:sup>' + _mathmlToOmml(o) + '</m:sup><m:e></m:e></m:nary>'; }
    case 'mfenced': { const op = node.getAttribute('open') || '('; const cl = node.getAttribute('close') || ')'; return '<m:d><m:dPr><m:begChr m:val="' + _escXml(op) + '"/><m:endChr m:val="' + _escXml(cl) + '"/></m:dPr><m:e>' + ch() + '</m:e></m:d>'; }
    case 'mtable': return '<m:m>' + Array.from(node.children).map(tr => '<m:mr>' + Array.from(tr.children).map(td => '<m:e>' + _mathmlToOmml(td) + '</m:e>').join('') + '</m:mr>').join('') + '</m:m>';
    case 'mtr': case 'mtd': return ch();
    default: return ch();
  }
}

/** XML 속성값 이스케이프 */
function _escXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


/* ═══════════════════════════════════════════
 * 파일 다운로드 헬퍼
 * ═══════════════════════════════════════════ */

function _downloadFile(fileName, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}
