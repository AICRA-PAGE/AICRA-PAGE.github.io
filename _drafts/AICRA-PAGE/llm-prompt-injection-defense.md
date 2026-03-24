---
layout: paper
title: "LLM Prompt Injection Defense"
author: AICRA-PAGE
authors: ["0blueteam0"]
date: 2026-03-24
status: published
domain: "LLM Security"
lang: ko
---

# LLM Prompt Injection Defense Framework

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
\mathcal{L}_{defense} = \mathcal{L}_{task} + \lambda \cdot \mathcal{L}_{safety}
$$

:::theorem 방어 수렴성
제안 방어 필터는 유한 쿼리 $T < \infty$ 내에서 최적 정책에 수렴한다.
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
