/**
 * AICRA Paper Editor - Non-blocking Interactive Tutorial
 * Mini widget (bottom-right) + button highlighting + first-visit detection
 * Editor remains fully accessible during tutorial
 */
(function(){

// === CSS injection for tutorial highlight + widget ===
const style=document.createElement('style');
style.textContent=`
.tutorial-highlight{outline:4px solid #e6a817 !important;outline-offset:3px;box-shadow:0 0 12px 3px rgba(230,168,23,.45) !important;animation:tutPulse 1.2s infinite;position:relative;z-index:91}
@keyframes tutPulse{0%{outline-color:#e6a817;box-shadow:0 0 8px 2px rgba(230,168,23,.3)}50%{outline-color:#ffcc00;box-shadow:0 0 16px 4px rgba(255,204,0,.5)}100%{outline-color:#e6a817;box-shadow:0 0 8px 2px rgba(230,168,23,.3)}}
#tutorialWidget{position:fixed;right:16px;bottom:16px;width:340px;max-height:420px;background:var(--panel,#fff);border:2px solid var(--brand,#2f5d50);border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,.18);z-index:92;font-family:'Pretendard',sans-serif;overflow:hidden;transition:all .3s ease}
#tutorialWidget.minimized{width:160px;max-height:36px;cursor:pointer}
#tutorialWidget.minimized .tw-body,#tutorialWidget.minimized .tw-nav,#tutorialWidget.minimized .tw-progress{display:none}
@media(max-width:600px){#tutorialWidget{width:calc(100vw - 16px);right:8px;bottom:8px;max-height:240px}#tutorialWidget.minimized{width:140px}}
.tw-header{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:var(--brand,#2f5d50);color:#fff;font-size:.68rem;font-weight:700;cursor:pointer;user-select:none}
.tw-header button{background:none;border:none;color:#fff;cursor:pointer;font-size:.72rem;padding:0 4px}
.tw-progress{height:3px;background:var(--line,#e8e5de);margin:0}
.tw-progress-bar{height:100%;background:var(--accent,#b7791f);transition:width .3s}
.tw-body{padding:10px 12px;overflow-y:auto;max-height:300px}
.tw-chapter{font-size:.55rem;color:var(--muted,#7a756c);margin-bottom:2px}
.tw-title{font-size:.82rem;font-weight:700;color:var(--brand,#2f5d50);margin-bottom:6px}
.tw-story{font-size:.68rem;line-height:1.6;margin-bottom:8px;padding:8px;background:var(--surface,#f3f1ec);border-radius:5px;border-left:3px solid var(--brand,#2f5d50)}
.tw-task{font-size:.65rem;line-height:1.5;margin-bottom:6px}
.tw-task b{color:var(--accent,#b7791f)}
.tw-nav{display:flex;gap:4px;padding:6px 10px;border-top:1px solid var(--line,#e8e5de);background:var(--surface,#f3f1ec)}
.tw-nav button{padding:3px 10px;border:1px solid var(--line,#e8e5de);border-radius:4px;font-size:.6rem;font-weight:600;cursor:pointer;background:var(--panel,#fff);color:var(--text,#2a2a2a)}
.tw-nav button.primary{background:var(--brand,#2f5d50);color:#fff;border-color:var(--brand,#2f5d50)}
.tw-nav button:hover{opacity:.85}
.tw-nav .spacer{flex:1}
.tw-locate{font-size:.55rem;color:var(--accent,#b7791f);cursor:pointer;text-decoration:underline;margin-bottom:4px;display:inline-block}
`;
document.head.appendChild(style);

// === STORY DATA ===
// Each step has: ch, title, story, task, highlight (CSS selector), auto, verify
const FULL_STORY=[
  // Chapter 1: Getting Started
  {ch:'Ch.1 시작',title:'양식 선택',
   story:'AICRA 연구원으로서 LLM 프롬프트 인젝션 방어 논문을 작성합니다. 먼저 양식을 선택합니다.',
   task:'상단 <b>-- Format --</b> 드롭다운에서 원하는 양식을 선택하세요.',
   highlight:'#tplSel',
   auto:()=>{document.getElementById('tplSel').value='ieee_en';document.getElementById('tplSel').dispatchEvent(new Event('change'));},
   verify:()=>document.getElementById('input').value.includes('Introduction')},

  {ch:'Ch.1 시작',title:'메타데이터 입력',
   story:'논문 제목, 분야, 키워드 등 기본 정보를 입력합니다.',
   task:'<b>제목</b>에 논문 제목을 입력하고, <b>분야</b>를 선택하세요.',
   highlight:'#metaBar',
   auto:()=>{document.getElementById('ti').value='LLM 프롬프트 인젝션 방어 프레임워크';document.getElementById('dm').value='Prompt Injection';},
   verify:()=>document.getElementById('ti').value.length>5},

  // Chapter 2: Writing
  {ch:'Ch.2 작성',title:'본문 편집',
   story:'좌측 에디터에서 Markdown으로 본문을 작성합니다. 우측에서 실시간 미리보기를 확인합니다.',
   task:'서론(Introduction) 섹션에 연구 동기를 작성하세요. 또는 <b>자동 실행</b>으로 예시를 삽입합니다.',
   highlight:'#input',
   auto:()=>{const v=document.getElementById('input').value;window.replaceAll(v.replace(/## 1\. Introduction\n/,'## 1. Introduction\n\nLLM 기반 시스템이 확산됨에 따라 프롬프트 인젝션 공격이 주요 위협으로 부상하고 있다.\n'));document.getElementById('input').dispatchEvent(new Event('input'));},
   verify:()=>document.getElementById('input').value.includes('프롬프트 인젝션')||document.getElementById('input').value.length>500},

  {ch:'Ch.2 작성',title:'수식 삽입',
   story:'LaTeX 수식을 추가합니다. $$...$$ 블록 또는 $...$ 인라인 수식을 사용합니다.',
   task:'<b>수식</b> 버튼을 클릭하거나 직접 $$...$$를 입력하세요.',
   highlight:'button[onclick="ins(\'eq\')"]',
   auto:()=>{window.typeText('\n\n$$\n\\mathcal{L}_{defense} = \\mathcal{L}_{task} + \\lambda \\cdot \\mathcal{L}_{safety}\n$$\n');},
   verify:()=>document.getElementById('input').value.includes('$$')},

  // Chapter 3: Academic Elements
  {ch:'Ch.3 학술요소',title:'정리와 증명',
   story:'정리(Theorem), 정의(Definition), 증명(Proof) 환경을 사용합니다.',
   task:'<b>정리</b> 버튼을 클릭하세요.',
   highlight:'button[onclick="ins(\'thm\')"]',
   auto:()=>{window.typeText('\n:::theorem 방어 수렴성\n제안 방어 필터는 유한 쿼리 $T < \\infty$ 내에서 최적 정책 $\\pi^*$에 수렴한다.\n:::\n\n:::proof\n마르코프 결정 과정의 수축 사상 정리에 의해 수렴한다.\n:::\n');},
   verify:()=>document.getElementById('input').value.includes(':::theorem')},

  {ch:'Ch.3 학술요소',title:'알고리즘',
   story:'의사코드(pseudocode) 형식의 알고리즘을 삽입합니다.',
   task:'<b>알고리즘</b> 버튼을 클릭하세요.',
   highlight:'button[onclick="ins(\'algo\')"]',
   auto:()=>{window.typeText('\n:::algorithm Prompt Shield\nInput: 입력 x, 탐지기 D, 임계값 tau\nOutput: 안전 응답 y\n1. risk = D(x)\n2. If risk > tau: x = sanitize(x)\n3. y = LLM(x)\n4. Return y\n:::\n');},
   verify:()=>document.getElementById('input').value.includes(':::algorithm')},

  // Chapter 4: Security Elements
  {ch:'Ch.4 보안',title:'위협 모델',
   story:'보안 논문의 핵심: 위협 모델을 정의합니다. 자산, 공격자, 가정을 명시합니다.',
   task:'<b>위협모델</b> 버튼을 클릭하세요.',
   highlight:'button[onclick="ins(\'threat\')"]',
   auto:()=>{window.ins('threat');},
   verify:()=>document.getElementById('input').value.includes('Adversary')},

  {ch:'Ch.4 보안',title:'프레임워크 매핑',
   story:'MITRE ATLAS, OWASP LLM Top 10에 매핑합니다.',
   task:'<b>프레임워크</b> 버튼을 클릭하세요.',
   highlight:'button[onclick="ins(\'framework\')"]',
   auto:()=>{window.ins('framework');},
   verify:()=>document.getElementById('input').value.includes('MITRE')},

  // Chapter 5: Results
  {ch:'Ch.5 결과',title:'성능 비교표',
   story:'실험 결과를 표로 정리합니다.',
   task:'<b>성능표</b> 버튼을 클릭하세요.',
   highlight:'button[onclick="ins(\'perf\')"]',
   auto:()=>{window.typeText('\n*Table 1. 방어 기법 성능 비교.*\n| Method | ASR (%) | Clean Acc (%) | F1 |\n|--------|---------|---------------|-----|\n| No Defense | 78.3 | 94.1 | 0.72 |\n| Prompt Shield (Ours) | 8.7 | 93.2 | 0.91 |\n\n');},
   verify:()=>document.getElementById('input').value.includes('Prompt Shield')},

  {ch:'Ch.5 결과',title:'시각화 - 구조도',
   story:'Mermaid 다이어그램으로 시스템 아키텍처를 시각화합니다.',
   task:'<b>구조도</b> 버튼을 클릭하세요.',
   highlight:'button[onclick="ins(\'arch\')"]',
   auto:()=>{window.ins('arch');},
   verify:()=>document.getElementById('input').value.includes('flowchart')||document.getElementById('input').value.includes('graph')},

  // Chapter 6: Citations & References
  {ch:'Ch.6 인용',title:'참고문헌 등록',
   story:'참고문헌을 먼저 등록한 후 본문에서 인용합니다. 참고문헌 패널에서 검색하거나 직접 입력합니다.',
   task:'<b>참고문헌</b> 버튼을 클릭하여 패널을 열고, 문헌을 추가하세요.',
   highlight:'button[onclick="toggleRef()"]',
   auto:()=>{window.toggleRef();if(typeof refs!=='undefined'){refs.push('Greshake et al., "Not What You Signed Up For: Compromising LLMs with Indirect Prompt Injection," arXiv:2302.12173, 2023.');refs.push('OWASP, "Top 10 for LLM Applications 2025," 2024.');if(window.renderRefs)window.renderRefs();if(window.render)window.render();}},
   verify:()=>typeof refs!=='undefined'&&refs.length>=2},

  {ch:'Ch.6 인용',title:'인용 삽입',
   story:'<b>인용</b> 버튼을 클릭하면 참고문헌 패널이 열립니다. 문헌을 등록하면 자동으로 [cite:N]이 삽입됩니다.',
   task:'<b>인용</b> 버튼을 클릭해 보세요. (참고문헌 등록 -> 자동 인용)',
   highlight:'button[onclick="ins(\'cite\')"]',
   auto:()=>{window.typeText('[cite:1]');},
   verify:()=>document.getElementById('input').value.includes('[cite:')},

  {ch:'Ch.6 인용',title:'각주 삽입',
   story:'보충 설명은 각주로 추가합니다. Alt+N 단축키도 사용 가능합니다.',
   task:'<b>각주</b> 버튼 또는 <b>Alt+N</b>을 눌러보세요.',
   highlight:'button[onclick="ins(\'fn\')"]',
   auto:()=>{window.typeText('\n\n본 실험에서 사용한 LLM은 GPT-4 기반이다[^1].\n\n[^1]: OpenAI GPT-4 API, 2024년 3월 기준.\n');},
   verify:()=>document.getElementById('input').value.includes('[^')},

  // Chapter 7: Finalization
  {ch:'Ch.7 마무리',title:'초록 자동 생성',
   story:'본문 기반으로 구조화 초록을 자동 생성합니다.',
   task:'<b>초록 생성</b> 버튼을 클릭하세요.',
   highlight:'button[onclick="genAbstract()"]',
   auto:()=>{window.genAbstract();},
   verify:()=>true},

  {ch:'Ch.7 마무리',title:'논문 검증',
   story:'투고 전 구조, 인용, 필수 섹션 등을 점검합니다.',
   task:'<b>검증</b> 버튼을 클릭하세요.',
   highlight:'button[onclick="validatePaper()"]',
   auto:()=>{window.validatePaper();},
   verify:()=>document.getElementById('checkResult').style.display==='block'},

  {ch:'Ch.7 마무리',title:'진단 리포트',
   story:'섹션 균형, 문단 길이, 어휘 다양성 등 상세 진단을 확인합니다.',
   task:'<b>진단</b> 버튼을 클릭하세요.',
   highlight:'button[onclick="diagnosePaper()"]',
   auto:()=>{if(window.diagnosePaper)window.diagnosePaper();},
   verify:()=>document.getElementById('checkResult').style.display==='block'},

  {ch:'Ch.7 마무리',title:'문체 일관화',
   story:'문체 혼용, 용어 불일치, 수동태 비율 등을 분석합니다.',
   task:'<b>문체</b> 버튼을 클릭하세요.',
   highlight:'button[onclick="analyzeStyle()"]',
   auto:()=>{if(window.analyzeStyle)window.analyzeStyle();},
   verify:()=>document.getElementById('checkResult').style.display==='block'},

  // Chapter 8: Reviewer & Quality
  {ch:'Ch.8 심사도구',title:'심사 체크리스트',
   story:'검토자가 구조적으로 리뷰할 수 있는 체크리스트입니다. 8항목(독창성, 방법론, 명확성, 참고문헌 등)을 평가하고 심사의견(승인/수정/불가)을 선택합니다.',
   task:'<b>심사</b> 버튼을 클릭하세요.',
   highlight:'button[onclick="showReviewChecklist()"]',
   auto:()=>{if(window.showReviewChecklist)window.showReviewChecklist();},
   verify:()=>document.getElementById('checkResult').style.display==='block'},

  {ch:'Ch.8 심사도구',title:'벤뉴 규격 체크',
   story:'선택한 양식(IEEE/ACM/NeurIPS 등)의 투고 규격을 자동으로 점검합니다. 페이지수, 참고문헌 수, 필수 섹션을 확인합니다.',
   task:'<b>규격</b> 버튼을 클릭하세요.',
   highlight:'button[onclick="lintVenue()"]',
   auto:()=>{if(window.lintVenue)window.lintVenue();},
   verify:()=>document.getElementById('checkResult').style.display==='block'},

  {ch:'Ch.8 심사도구',title:'검색/치환',
   story:'Ctrl+H로 검색/치환 패널을 엽니다. 정규식과 대소문자 옵션을 지원합니다.',
   task:'<b>Ctrl+H</b>를 누르거나 검색 패널을 확인하세요.',
   highlight:'#findPanel',
   auto:()=>{if(window.toggleFindPanel)window.toggleFindPanel();},
   verify:()=>document.getElementById('findPanel').style.display!=='none'},

  // Chapter 9: Export & Save
  {ch:'Ch.9 저장',title:'저장하기',
   story:'<b>저장</b>은 기존 파일명을 유지하고, <b>다른이름저장</b>은 새 파일명을 지정합니다. GitHub + 로컬 동시 저장이 가능합니다.',
   task:'<b>저장</b> 또는 <b>다른이름저장</b> 버튼을 클릭하세요.',
   highlight:'button[onclick="ghSave()"]',
   auto:null,
   verify:()=>true},

  {ch:'Ch.9 저장',title:'DOCX 내보내기',
   story:'논문을 Word 문서(.docx)로 내보냅니다. 제목, 저자, 초록, 참고문헌, 표 등이 학술 형식으로 변환됩니다.',
   task:'<b>내보내기</b> 드롭다운에서 <b>Word (.docx)</b>를 선택하세요.',
   highlight:'select[onchange*="export"]',
   auto:null,
   verify:()=>true},

  {ch:'Ch.9 저장',title:'기타 내보내기',
   story:'Markdown (.md), LaTeX (.tex), 발표자료 (.pptx)로도 내보낼 수 있습니다. 모든 형식에서 파일명을 지정합니다.',
   task:'다양한 형식으로 내보내 보세요.',
   highlight:'select[onchange*="export"]',
   auto:null,
   verify:()=>true},

  // Chapter 10: Tools
  {ch:'Ch.10 도구',title:'미리보기 확대/축소',
   story:'미리보기 패널 상단의 +/- 버튼으로 크기를 조절합니다 (50%~200%).',
   task:'미리보기의 <b>+</b> 또는 <b>-</b> 버튼을 클릭하세요.',
   highlight:'#zoomInBtn',
   auto:()=>{if(window.zoomPreview)window.zoomPreview(20);},
   verify:()=>true},

  {ch:'Ch.10 도구',title:'인용 순서 재정렬',
   story:'참고문헌을 본문에서 처음 등장하는 순서대로 자동 재정렬합니다.',
   task:'미리보기의 <b>정렬</b> 버튼을 클릭하세요.',
   highlight:'#reorderBtn',
   auto:()=>{if(window.reorderCitations)window.reorderCitations();},
   verify:()=>true},

  {ch:'Ch.10 도구',title:'그림/표 목록',
   story:'논문 내 모든 그림과 표의 캡션을 목록으로 확인합니다.',
   task:'미리보기의 <b>LOF</b> 버튼을 클릭하세요.',
   highlight:'#lofBtn',
   auto:()=>{if(window.buildFigureTableList)window.buildFigureTableList();},
   verify:()=>document.getElementById('checkResult').style.display==='block'},

  {ch:'Ch.10 도구',title:'샘플 논문 불러오기',
   story:'5편의 AI 보안 논문 샘플을 불러와 에디터의 모든 기능을 체험할 수 있습니다.',
   task:'툴바의 <b>샘플 논문</b> 드롭다운에서 원하는 논문을 선택하세요.',
   highlight:'select[onchange*="loadSamplePaper"]',
   auto:null,
   verify:()=>document.getElementById('input').value.length>1000},

  // Chapter 11: Dataset Search
  {ch:'Ch.11 데이터셋',title:'데이터셋 검색',
   story:'AI/보안 분야 공개 데이터셋을 검색하여 논문에 삽입합니다. 51개 로컬 카탈로그 + Papers With Code + HuggingFace 실시간 검색을 지원합니다.',
   task:'참고문헌 패널의 <b>데이터셋 검색</b>에 키워드를 입력하세요.',
   highlight:'#dsQuery',
   auto:()=>{document.getElementById('dsQuery').value='malware';if(window.searchDataset)window.searchDataset();},
   verify:()=>document.getElementById('dsResults').style.display==='block'},

  {ch:'Ch.11 데이터셋',title:'데이터셋 삽입',
   story:'검색 결과에서 데이터셋을 클릭하면 참고문헌에 자동 등록되고, 본문에 데이터셋 설명 블록이 삽입됩니다.',
   task:'검색 결과에서 원하는 데이터셋을 클릭하세요.',
   highlight:'#dsResults',
   auto:null,
   verify:()=>document.getElementById('input').value.includes('Dataset:')},

  // Chapter 12: Related Papers
  {ch:'Ch.12 선행연구',title:'관련 논문 추천',
   story:'키워드와 초록을 기반으로 Semantic Scholar가 관련 논문을 자동 추천합니다. 클릭하면 참고문헌에 바로 추가됩니다.',
   task:'참고문헌 패널의 <b>관련 논문 추천</b> 버튼을 클릭하세요.',
   highlight:'button[onclick="recommendPapers()"]',
   auto:()=>{if(window.recommendPapers)window.recommendPapers();},
   verify:()=>document.getElementById('recResults').style.display==='block'},

  // Ending
  {ch:'완료',title:'축하합니다!',
   story:'논문 작성의 전 과정을 체험했습니다!<br><br>주요 기능 요약:<br>- <b>심사</b>: 구조적 리뷰 + 심사의견<br>- <b>규격</b>: 양식별 투고 규격 점검<br>- <b>진단/문체</b>: 논문 품질 자동 분석<br>- <b>간편</b>: 초보자 모드<br>- <b>이력</b>: 이전 버전 복원<br>- <b>인쇄</b>: 1단/2단 선택 + PDF<br>- <b>?</b> 도움말에서 100+ 기능 확인',
   task:'',highlight:null,auto:null,verify:()=>true}
];

// Role-specific stories
const COAUTHOR_STORY=[
  {ch:'공동저자',title:'논문 불러오기',
   story:'1저자가 작성 중인 논문을 불러옵니다.',
   task:'<b>불러오기</b> 버튼을 클릭하세요.',
   highlight:'button[onclick="ghLoad()"]',
   auto:()=>{window.loadTestPaper&&window.loadTestPaper(1);},
   verify:()=>document.getElementById('input').value.length>100},
  {ch:'공동저자',title:'섹션 편집',
   story:'담당 섹션을 수정합니다. 에디터에서 해당 부분을 찾아 편집하세요.',
   task:'에디터에서 원하는 섹션을 찾아 내용을 수정하세요.',
   highlight:'#input',auto:null,verify:()=>true},
  {ch:'공동저자',title:'표/그림 추가',
   story:'담당 섹션에 표나 그림을 추가합니다.',
   task:'<b>표</b> 또는 <b>그림</b> 버튼을 클릭하세요.',
   highlight:'button[onclick="ins(\'tbl\')"]',
   auto:()=>{window.ins('tbl');},verify:()=>document.getElementById('input').value.includes('Column')},
  {ch:'공동저자',title:'저장',
   story:'수정 사항을 저장합니다.',
   task:'<b>저장</b> 버튼을 클릭하세요.',
   highlight:'button[onclick="ghSave()"]',auto:null,verify:()=>true}
];

const CORRESPONDING_STORY=[
  {ch:'교신저자',title:'논문 불러오기',
   story:'투고할 최종 원고를 불러옵니다.',
   task:'<b>불러오기</b> 버튼을 클릭하세요.',
   highlight:'button[onclick="ghLoad()"]',
   auto:()=>{window.loadTestPaper&&window.loadTestPaper(1);},
   verify:()=>document.getElementById('input').value.length>100},
  {ch:'교신저자',title:'검증 실행',
   story:'투고 전 필수 항목을 점검합니다.',
   task:'<b>검증</b> 버튼을 클릭하세요.',
   highlight:'button[onclick="validatePaper()"]',
   auto:()=>{window.validatePaper();},verify:()=>document.getElementById('checkResult').style.display==='block'},
  {ch:'교신저자',title:'진단 리포트',
   story:'구조 균형과 품질을 상세 진단합니다.',
   task:'<b>진단</b> 버튼을 클릭하세요.',
   highlight:'button[onclick="diagnosePaper()"]',
   auto:()=>{if(window.diagnosePaper)window.diagnosePaper();},verify:()=>true},
  {ch:'교신저자',title:'문체 일관화',
   story:'문체 혼용과 용어 불일치를 확인합니다.',
   task:'<b>문체</b> 버튼을 클릭하세요.',
   highlight:'button[onclick="analyzeStyle()"]',
   auto:()=>{if(window.analyzeStyle)window.analyzeStyle();},verify:()=>true},
  {ch:'교신저자',title:'벤뉴 규격 체크',
   story:'선택한 양식의 투고 규격(페이지, 참고문헌, 필수 섹션)을 점검합니다.',
   task:'<b>규격</b> 버튼을 클릭하세요.',
   highlight:'button[onclick="lintVenue()"]',
   auto:()=>{if(window.lintVenue)window.lintVenue();},verify:()=>true},
  {ch:'교신저자',title:'심사 체크리스트',
   story:'리뷰어에게 보내기 전, 체크리스트로 자가 점검합니다.',
   task:'<b>심사</b> 버튼을 클릭하세요.',
   highlight:'button[onclick="showReviewChecklist()"]',
   auto:()=>{if(window.showReviewChecklist)window.showReviewChecklist();},verify:()=>true},
  {ch:'교신저자',title:'리뷰 요청',
   story:'검토자에게 리뷰를 요청합니다.',
   task:'<b>리뷰 요청</b> 버튼을 클릭하세요.',
   highlight:'button[onclick="requestReview()"]',auto:null,verify:()=>true},
  {ch:'교신저자',title:'DOCX 내보내기',
   story:'최종 원고를 Word (.docx)로 내보냅니다. LaTeX/PPT도 가능합니다.',
   task:'<b>내보내기</b> 드롭다운에서 형식을 선택하세요.',
   highlight:'select[onchange*="export"]',auto:null,verify:()=>true}
];

const REVIEWER_STORY=[
  {ch:'검토자',title:'논문 불러오기',
   story:'검토 요청을 받은 논문을 불러옵니다.',
   task:'<b>자동 실행</b>을 클릭하여 테스트 논문을 로드하세요.',
   highlight:'button[onclick="ghLoad()"]',
   auto:()=>{window.loadTestPaper&&window.loadTestPaper(1);},
   verify:()=>document.getElementById('input').value.length>100},
  {ch:'검토자',title:'논문 읽기',
   story:'우측 미리보기에서 논문을 읽습니다. 수식, 표, 그림 렌더링을 확인합니다.',
   task:'미리보기를 스크롤하며 논문을 읽어보세요.',
   highlight:'#pv',auto:null,verify:()=>true},
  {ch:'검토자',title:'검증 실행',
   story:'구조적 문제를 자동으로 점검합니다.',
   task:'<b>검증</b> 버튼을 클릭하세요.',
   highlight:'button[onclick="validatePaper()"]',
   auto:()=>{window.validatePaper();},verify:()=>document.getElementById('checkResult').style.display==='block'},
  {ch:'검토자',title:'검토 완료',
   story:'모든 검토를 마쳤습니다.<br>검토자의 주요 기능:<br>- 검증/진단으로 자동 품질 체크<br>- 리뷰 확인에서 코멘트 관리<br>- 저자에게 검토 결과 전달',
   task:'',highlight:null,auto:null,verify:()=>true}
];

let activeStory=FULL_STORY;
let cur=0;
let widget=null;
let isMinimized=false;

function clearHighlights(){
  document.querySelectorAll('.tutorial-highlight').forEach(el=>el.classList.remove('tutorial-highlight'));
}

function applyHighlight(selector){
  clearHighlights();
  if(!selector)return;
  const el=document.querySelector(selector);
  if(el){
    el.classList.add('tutorial-highlight');
    // Scroll into view if not visible
    const rect=el.getBoundingClientRect();
    if(rect.top<0||rect.bottom>window.innerHeight){
      el.scrollIntoView({behavior:'smooth',block:'center'});
    }
  }
}

function createWidget(){
  if(widget){_cleanupWidget();widget.remove();}
  widget=document.createElement('div');
  widget.id='tutorialWidget';
  widget.innerHTML='<div class="tw-header" onclick="if(document.getElementById(\'tutorialWidget\').classList.contains(\'minimized\'))window._tMinimize()"><span>AICRA Tutorial</span><div><button onclick="event.stopPropagation();window._tMinimize()" title="최소화">_</button><button onclick="event.stopPropagation();window._tClose()" title="닫기">X</button></div></div><div class="tw-progress"><div class="tw-progress-bar" id="twProgressBar"></div></div><div class="tw-body" id="twBody"></div><div class="tw-nav" id="twNav"></div>';
  document.body.appendChild(widget);
  // Auto-minimize when any modal opens (so widget doesn't block modals)
  _startModalObserver();
}

let _autoMinimized=false;
function _startModalObserver(){
  const obs=new MutationObserver(()=>{
    if(!widget)return;
    const modals=document.querySelectorAll('.modal-overlay.show');
    if(modals.length>0&&!isMinimized){
      // Auto-minimize when modal opens
      _autoMinimized=true;
      isMinimized=true;
      widget.classList.add('minimized');
      clearHighlights();
    }else if(modals.length===0&&_autoMinimized&&isMinimized){
      // Auto-restore when all modals close
      _autoMinimized=false;
      isMinimized=false;
      widget.classList.remove('minimized');
      renderWidget();
    }
  });
  obs.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
  widget._obs=obs;
}

let _verifyTimer=null,_stepVerified=false;
function _startVerifyPolling(step){
  _stopVerifyPolling();
  _stepVerified=false;
  if(!step.verify||cur>=activeStory.length-1)return;
  _verifyTimer=setInterval(()=>{
    if(!_stepVerified&&step.verify()){
      _stepVerified=true;
      _stopVerifyPolling();
      // Show success toast (no auto-advance)
      const body=document.getElementById('twBody');
      if(body){
        const old=body.querySelector('.tw-toast');if(old)old.remove();
        const toast=document.createElement('div');
        toast.className='tw-toast';
        toast.style.cssText='background:var(--brand,#2f5d50);color:#fff;padding:5px 10px;border-radius:4px;font-size:.62rem;font-weight:700;margin-top:6px;text-align:center';
        toast.textContent='[+] 완료! "다음" 버튼을 눌러 진행하세요.';
        body.appendChild(toast);
      }
      // Highlight "다음" button
      const nextBtn=document.querySelector('#twNav button:last-child');
      if(nextBtn&&nextBtn.textContent.includes('다음')){
        nextBtn.classList.add('primary');
        nextBtn.style.animation='tutPulse 1s infinite';
      }
    }
  },600);
}
function _stopVerifyPolling(){if(_verifyTimer){clearInterval(_verifyTimer);_verifyTimer=null;}}

function _cleanupWidget(){
  _stopVerifyPolling();
  if(widget&&widget._obs){widget._obs.disconnect();widget._obs=null;}
}


function renderWidget(){
  if(!widget)return;
  const step=activeStory[cur];
  const pct=Math.round((cur/(activeStory.length-1))*100);
  const isLast=cur>=activeStory.length-1;

  // Progress
  document.getElementById('twProgressBar').style.width=pct+'%';

  // Body
  const body=document.getElementById('twBody');
  body.innerHTML=
    '<div class="tw-chapter">'+step.ch+' ('+(cur+1)+'/'+activeStory.length+')</div>'+
    '<div class="tw-title">'+step.title+'</div>'+
    '<div class="tw-story">'+step.story+'</div>'+
    (step.task?'<div class="tw-task"><b>&#9758; </b>'+step.task+'</div>':'')+
    (step.highlight?'<span class="tw-locate" onclick="window._tLocate()">&#8594; 해당 버튼 찾기</span>':'');

  // Navigation
  const nav=document.getElementById('twNav');
  nav.innerHTML=
    (cur>0?'<button onclick="window._tPrev()">&#9664; 이전</button>':'')+
    (step.auto?'<button onclick="window._tAuto()" title="직접 해보기 어려우면 데모로 실행합니다" style="border-color:var(--accent);color:var(--accent)">실행 (데모)</button>':'')+
    '<span class="spacer"></span>'+
    (!isLast?'<button onclick="window._tNext()">다음 &#9654;</button>':'<button class="primary" onclick="window._tFinish()">완료</button>');

  // Apply highlight
  applyHighlight(step.highlight);

  // Start verify polling: if user does the action themselves, auto-advance
  _startVerifyPolling(step);
}

function showRoleSelect(){
  createWidget();
  const body=document.getElementById('twBody');
  body.innerHTML=
    '<div style="text-align:center;padding:8px 0">'+
    '<div style="font-size:.88rem;font-weight:700;color:var(--brand);margin-bottom:4px">AICRA Paper Editor</div>'+
    '<div style="font-size:.65rem;color:var(--muted);margin-bottom:12px">역할에 맞는 튜토리얼을 시작합니다</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">'+
    '<div onclick="window._tRole(\'author\')" style="cursor:pointer;padding:10px 8px;border:2px solid var(--brand);border-radius:6px;transition:.2s" onmouseover="this.style.background=\'var(--surface)\'" onmouseout="this.style.background=\'\'">'+
    '<div style="font-size:.82rem;font-weight:700">1저자</div>'+
    '<div style="font-size:.55rem;color:var(--muted)">논문 작성 전 과정</div></div>'+
    '<div onclick="window._tRole(\'coauthor\')" style="cursor:pointer;padding:10px 8px;border:2px solid var(--line);border-radius:6px;transition:.2s" onmouseover="this.style.background=\'var(--surface)\'" onmouseout="this.style.background=\'\'">'+
    '<div style="font-size:.82rem;font-weight:700">공동저자</div>'+
    '<div style="font-size:.55rem;color:var(--muted)">불러오기 + 편집</div></div>'+
    '<div onclick="window._tRole(\'corresponding\')" style="cursor:pointer;padding:10px 8px;border:2px solid var(--line);border-radius:6px;transition:.2s" onmouseover="this.style.background=\'var(--surface)\'" onmouseout="this.style.background=\'\'">'+
    '<div style="font-size:.82rem;font-weight:700">교신저자</div>'+
    '<div style="font-size:.55rem;color:var(--muted)">검증 + 투고</div></div>'+
    '<div onclick="window._tRole(\'reviewer\')" style="cursor:pointer;padding:10px 8px;border:2px solid var(--line);border-radius:6px;transition:.2s" onmouseover="this.style.background=\'var(--surface)\'" onmouseout="this.style.background=\'\'">'+
    '<div style="font-size:.82rem;font-weight:700">검토자</div>'+
    '<div style="font-size:.55rem;color:var(--muted)">읽기 + 첨삭</div></div>'+
    '</div>'+
    '</div>';
  document.getElementById('twNav').innerHTML=
    '<span class="spacer"></span>'+
    '<button onclick="window._tSkip()">건너뛰기</button>';
}

// === Public API ===
window._tRole=function(role){
  if(role==='author')activeStory=FULL_STORY;
  else if(role==='coauthor')activeStory=COAUTHOR_STORY;
  else if(role==='corresponding')activeStory=CORRESPONDING_STORY;
  else if(role==='reviewer')activeStory=REVIEWER_STORY;
  cur=0;
  renderWidget();
};

window._tAuto=function(){
  const s=activeStory[cur];if(!s||!s.auto)return;
  const inp=document.getElementById('input');
  const pv=document.getElementById('pv');
  const beforeVal=inp?inp.value:'';
  // Execute the demo action (actually modifies editor)
  s.auto();
  // Force preview re-render
  if(inp)inp.dispatchEvent(new Event('input'));
  if(window.render)window.render();
  // Scroll + visual feedback
  setTimeout(()=>{
    const changed=inp&&inp.value!==beforeVal;
    if(changed){
      inp.scrollTop=inp.scrollHeight;
      inp.style.transition='box-shadow .3s';
      inp.style.boxShadow='inset 0 0 12px rgba(183,121,31,.4)';
      setTimeout(()=>{inp.style.boxShadow='';},1500);
    }
    if(pv){
      pv.scrollTop=pv.scrollHeight;
      pv.style.transition='box-shadow .3s';
      pv.style.boxShadow='inset 0 0 12px rgba(47,93,80,.3)';
      setTimeout(()=>{pv.style.boxShadow='';},1500);
    }
    // Show "실행됨" feedback in widget
    const body=document.getElementById('twBody');
    if(body){
      const old=body.querySelector('.tw-toast');if(old)old.remove();
      const toast=document.createElement('div');
      toast.className='tw-toast';
      toast.style.cssText='background:var(--accent,#b7791f);color:#fff;padding:5px 10px;border-radius:4px;font-size:.62rem;font-weight:700;margin-top:6px;text-align:center';
      toast.textContent='[+] 실행됨! 에디터와 미리보기를 확인하세요.';
      body.appendChild(toast);
      setTimeout(()=>{if(toast.parentNode)toast.remove();},3000);
    }
  },400);
};
window._tNext=function(){if(cur<activeStory.length-1){cur++;renderWidget();}};
window._tPrev=function(){if(cur>0){cur--;renderWidget();}};
window._tLocate=function(){
  const s=activeStory[cur];
  if(s&&s.highlight){
    const el=document.querySelector(s.highlight);
    if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.focus&&el.focus();}
  }
};
window._tMinimize=function(){
  if(!widget)return;
  isMinimized=!isMinimized;
  widget.classList.toggle('minimized',isMinimized);
  if(!isMinimized)renderWidget();
  else{clearHighlights();_stopVerifyPolling();}
};
window._tClose=function(){
  localStorage.setItem('aicra.tutorial.done','true');
  clearHighlights();_cleanupWidget();
  if(widget){widget.remove();widget=null;}
};
window._tFinish=function(){
  localStorage.setItem('aicra.tutorial.done','true');
  clearHighlights();_cleanupWidget();
  if(widget){widget.remove();widget=null;}
};
window._tSkip=function(){
  localStorage.setItem('aicra.tutorial.done','true');
  clearHighlights();_cleanupWidget();
  if(widget){widget.remove();widget=null;}
};

window.startTutorial=function(){
  cur=0;
  isMinimized=false;
  showRoleSelect();
};

// === First visit detection ===
window._tutorialFirstVisit=function(){
  if(!localStorage.getItem('aicra.tutorial.done')){
    // Delay slightly to let editor initialize
    setTimeout(()=>{window.startTutorial();},800);
  }
};

// Test paper loader
window.loadTestPaper=function(num){
  const paper=`# LLM Prompt Injection Defense Framework

**Authors:** Test Author

:::abstract
본 논문은 LLM 기반 시스템에 대한 프롬프트 인젝션 공격을 탐지하고 방어하는 프레임워크를 제안한다.
:::

---

## 1. Introduction

LLM 기반 시스템이 확산됨에 따라 프롬프트 인젝션 공격이 주요 위협으로 부상하고 있다 [cite:1].

---

## 2. Background

### 2.1 Prompt Injection
프롬프트 인젝션은 악의적 입력을 통해 LLM의 정책을 우회하는 공격이다.

---

## 3. Threat Model

**Adversary**
- **Goal:** 안전 정렬 우회
- **Access:** black-box (API)

---

## 4. Proposed Approach

$$
\\mathcal{L}_{defense} = \\mathcal{L}_{task} + \\lambda \\cdot \\mathcal{L}_{safety}
$$

:::theorem 방어 수렴성
제안 방어 필터는 유한 쿼리 내에서 최적 정책에 수렴한다.
:::

:::algorithm Prompt Shield
Input: 입력 x, 탐지기 D, 임계값 tau
Output: 안전 응답 y
1. risk = D(x)
2. If risk > tau: x = sanitize(x)
3. y = LLM(x)
4. Return y
:::

---

## 5. Evaluation

*Table 1. 성능 비교.*
| Method | ASR (%) | Clean Acc (%) | F1 |
|--------|---------|---------------|-----|
| No Defense | 78.3 | 94.1 | 0.72 |
| Prompt Shield | 8.7 | 93.2 | 0.91 |

---

## 6. Conclusion

제안 기법은 ASR을 78.3%에서 8.7%로 감소시켰다[^1].

[^1]: 5회 반복 실험 평균.

---

## References
`;
  const inp=document.getElementById('input');
  inp.focus();inp.select();
  document.execCommand('insertText',false,paper);
  inp.dispatchEvent(new Event('input'));
  document.getElementById('ti').value='LLM Prompt Injection Defense';
};
})();
