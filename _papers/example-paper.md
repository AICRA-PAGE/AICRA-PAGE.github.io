---
layout: paper
title: "AICRA Papers 작성 가이드"
author: AICRA
authors: []
collaborative: true
date: 2026-03-24
status: published
abstract: "AICRA Papers 시스템 사용 가이드입니다. 이 문서를 참고하여 논문을 작성하세요."
keywords: [guide, template]
---

## 1. 소개

AICRA Papers는 연구회 멤버가 소논문을 공동 작성하고 게시할 수 있는 시스템입니다.

## 2. 작성 방법

### 2.1 Front Matter

```yaml
---
layout: paper
title: "논문 제목"
author: github-id          # 1저자 (수정 권한 소유)
authors: [co-author1, co-author2]  # 공저자 (수정 가능)
collaborative: false       # true면 누구나 수정 가능
date: 2026-03-24
status: draft             # draft / review / published
abstract: "초록 내용"
keywords: [keyword1, keyword2]
---
```

### 2.2 수식 (LaTeX)

인라인 수식: $E = mc^2$

블록 수식:

$$
\frac{\partial f}{\partial x} = \lim_{h \to 0} \frac{f(x+h) - f(x)}{h}
$$

### 2.3 표

| Method | Precision | Recall | F1 |
|--------|-----------|--------|-----|
| Baseline | 0.72 | 0.68 | 0.70 |
| Proposed | 0.89 | 0.85 | 0.87 |

### 2.4 참고문헌

[1] OWASP, "Top 10 for LLM Applications 2025," 2024.
[2] Greshake et al., "Not what you've signed up for," arXiv:2302.12173, 2023.

## 3. 권한

- **1저자(author)**: 전체 수정 권한
- **공저자(authors)**: 수정 가능, PR 통해 협업
- **기타**: 읽기만 가능
- **collaborative: true**: 누구나 수정 가능
