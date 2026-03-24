---
layout: paper
title: "AICRA Paper Editor 작성 가이드"
author: AICRA
authors: []
collaborative: true
date: 2026-03-24
status: published
domain: "AI Governance"
abstract: "AICRA Paper Editor의 주요 기능과 논문 작성 방법을 안내하는 가이드 문서입니다. 양식 선택, 수식, 환경 블록, 인용/각주, 다이어그램, 참고문헌 관리, 초록 생성, 내보내기 등 전체 기능을 다룹니다."
keywords: [guide, template, paper editor, AICRA]
---

## 1. Paper Editor 소개

AICRA Paper Editor는 AI 보안 및 정보보안 연구 논문을 작성할 수 있는 통합 편집기입니다.

**주요 기능:**
- 20종 이상의 학회/저널 양식 템플릿 (NeurIPS, CCS, IEEE, KCI 등)
- KaTeX 수식 렌더링
- 학술 환경 블록 (정리, 정의, 증명, 알고리즘)
- 참고문헌 검색 (Semantic Scholar, CrossRef, RISS, KCI 등 7개 DB)
- 참고문헌 자동 포맷 (IEEE, APA, Chicago, Vancouver, 한국학술지)
- 초록 자동 생성
- 내보내기 (Markdown / LaTeX / PowerPoint)
- GitHub 저장/불러오기/자동저장/잠금
- Collaborator 기반 저자 관리 및 접근 제어

[에디터 전체 기능 가이드 보기](/paper-editor-guide/)

---

## 2. 양식 선택

에디터 상단 드롭다운에서 투고 대상 학회/저널의 양식을 선택하면 논문 구조가 자동으로 삽입됩니다.

| 분류 | 양식 |
|------|------|
| AI/ML 학회 | NeurIPS, ICML, ICLR, AAAI |
| 보안 학회 | ACM CCS, NDSS, IEEE S&P, USENIX Security |
| 보안 저널 | IEEE TDSC, IEEE TIFS, 정보보호학회논문지 |
| 한국 양식 | KCI/학회 논문, 국내 저널 |
| 학위논문 | 박사학위논문 (국문/영문) |
| 법/정책 | 법학 논문, 컴플라이언스, 거버넌스, 정책 제안 |

---

## 3. 수식 입력

**인라인 수식**: `$E = mc^2$` -> $E = mc^2$

**블록 수식** (자동 번호 매김):

$$
\mathcal{L} = \sum_{i=1}^{N} \ell(f(x_i), y_i) + \lambda \|\theta\|_2^2
$$

**단축키**: Ctrl+M으로 인라인 수식을 빠르게 감쌉니다.

---

## 4. 학술 환경 블록

:::theorem 예시 정리
모든 유한 집합 $A$에 대해 $|A| \geq 0$이 성립한다.
:::

:::definition 공정성 (Fairness)
모든 그룹 $G$에 대해 $|P(\hat{Y}=1|G=g_1) - P(\hat{Y}=1|G=g_2)| \leq \epsilon$.
:::

:::proof
$A$가 유한집합이므로 원소의 개수는 음이 아닌 정수이다. 따라서 $|A| \geq 0$.
:::

:::algorithm 방어 알고리즘
Input: 입력 프롬프트 $x$, 탐지기 $D$, 정책 $P$
Output: 안전한 응답 $y$
1. $\text{risk} \leftarrow D(x)$
2. If $\text{risk} > \tau$: $x' \leftarrow \text{sanitize}(x, P)$
3. $y \leftarrow \text{model}(x')$
4. Return $y$
:::

---

## 5. 표와 그림

**표** (캡션은 표 위에):

*Table 1. 방법별 성능 비교.*

| Method | Accuracy | Precision | Recall | F1 |
|--------|----------|-----------|--------|-----|
| Baseline | 0.72 | 0.68 | 0.70 | 0.69 |
| Proposed | 0.89 | 0.87 | 0.85 | 0.86 |

**그림** (캡션은 그림 아래):

이미지 삽입 후 `{width=60%}`로 크기를 조절합니다.

---

## 6. 인용과 각주

**번호 인용**: 참고문헌 패널에 문헌을 등록하고 `[cite:N]`으로 참조합니다.

**직접인용**: `> "[원문]" [cite:1]` -> 블록인용 형식

**간접인용**: `[저자]에 따르면, [재서술] [cite:1].` -> 문장 형식

**각주**: `[^1]`을 본문에 넣고 `[^1]: 설명`을 정의합니다[^1].

[^1]: 각주는 보충 설명에 사용합니다. 단축키: Alt+N.

---

## 7. 보안 논문 요소

### 위협 모델

**Assets** - 보호 대상 (예: 모델 가중치, API 키)

**Adversary** - 공격자 목표, 접근 수준 (black/gray/white-box), 능력

**Attack Surface** - 진입점 (프롬프트, API, RAG)

**Assumptions** - 전제 조건

**Out-of-Scope** - 고려하지 않는 것

### 프레임워크 매핑

| Finding | MITRE ATLAS | OWASP LLM Top 10 | NIST AI RMF |
|---------|-------------|-------------------|-------------|
| 예시 | AML.T0051 | LLM01 | MAP 1.1 |

---

## 8. 참고문헌 관리

참고문헌 패널에서 **학술 DB 검색** (Semantic Scholar, RISS, KCI 등)으로 문헌을 찾고, **자동 포맷** (IEEE, APA, 한국학술지 등)으로 올바른 형식을 생성합니다.

---

## 9. 내보내기

| 형식 | 설명 |
|------|------|
| Markdown (.md) | CMS 발행 또는 파일 다운로드 |
| LaTeX (.tex) | IEEEtran/acmart/article 클래스 |
| PowerPoint (.pptx) | 발표용 슬라이드 자동 생성 |

---

## 10. 저자 및 권한

| 역할 | 읽기 | 편집 | 잠금 | 삭제 |
|------|:----:|:----:|:----:|:----:|
| 1저자 (author) | O | O | O | O |
| 교신저자 | O | O | X | X |
| 공동저자 | O | O (잠금 시 X) | X | X |
| collaborative: true | O | O | X | X |

**저자 정보 버튼**으로 GitHub ID에 실명/소속을 매핑할 수 있습니다.

---

## References

[1] OWASP, "Top 10 for LLM Applications 2025," 2024.

[2] MITRE, "ATLAS - Adversarial Threat Landscape for AI Systems," 2024.

[3] NIST, "AI Risk Management Framework (AI RMF 1.0)," 2023.
