/**
 * AICRA Paper Editor - Story-based Interactive Tutorial
 * "LLM 보안 논문을 함께 작성해봅시다" 시나리오
 */
(function(){

const STORY=[
  // === Chapter 1: 시작 ===
  {ch:'Chapter 1',title:'논문 시작하기',
   story:'당신은 AICRA 연구원입니다. LLM 프롬프트 인젝션 방어 기법에 대한 논문을 작성하려 합니다. 먼저 양식을 선택합시다.',
   task:'상단 <b>-- Format --</b> 드롭다운에서 <b>IEEE Conference</b>를 선택하세요.',
   auto:()=>{document.getElementById('tplSel').value='ieee_en';document.getElementById('tplSel').dispatchEvent(new Event('change'));},
   verify:()=>document.getElementById('input').value.includes('Introduction')},

  {ch:'Chapter 1',title:'제목과 메타데이터',
   story:'양식이 로드되었습니다. 이제 논문의 기본 정보를 입력합니다.',
   task:'<b>제목</b>에 "LLM 프롬프트 인젝션 방어 프레임워크"를 입력하세요.<br><b>분야</b>를 "Prompt Injection"으로 선택하세요.',
   auto:()=>{document.getElementById('ti').value='LLM 프롬프트 인젝션 방어 프레임워크';document.getElementById('dm').value='Prompt Injection';},
   verify:()=>document.getElementById('ti').value.length>5},

  // === Chapter 2: 본문 작성 ===
  {ch:'Chapter 2',title:'서론 수정하기',
   story:'템플릿의 서론을 실제 내용으로 채워봅시다. 에디터 좌측에서 Introduction 섹션을 찾아 수정합니다.',
   task:'서론의 [Motivation] 부분을 "LLM 기반 시스템이 확산됨에 따라 프롬프트 인젝션 공격이 주요 위협으로 부상하고 있다."로 수정하세요.',
   auto:()=>{const v=document.getElementById('input').value;const nv=v.replace('<!-- Structure: Problem -> Why it matters','LLM 기반 시스템이 확산됨에 따라 프롬프트 인젝션 공격이 주요 위협으로 부상하고 있다.\n\n<!-- Structure: Problem -> Why it matters');window.replaceAll(nv);document.getElementById('input').dispatchEvent(new Event('input'));},
   verify:()=>document.getElementById('input').value.includes('프롬프트 인젝션')},

  {ch:'Chapter 2',title:'수식 추가',
   story:'방어 기법의 핵심 수식을 추가합니다. 손실 함수를 정의합시다.',
   task:'커서를 원하는 위치에 두고 <b>수식</b> 버튼을 클릭하세요. 또는 직접 <code>$$...$$</code>를 입력하세요.',
   auto:()=>{window.typeText('\n\n$$\n\\mathcal{L}_{defense} = \\mathcal{L}_{task} + \\lambda \\cdot \\mathcal{L}_{safety}\n$$\n');},
   verify:()=>document.getElementById('input').value.includes('$$')},

  // === Chapter 3: 학술 환경 ===
  {ch:'Chapter 3',title:'정리와 증명',
   story:'제안 기법의 수렴성을 정리(Theorem)로 공식화합니다.',
   task:'<b>정리</b> 버튼을 클릭하세요. 내용을 "제안 방어 필터는 유한 쿼리 내에서 최적 정책에 수렴한다."로 수정하세요.',
   auto:()=>{window.typeText('\n:::theorem 방어 수렴성\n제안 방어 필터는 유한 쿼리 $T < \\infty$ 내에서 최적 정책 $\\pi^*$에 수렴한다.\n:::\n\n:::proof\n마르코프 결정 과정의 수축 사상 정리에 의해, 가치 함수 $V$는 고정점에 수렴한다.\n:::\n');},
   verify:()=>document.getElementById('input').value.includes(':::theorem')},

  {ch:'Chapter 3',title:'알고리즘',
   story:'방어 알고리즘의 의사코드를 추가합니다.',
   task:'<b>알고리즘</b> 버튼을 클릭하세요.',
   auto:()=>{window.typeText('\n:::algorithm Prompt Shield\nInput: 입력 프롬프트 x, 탐지 모델 D, 임계값 tau\nOutput: 안전한 응답 y\n1. risk_score = D(x)\n2. If risk_score > tau:\n   a. x_safe = sanitize(x)\n   b. log_alert(x, risk_score)\n3. Else: x_safe = x\n4. y = LLM(x_safe)\n5. Return y\n:::\n');},
   verify:()=>document.getElementById('input').value.includes(':::algorithm')},

  // === Chapter 4: 보안 요소 ===
  {ch:'Chapter 4',title:'위협 모델',
   story:'논문의 핵심인 위협 모델을 정의합니다. 공격자의 능력과 가정을 명시합시다.',
   task:'<b>위협모델</b> 버튼을 클릭하세요. 삽입된 템플릿의 빈칸을 채워보세요.',
   auto:()=>{window.ins('threat');},
   verify:()=>document.getElementById('input').value.includes('Adversary')},

  {ch:'Chapter 4',title:'프레임워크 매핑',
   story:'발견한 취약점을 MITRE ATLAS와 OWASP에 매핑합니다.',
   task:'<b>프레임워크</b> 버튼을 클릭하세요.',
   auto:()=>{window.ins('framework');},
   verify:()=>document.getElementById('input').value.includes('MITRE')},

  // === Chapter 5: 실험 결과 ===
  {ch:'Chapter 5',title:'성능 비교표',
   story:'Baseline과 제안 기법의 성능을 비교하는 표를 작성합니다.',
   task:'<b>성능표</b> 버튼을 클릭하세요. 데이터를 채워보세요.',
   auto:()=>{window.typeText('\n*Table 2. 방어 기법 성능 비교 (UNSW-NB15 데이터셋, 5회 반복).*\n| Method | ASR (%) | Clean Acc (%) | F1 | Latency (ms) |\n|--------|---------|---------------|-----|-------------|\n| No Defense | 78.3 | 94.1 | 0.72 | 12 |\n| Input Filter | 31.2 | 91.5 | 0.83 | 18 |\n| Prompt Shield (Ours) | 8.7 | 93.2 | 0.91 | 15 |\n\n');},
   verify:()=>document.getElementById('input').value.includes('Prompt Shield')},

  {ch:'Chapter 5',title:'혼동 행렬',
   story:'분류 결과를 혼동 행렬로 정리합니다.',
   task:'<b>혼동행렬</b> 버튼을 클릭하세요.',
   auto:()=>{window.ins('confmat');},
   verify:()=>document.getElementById('input').value.includes('Predicted')},

  // === Chapter 6: 시각화 ===
  {ch:'Chapter 6',title:'시스템 구조도',
   story:'제안 시스템의 아키텍처를 다이어그램으로 표현합니다.',
   task:'<b>구조도</b> 버튼을 클릭하세요. Mermaid 다이어그램이 삽입됩니다.',
   auto:()=>{window.ins('arch');},
   verify:()=>document.getElementById('input').value.includes('flowchart')},

  {ch:'Chapter 6',title:'공격 흐름도',
   story:'프롬프트 인젝션 공격의 Kill Chain을 시각화합니다.',
   task:'<b>공격흐름</b> 버튼을 클릭하세요.',
   auto:()=>{window.ins('killchain');},
   verify:()=>document.getElementById('input').value.includes('Reconnaissance')},

  // === Chapter 7: 인용과 각주 ===
  {ch:'Chapter 7',title:'참고문헌 추가',
   story:'관련 연구를 인용합니다. 참고문헌 패널을 열어 문헌을 등록합시다.',
   task:'<b>참고문헌</b> 버튼을 클릭하세요. 패널에서 문헌을 추가해 보세요.',
   auto:()=>{window.toggleRef();if(typeof refs!=='undefined'){refs.push('Greshake et al., "Not What You Signed Up For: Compromising LLMs with Indirect Prompt Injection," arXiv:2302.12173, 2023.');refs.push('OWASP, "Top 10 for LLM Applications 2025," 2024.');if(window.renderRefs)window.renderRefs();if(window.render)window.render();}},
   verify:()=>typeof refs!=='undefined'&&refs.length>=2},

  {ch:'Chapter 7',title:'각주 삽입',
   story:'보충 설명을 각주로 추가합니다.',
   task:'<b>각주</b> 버튼 또는 <b>Alt+N</b>을 눌러보세요.',
   auto:()=>{window.typeText('\n\n본 실험에서 사용한 LLM은 GPT-4 기반이다[^1].\n\n[^1]: OpenAI GPT-4 API, 2024년 3월 기준 버전 사용.\n');},
   verify:()=>document.getElementById('input').value.includes('[^')},

  // === Chapter 8: 마무리 ===
  {ch:'Chapter 8',title:'초록 자동 생성',
   story:'본문이 완성되었습니다. 이제 초록을 자동으로 생성합니다.',
   task:'<b>초록 생성</b> 버튼을 클릭하세요. 모달에서 내용을 확인하고 삽입하세요.',
   auto:()=>{window.genAbstract();},
   verify:()=>document.getElementById('absModal').classList.contains('show')},

  {ch:'Chapter 8',title:'논문 검증',
   story:'투고 전에 논문 구조를 점검합니다.',
   task:'<b>검증</b> 버튼을 클릭하세요. 결과를 확인하고 부족한 부분을 보완하세요.',
   auto:()=>{window.validatePaper();},
   verify:()=>document.getElementById('checkResult').style.display==='block'},

  {ch:'Chapter 8',title:'도움말 확인',
   story:'도움말에서 작성법 가이드를 확인합니다.',
   task:'<b>?</b> 버튼을 클릭하고 <b>작성법</b> 탭을 확인하세요.',
   auto:()=>{window.toggleHelp();},
   verify:()=>document.getElementById('helpPanel').classList.contains('show')},

  // === Ending ===
  {ch:'완료',title:'축하합니다!',
   story:'<b>"LLM 프롬프트 인젝션 방어 프레임워크"</b> 논문의 초안이 완성되었습니다!<br><br>이제 자유롭게 다음을 시도해 보세요:<br>- <b>내보내기</b>: Markdown / LaTeX / PPT<br>- <b>저장</b>: GitHub에 초안 저장<br>- <b>리뷰 요청</b>: 검토자에게 첨삭 요청<br>- <b>2단 미리보기</b>: 학술 논문 레이아웃 확인<br>- <b>다크 모드</b>: 눈 편한 모드로 전환<br><br>에디터의 모든 기능은 <b>?</b> 버튼에서 확인할 수 있습니다.',
   task:'',auto:null,verify:()=>true}
];

let cur=0;

function render(){
  const s=STEPS_EL();if(!s)return;
  const step=STORY[cur];
  const pct=Math.round((cur/(STORY.length-1))*100);
  const isLast=cur>=STORY.length-1;

  let nav='';
  let lastCh='';
  STORY.forEach((st,i)=>{
    if(st.ch!==lastCh){nav+='<div style="font-size:.52rem;font-weight:700;color:var(--brand);margin-top:4px;padding:1px 4px">'+st.ch+'</div>';lastCh=st.ch;}
    const icon=i<cur?'[+]':i===cur?'>>':'  ';
    const col=i<cur?'var(--brand)':i===cur?'var(--text)':'var(--muted)';
    nav+='<div style="padding:1px 8px;font-size:.5rem;color:'+col+';cursor:pointer;'+(i===cur?'font-weight:700;background:var(--surface);border-radius:2px':'')+'" onclick="window._tGo('+i+')">'+icon+' '+st.title+'</div>';
  });

  s.innerHTML=
    '<div style="display:flex;height:100%">'+
    '<div style="width:150px;overflow-y:auto;border-right:1px solid var(--line);padding:4px;flex-shrink:0;font-size:.55rem">'+
    '<div style="font-size:.58rem;font-weight:700;color:var(--brand);padding:2px 4px">튜토리얼</div>'+
    '<div style="background:var(--line);height:2px;border-radius:1px;margin:3px 4px"><div style="width:'+pct+'%;background:var(--brand);height:100%;border-radius:1px;transition:width .3s"></div></div>'+
    nav+
    '</div>'+
    '<div style="flex:1;padding:14px;display:flex;flex-direction:column;overflow-y:auto">'+
    '<div style="font-size:.55rem;color:var(--muted);margin-bottom:2px">'+step.ch+'</div>'+
    '<h3 style="font-size:.88rem;color:var(--brand);margin-bottom:8px">'+step.title+'</h3>'+
    '<div style="font-size:.72rem;line-height:1.65;margin-bottom:10px;padding:10px;background:var(--surface);border-radius:6px;border-left:3px solid var(--brand)">'+step.story+'</div>'+
    (step.task?'<div style="font-size:.7rem;line-height:1.5;margin-bottom:10px"><b>할 일:</b> '+step.task+'</div>':'')+
    '<div style="display:flex;gap:6px;margin-top:auto;flex-shrink:0">'+
    (step.auto?'<button class="bt p" onclick="window._tAuto()" style="padding:5px 14px">자동 실행</button>':'')+
    (cur>0?'<button class="bt" onclick="window._tPrev()" style="padding:5px 10px">이전</button>':'')+
    (!isLast?'<button class="bt" onclick="window._tNext()" style="padding:5px 10px">다음 단계</button>':'')+
    '<button class="bt" onclick="window._tClose()" style="padding:5px 10px;margin-left:auto">닫기</button>'+
    '</div>'+
    '</div>'+
    '</div>';
}

function STEPS_EL(){return document.getElementById('tutorialModal');}

window._tAuto=function(){const s=STORY[cur];if(s.auto)s.auto();};
window._tNext=function(){if(cur<STORY.length-1){cur++;render();}};
window._tPrev=function(){if(cur>0){cur--;render();}};
window._tGo=function(i){cur=i;render();};
window._tClose=function(){document.getElementById('tutorialOverlay').classList.remove('show');};

function showRoleSelect(){
  const m=STEPS_EL();if(!m)return;
  m.innerHTML=
    '<div style="padding:24px;text-align:center">'+
    '<h2 style="font-size:1rem;color:var(--brand);margin-bottom:6px">AICRA Paper Editor 튜토리얼</h2>'+
    '<p style="font-size:.72rem;color:var(--muted);margin-bottom:16px">역할을 선택하면 맞춤형 시나리오가 시작됩니다.</p>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:400px;margin:0 auto">'+

    '<div onclick="window._tRole(\'author\')" style="cursor:pointer;padding:14px;border:2px solid var(--brand);border-radius:8px;text-align:center;transition:.2s" onmouseover="this.style.background=\'var(--surface)\'" onmouseout="this.style.background=\'\'">'+
    '<div style="font-size:1.1rem;margin-bottom:4px">1저자</div>'+
    '<div style="font-size:.62rem;color:var(--muted)">논문 작성 전 과정 체험<br>양식 -> 작성 -> 내보내기</div></div>'+

    '<div onclick="window._tRole(\'coauthor\')" style="cursor:pointer;padding:14px;border:2px solid var(--line);border-radius:8px;text-align:center;transition:.2s" onmouseover="this.style.background=\'var(--surface)\'" onmouseout="this.style.background=\'\'">'+
    '<div style="font-size:1.1rem;margin-bottom:4px">공동저자</div>'+
    '<div style="font-size:.62rem;color:var(--muted)">기존 논문 불러오기<br>섹션 편집 + 표/그림 추가</div></div>'+

    '<div onclick="window._tRole(\'corresponding\')" style="cursor:pointer;padding:14px;border:2px solid var(--line);border-radius:8px;text-align:center;transition:.2s" onmouseover="this.style.background=\'var(--surface)\'" onmouseout="this.style.background=\'\'">'+
    '<div style="font-size:1.1rem;margin-bottom:4px">교신저자</div>'+
    '<div style="font-size:.62rem;color:var(--muted)">투고 전 최종 검토<br>검증 + 내보내기 + 리뷰 관리</div></div>'+

    '<div onclick="window._tRole(\'reviewer\')" style="cursor:pointer;padding:14px;border:2px solid var(--line);border-radius:8px;text-align:center;transition:.2s" onmouseover="this.style.background=\'var(--surface)\'" onmouseout="this.style.background=\'\'">'+
    '<div style="font-size:1.1rem;margin-bottom:4px">검토자</div>'+
    '<div style="font-size:.62rem;color:var(--muted)">논문 읽기 + 첨삭<br>코멘트/수정제안 입력</div></div>'+

    '</div>'+
    '<button class="bt" onclick="window._tClose()" style="margin-top:14px;padding:5px 14px">닫기</button>'+
    '</div>';
}

window._tRole=function(role){
  // Adjust tutorial flow based on role
  if(role==='author'){
    cur=0; // Full tutorial from beginning
  }else if(role==='coauthor'){
    // Skip template selection, start from editing
    cur=2; // Start at "서론 수정하기"
  }else if(role==='corresponding'){
    // Start from review/validation
    cur=14; // Start at "초록 자동 생성"
  }else if(role==='reviewer'){
    // Special reviewer flow - load test paper first
    cur=0;
    // Override first step for reviewer
    STORY[0]={ch:'검토자 가이드',title:'논문 불러오기',
      story:'검토 요청을 받은 논문을 불러옵니다. 테스트를 위해 샘플 논문을 로드합니다.',
      task:'<b>자동 실행</b>을 클릭하여 테스트 논문을 로드하세요.',
      auto:()=>{window.loadTestPaper&&window.loadTestPaper(1);},
      verify:()=>document.getElementById('input').value.length>100};
    STORY[1]={ch:'검토자 가이드',title:'미리보기로 논문 읽기',
      story:'미리보기 영역에서 논문을 읽습니다. 수식, 표, 그림이 올바르게 렌더링되는지 확인하세요.',
      task:'우측 <b>미리보기</b>를 스크롤하며 읽어보세요.',
      auto:null,verify:()=>true};
    STORY[2]={ch:'검토자 가이드',title:'첨삭/주석 입력',
      story:'미리보기에서 문단을 클릭하면 주석을 입력할 수 있습니다. (읽기전용 모드에서 활성화)',
      task:'미리보기의 아무 문단을 클릭해 보세요. 또는 <b>자동 실행</b>으로 주석 입력 모달을 열어보세요.',
      auto:()=>{window.openAnnotInput&&window.openAnnotInput('제안 방어 필터는 유한 쿼리 내에서 최적 정책에 수렴한다.');},
      verify:()=>document.getElementById('annotModal')&&document.getElementById('annotModal').classList.contains('show')};
    STORY[3]={ch:'검토자 가이드',title:'검토 완료',
      story:'모든 주석을 입력했습니다. 저자에게 검토 결과가 전달됩니다.<br><br>검토자의 주요 기능:<br>- 문단 클릭으로 코멘트 추가<br>- 수정 제안 (대체 텍스트 제안)<br>- 질문 / 오류 지적<br>- 주석은 자동으로 GitHub에 저장',
      task:'',auto:null,verify:()=>true};
    // Truncate story for reviewer
    STORY.length=4;
  }
  render();
};

window.startTutorial=function(){
  cur=0;
  let ov=document.getElementById('tutorialOverlay');
  if(!ov){
    ov=document.createElement('div');
    ov.id='tutorialOverlay';
    ov.className='modal-overlay';
    ov.innerHTML='<div id="tutorialModal" class="modal-box" style="max-width:700px;height:460px;overflow:hidden"></div>';
    document.body.appendChild(ov);
  }
  ov.classList.add('show');
  showRoleSelect();
};

// Test paper loader
window.loadTestPaper=function(num){
  const paper=`# LLM Prompt Injection Defense Framework

**Authors:** Test Author

:::abstract
본 논문은 LLM 기반 시스템에 대한 프롬프트 인젝션 공격을 탐지하고 방어하는 프레임워크를 제안한다. 제안 기법은 입력 필터링과 안전 정렬을 결합하여 공격 성공률을 78.3%에서 8.7%로 감소시켰다.
:::

---

## 1. Introduction

LLM 기반 시스템이 확산됨에 따라 프롬프트 인젝션 공격이 주요 위협으로 부상하고 있다 [cite:1].

---

## 2. Background

### 2.1 Prompt Injection
프롬프트 인젝션은 악의적 입력을 통해 LLM의 정책을 우회하는 공격이다.

### 2.2 Defenses
기존 방어 기법은 입력 필터링 [cite:1]과 모델 수정 [cite:2]으로 분류된다.

---

## 3. Threat Model

**Assets** - 모델 가중치, 시스템 프롬프트, 사용자 데이터

**Adversary**
- **Goal:** 안전 정렬 우회
- **Access:** black-box (API)
- **Capabilities:** 쿼리 예산 1,000회

---

## 4. Proposed Approach

$$
\\mathcal{L}_{defense} = \\mathcal{L}_{task} + \\lambda \\cdot \\mathcal{L}_{safety}
$$

:::theorem 방어 수렴성
제안 방어 필터는 유한 쿼리 $T < \\infty$ 내에서 최적 정책에 수렴한다.
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
