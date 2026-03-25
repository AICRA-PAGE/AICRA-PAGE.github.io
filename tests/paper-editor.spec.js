/**
 * AICRA Paper Editor - E2E Test Suite (Playwright MCP)
 * Run via Playwright MCP tools, not CLI.
 * Tests verify actual browser behavior on the deployed site.
 *
 * Test categories:
 * T01-T03: Core editor functionality
 * T04-T06: Academic features (citations, cross-refs, BibTeX)
 * T07-T09: Analysis tools (diagnostic, style, validation)
 * T10-T12: Export and save
 * T13-T15: UI features (scroll sync, find/replace, tutorial)
 */

// === TEST RUNNER (execute in Playwright evaluate) ===
// Copy-paste this into playwright_evaluate to run all tests

async function runAllTests(){
  const results={};
  const inp=document.getElementById('input');
  const pv=document.getElementById('pv');

  // === T01: Editor loads and accepts input ===
  inp.focus();
  document.execCommand('insertText',false,'# Test Paper\n\n## Introduction\n\nThis is a test.');
  inp.dispatchEvent(new Event('input'));
  await new Promise(r=>setTimeout(r,300));
  results['T01_editor_input']=inp.value.includes('Test Paper');
  results['T01_preview_renders']=pv.innerHTML.includes('Test Paper');

  // === T02: Template application ===
  document.getElementById('tplSel').value='ieee_en';
  document.getElementById('tplSel').dispatchEvent(new Event('change'));
  await new Promise(r=>setTimeout(r,300));
  results['T02_template_loaded']=inp.value.includes('Introduction');

  // === T03: Metadata live preview ===
  document.getElementById('ti').value='Security Framework';
  document.getElementById('ti').dispatchEvent(new Event('input'));
  await new Promise(r=>setTimeout(r,400));
  results['T03_title_in_preview']=pv.innerHTML.includes('Security Framework');

  // === T04: Citation-reference linkage ===
  ins('cite');
  results['T04_pending_cite']=_pendingCite===true;
  results['T04_ref_panel_open']=document.getElementById('refPanel').classList.contains('open');
  document.getElementById('refInput').value='Smith et al., "Test," 2025.';
  addRef();
  results['T04_cite_inserted']=inp.value.includes('[cite:');
  results['T04_pending_cleared']=_pendingCite===false;

  // === T05: Cross-references ===
  inp.focus();inp.select();
  document.execCommand('insertText',false,'# Test\n\n## Methods\n\n*Fig. N. Architecture.*\n\n\\label{fig:arch}\n\nSee \\ref{fig:arch}.\n');
  inp.dispatchEvent(new Event('input'));
  await new Promise(r=>setTimeout(r,400));
  results['T05_label_rendered']=pv.innerHTML.includes('ref-fig:arch');
  results['T05_ref_resolved']=pv.innerHTML.includes('Fig. 1');

  // === T06: BibTeX parser ===
  const bib='@article{smith2025,\n  author={Smith, John and Lee, {Su-Jin}},\n  title={The {GNU} Security Framework},\n  journal={IEEE S\\&P},\n  year={2025}\n}';
  const parsed=parseBibTeX(bib);
  results['T06_bibtex_parsed']=parsed.length===1;
  results['T06_nested_braces']=parsed[0]&&parsed[0].title==='The GNU Security Framework';
  results['T06_author_split']=parsed[0]&&parsed[0].authors.includes('Lee');

  // === T07: Diagnostic report ===
  diagnosePaper();
  const cr=document.getElementById('checkResult');
  results['T07_diagnostic_visible']=cr.style.display==='block';
  results['T07_has_sections']=cr.innerHTML.includes('섹션별 분석');
  results['T07_has_vocab']=cr.innerHTML.includes('어휘 다양성');

  // === T08: Style consistency ===
  analyzeStyle();
  results['T08_style_visible']=cr.style.display==='block';
  results['T08_has_analysis']=cr.innerHTML.includes('문체 분석');

  // === T09: Paper validation ===
  validatePaper();
  results['T09_validation_visible']=cr.style.display==='block';
  results['T09_has_score']=cr.innerHTML.includes('/100');

  // === T10: Save modal ===
  document.getElementById('ti').value='Test Paper';
  ghSave(true);
  const sm=document.getElementById('saveModal');
  results['T10_save_modal']=sm.classList.contains('show');
  results['T10_filename']=document.getElementById('saveFileName').value.length>0;
  closeModal('saveModal');

  // === T11: Export functions exist ===
  results['T11_exportMD']=typeof exportMD==='function';
  results['T11_exportTeX']=typeof exportTeX==='function';
  results['T11_exportPPT']=typeof exportPPT==='function';
  results['T11_exportDOCX']=typeof exportDOCX==='function';

  // === T12: DOMPurify active ===
  results['T12_dompurify']=typeof DOMPurify!=='undefined';
  results['T12_sanitize']=typeof sanitizeHtml==='function';
  const xss=sanitizeHtml('<img src=x onerror=alert(1)>');
  results['T12_xss_blocked']=!xss.includes('onerror');

  // === T13: Find/Replace ===
  toggleFindPanel();
  results['T13_find_panel']=document.getElementById('findPanel').style.display!=='none';
  document.getElementById('findInput').value='Introduction';
  findNext();
  results['T13_find_count']=document.getElementById('findCount').textContent.includes('건');
  closeFindPanel();

  // === T14: Scroll sync ===
  inp.scrollTop=100;
  await new Promise(r=>setTimeout(r,100));
  results['T14_scroll_synced']=pv.scrollTop>0;

  // === T15: TOC generation ===
  results['T15_toc_exists']=pv.innerHTML.includes('Table of Contents')||pv.querySelectorAll('nav').length>0;

  // === T16: Keyboard shortcuts ===
  results['T16_escHtml']=typeof escHtml==='function';
  results['T16_paper_engine']=typeof paperEngine==='object';

  // === T17: Snapshots ===
  saveSnapshot();
  const snaps=JSON.parse(localStorage.getItem('aicra.paper.snapshots.v1')||'[]');
  results['T17_snapshot_saved']=snaps.length>0;

  // Summary
  const total=Object.keys(results).length;
  const passed=Object.values(results).filter(v=>v===true).length;
  const failed=Object.entries(results).filter(([k,v])=>v!==true);
  results['_SUMMARY']='PASSED: '+passed+'/'+total+(failed.length?' | FAILED: '+failed.map(([k])=>k).join(', '):'');

  return results;
}

// To run: copy the runAllTests function into playwright_evaluate
// After bypassing auth: document.getElementById('auth-gate').style.display='none'; document.getElementById('editor-content').style.display='flex';
