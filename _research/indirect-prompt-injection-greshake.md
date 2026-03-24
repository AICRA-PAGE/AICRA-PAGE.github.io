---
layout: research
title: "Indirect Prompt Injection 위협 분석"
paper_url: https://arxiv.org/abs/2302.12173
venue: "arXiv"
year: 2023
domain: [LLM Security, Prompt Injection]
scores:
  novelty: 9
  rigor: 8
  reproducibility: 7
  relevance: 10
author: AICRA
date: 2026-03-24
last_updated: 2026-03-24
---

## 요약

Greshake et al. (2023)은 LLM 통합 애플리케이션에서 간접 프롬프트 인젝션(Indirect Prompt Injection)의 위협을 체계적으로 분석한 최초의 연구이다. 외부 데이터 소스(웹페이지, 이메일, 문서)에 숨겨진 악의적 지시가 LLM의 행동을 변경할 수 있음을 실증했다.

---

## 방법론 분석

- 위협 모델을 공격자 능력에 따라 분류 (외부 콘텐츠 조작, API 접근 등)
- Bing Chat, ChatGPT Plugins 등 실제 시스템에서 공격 시연
- 정보 유출, 사기, 맬웨어 확산 등 다양한 공격 시나리오 제시

**강점**: 실제 프로덕션 시스템에서의 시연으로 실질적 위협 입증
**한계**: 정량적 성공률 측정 부재, 방어 메커니즘 분석 미흡

---

## 보안 관련성

- OWASP LLM01 (Prompt Injection)의 이론적 기반
- RAG 시스템, 에이전틱 AI에서의 간접 인젝션 경로 정의
- MCP 도구 연결 환경에서 특히 위험도가 높음

---

## 재현 가능성

논문에서 제시한 공격 시나리오는 개념적으로 재현 가능하나, 특정 시스템(Bing Chat)의 정책 변경으로 동일한 결과를 재현하기는 어려울 수 있다.

---

## AICRA 시사점

- 모든 RAG/에이전트 시스템 설계 시 간접 인젝션 방어를 기본으로 고려해야 함
- 시스템 프롬프트와 사용자 데이터의 구조적 분리가 필수
- OWASP Agentic Top 10의 ASI01(Goal Hijack)과 직접 연결

---

## 참고

- [AICRA: Prompt Injection 2026](/blog/2026/prompt-injection-2026/)
- [AICRA: OWASP LLM Top 10 2025](/blog/2025/owasp-llm-top-10-2025/)
