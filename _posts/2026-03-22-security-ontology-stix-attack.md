---
layout: post
title: "보안 데이터 표준화의 미래: STIX 2.1과 ATT&CK의 온톨로지 통합"
description: "STIX 2.1과 MITRE ATT&CK의 시맨틱 온톨로지 통합 설계 - UCO 기반 지식그래프와 자동 탐지 파이프라인"
date: 2026-03-22
last_modified_at: 2026-03-24
categories: [Research]
tags: [STIX, ATT&CK, 보안온톨로지, 지식그래프, 시맨틱보안, UCO, 위협인텔리전스]
author: AICRA
toc: true
lang: ko
thumbnail: /assets/img/posts/security-ontology.svg
---

## 한 줄 요약

STIX 2.1과 ATT&CK를 시맨틱 온톨로지로 연결하면, 위협 데이터 통합을 자동화할 수 있습니다.

---

## 왜 이 주제가 중요한가

사이버 보안 위협 대응의 복잡성이 급증하면서, 이질적인 보안 데이터를 통합하고 자동화하는 능력이 조직의 생존을 좌우합니다. 대부분의 보안팀은 MITRE ATT&CK, STIX/TAXII, OpenIOC, YARA 등 여러 형식의 위협 데이터를 다루고 있고, 이 데이터를 서로 연결하려면 상당한 수동 작업이 필요합니다.

이 글에서는 STIX 2.1과 MITRE ATT&CK를 시맨틱 온톨로지로 통합하는 방법을 다룹니다. 온톨로지 기반 접근이 어떻게 위협 정보의 상호운용성을 높이고, 지식 그래프(Knowledge Graph) 기반 자동화를 가능하게 하는지 살펴봅니다.

---

![STIX 2.1 + ATT&CK 온톨로지 통합 아키텍처](/assets/img/posts/stix-attack-ontology-architecture.svg)
*STIX 2.1과 ATT&CK를 통합 온톨로지로 연결하는 3계층 아키텍처. 인스턴스(L3) -> 표준(L2) -> 통합 온톨로지(L1) -> 자동화 출력.*

---

## 1. 보안 데이터의 스키마 분절 문제

### 1.1 현실의 표준화 위기

지난 10년간 보안 산업은 위협 정보 공유를 위한 다양한 표준을 개발했습니다:

- **STIX 1.x / 2.1**: MITRE가 초기 개발하고 OASIS CTI 위원회가 표준화한 JSON 기반 위협 정보 표현
- **TAXII**: STIX 데이터 교환을 위한 API 프로토콜
- **OpenIOC**: Mandiant의 인디케이터 형식
- **YARA**: Victor Alvarez가 개발한 패턴 매칭 기반 악성코드 탐지 규칙 언어 (VirusTotal 등에서 광범위하게 활용)
- **MITRE ATT&CK**: 위협 행동을 체계화한 프레임워크
- **Cyber Kill Chain**: Lockheed Martin의 공격 단계 모델

하지만 이 표준들 사이에는 꽤 근본적인 문제가 있습니다:

1. **의미론적 이질성(Semantic Heterogeneity)**: 같은 개념을 서로 다른 용어로 표현
   - "attack pattern" (STIX) vs "technique" (ATT&CK) vs "TTP" (일반 용어)

2. **구조적 불일치(Structural Mismatch)**: 데이터 관계의 정의가 불일치
   - STIX는 자유로운 관계(relationship) 모델링 허용
   - ATT&CK는 고정된 계층 구조(tactic → technique)

3. **표현 능력의 불균형(Expressiveness Imbalance)**: 특정 개념을 표현하는 능력 차이
   - STIX의 "malware-behavior"는 ATT&CK의 어떤 엔티티와도 정확히 매핑되지 않음

### 1.2 비즈니스 임팩트

이런 분절이 실제로 조직에 주는 손실은 생각보다 큽니다:

- **수동 맵핑 비용**: 보안 팀이 데이터 정규화와 포맷 변환에 상당한 시간을 소비
- **탐지 누락**: 통합되지 않은 위협 정보로 인한 공격 탐지 실패
- **자동화 장벽**: 이종(heterogeneous) 데이터로 인한 플레이북 자동화 불가
- **상황 인식 부족**: 위협 인텔리전스와 네트워크 감시 데이터 간의 연결 불가

### 1.3 온톨로지 접근법의 필요성

온톨로지(Ontology)는 쉽게 말해, 도메인 내의 개념과 그 관계를 체계적으로 정의해둔 "데이터의 지도"입니다:

```
온톨로지의 핵심 요소:
- 클래스(Class): 개념 범주 (e.g., "Attack", "Malware", "Vulnerability")
- 속성(Property): 개념의 특성 (e.g., "targetedSystem", "attackVector")
- 제약(Constraint): 관계와 속성의 유효성 규칙
- 개체(Instance): 실제 위협 사건 (e.g., "APT28의 2024년 3월 러시아 작전")
```

온톨로지 기반 접근은 다음을 가능하게 합니다:

1. **의미 통합(Semantic Integration)**: "기술(technique)"과 "공격 패턴(attack pattern)"이 같은 개념임을 기계가 이해
2. **지식 추론(Knowledge Inference)**: "X 그룹이 technique Y를 사용 → Y를 사용하는 모든 공격 탐지"
3. **표현 확장(Expressiveness Extension)**: 새로운 관계와 개념 추가 가능

---

## 2. STIX 2.1과 ATT&CK의 관계

### 2.1 STIX 2.1의 구조와 개념

STIX 2.1은 위협 정보의 표현을 위한 JSON 기반 표준입니다:

**STIX Domain Objects (SDOs):**

| SDO 타입 | 설명 | 예시 |
|---------|------|------|
| Attack-Pattern | 공격 기법의 설명 | T1021.001 (RDP를 통한 원격 접근) |
| Campaign | 특정 목표를 가진 공격 집합 | "Operation Stealth" |
| Course-of-Action | 공격 완화 방법 | "MFA 도입" |
| Identity | 개인, 조직, 시스템 | "ACME Corp.", "Jane Doe" |
| Indicator | 타협 인디케이터 | IP, 해시, 도메인, 정규표현식 |
| Malware | 악성코드 분류 | "Emotet", "WannaCry" |
| Threat-Actor | 위협 주체 | "APT28", "Lazarus Group" |
| Tool | 공격 도구 | "Mimikatz", "Cobalt Strike" |
| Vulnerability | CVE 기반 취약점 | "CVE-2024-3094" |
| X-Custom | 확장 객체 | 도메인 특화 데이터 |

**STIX Relationship Objects (SROs):**

```json
{
  "type": "relationship",
  "id": "relationship--...",
  "created": "2026-03-22T00:00:00.000Z",
  "modified": "2026-03-22T00:00:00.000Z",
  "relationship_type": "uses",
  "source_ref": "threat-actor--apt28",
  "target_ref": "attack-pattern--t1021"
}
```

### 2.2 ATT&CK 프레임워크의 계층 구조

MITRE ATT&CK는 위협 행동을 체계적으로 분류하는 프레임워크입니다:

```
Tactic (전술): 공격의 목적
  ├─ Tactic: Initial Access (초기 침입)
  ├─ Tactic: Execution (실행)
  ├─ Tactic: Persistence (유지)
  └─ ...

Technique (기법): 목표 달성 방법 (T1566)
  ├─ Sub-technique (부기법): T1566.001 (피싱 - 첨부 파일)
  ├─ Sub-technique: T1566.002 (피싱 - 링크)
  └─ Sub-technique: T1566.003 (피싱 - 클라우드 저장소)

Procedure (절차): 실제 사용된 구현
  └─ APT28이 2024년 3월 러시아 공격에서 T1566.001을 사용
```

### 2.3 STIX ↔ ATT&CK 매핑 모델

STIX와 ATT&CK를 통합하는 논리적 맵핑:

```
STIX attack-pattern (T1021) ─── 동등성(sameAs) ─── ATT&CK Technique (T1021)
        │
        ├─── 실행(uses) ─── STIX malware (Emotet)
        ├─── 우회(bypasses) ─── STIX course-of-action
        └─── 탐지(detects) ─── STIX indicator (네트워크 시그니처)

STIX threat-actor (APT28) ─── 귀속(attributed-to) ─── STIX identity
        │
        ├─── 사용(uses) ─── ATT&CK Technique (T1048)
        ├─── 공격(targets) ─── STIX identity (특정 산업)
        └─── 캠페인(campaigns) ─── STIX campaign
```

**문제점**: 이 매핑은 정적(static)이며, ATT&CK 업데이트나 새로운 기법 추가 시 수동 갱신이 필요합니다.

### 2.4 실제 STIX 2.1 Bundle 예시

실제로 STIX 2.1 데이터가 어떻게 생겼는지 보면 이해가 빠릅니다. MITRE에서 공개하는 [ATT&CK STIX 데이터](https://github.com/mitre/cti)를 보면, 각 기법이 STIX Attack-Pattern 객체로 표현됩니다:

```json
{
  "type": "bundle",
  "id": "bundle--example-apt28",
  "objects": [
    {
      "type": "threat-actor",
      "id": "threat-actor--bef4c620-0787-42a8-a96d-b7eb6e85917c",
      "name": "APT28",
      "aliases": ["Fancy Bear", "Sofacy", "Pawn Storm"],
      "description": "러시아 GRU 소속으로 추정되는 사이버 스파이 그룹",
      "threat_actor_types": ["nation-state"],
      "first_seen": "2004-01-01T00:00:00Z"
    },
    {
      "type": "attack-pattern",
      "id": "attack-pattern--2b742742-28c3-4e1b-bab7-8350d6300fa7",
      "name": "Spearphishing Attachment",
      "external_references": [
        {
          "source_name": "mitre-attack",
          "external_id": "T1566.001",
          "url": "https://attack.mitre.org/techniques/T1566/001/"
        }
      ]
    },
    {
      "type": "relationship",
      "id": "relationship--example-001",
      "relationship_type": "uses",
      "source_ref": "threat-actor--bef4c620-0787-42a8-a96d-b7eb6e85917c",
      "target_ref": "attack-pattern--2b742742-28c3-4e1b-bab7-8350d6300fa7",
      "description": "APT28은 스피어피싱 첨부파일을 통한 초기 침입에 주로 의존"
    }
  ]
}
```

이렇게 STIX Bundle 하나에 위협 행위자, 공격 기법, 그리고 둘 간의 관계가 구조화되어 담깁니다. 문제는 이 데이터만으로는 "APT28이 이 기법을 사용해서 어떤 조직을 공격했고, 어떤 방어 조치가 효과적이었는지"를 한 번에 파악하기 어렵다는 것입니다. 이것이 온톨로지 통합이 필요한 이유입니다.

#### Python stix2 라이브러리로 STIX 2.1 Bundle 생성하기

위의 JSON을 수동으로 작성하는 것은 번거롭고 오류가 발생하기 쉽습니다. Python의 `stix2` 라이브러리를 사용하면 프로그래밍 방식으로 유효한 STIX 객체를 생성할 수 있습니다:

```python
# pip install stix2
from stix2 import (
    ThreatActor, AttackPattern, Relationship,
    Bundle, ExternalReference, Indicator, Malware
)
from datetime import datetime

# 1. 위협 행위자 정의
apt28 = ThreatActor(
    name="APT28",
    aliases=["Fancy Bear", "Sofacy", "Pawn Storm"],
    description="러시아 GRU 소속으로 추정되는 사이버 스파이 그룹",
    threat_actor_types=["nation-state"],
    first_seen="2004-01-01T00:00:00Z",
    resource_level="government",
    primary_motivation="espionage",
    sophistication="expert"
)

# 2. ATT&CK 기법을 STIX Attack-Pattern으로 표현
spearphishing = AttackPattern(
    name="Spearphishing Attachment",
    description="악성 첨부파일이 포함된 표적 피싱 이메일을 전송",
    external_references=[
        ExternalReference(
            source_name="mitre-attack",
            external_id="T1566.001",
            url="https://attack.mitre.org/techniques/T1566/001/"
        )
    ]
)

powershell_exec = AttackPattern(
    name="PowerShell",
    description="PowerShell을 사용하여 명령 및 스크립트를 실행",
    external_references=[
        ExternalReference(
            source_name="mitre-attack",
            external_id="T1059.001",
            url="https://attack.mitre.org/techniques/T1059/001/"
        )
    ]
)

# 3. 악성코드 정의
sofacy_malware = Malware(
    name="Sofacy",
    description="APT28이 사용하는 모듈형 백도어",
    malware_types=["backdoor", "trojan"],
    is_family=True
)

# 4. 인디케이터 (IOC) 정의
ioc_hash = Indicator(
    name="Sofacy dropper SHA-256",
    description="Sofacy 악성코드 드로퍼의 파일 해시",
    pattern="[file:hashes.'SHA-256' = 'a1b2c3d4e5f6...']",
    pattern_type="stix",
    valid_from=datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
    indicator_types=["malicious-activity"]
)

# 5. 관계 설정
rel_uses_phishing = Relationship(
    source_ref=apt28.id,
    target_ref=spearphishing.id,
    relationship_type="uses",
    description="APT28은 스피어피싱 첨부파일을 통한 초기 침입에 주로 의존"
)

rel_uses_ps = Relationship(
    source_ref=apt28.id,
    target_ref=powershell_exec.id,
    relationship_type="uses",
    description="APT28은 PowerShell을 후속 명령 실행에 활용"
)

rel_deploys = Relationship(
    source_ref=apt28.id,
    target_ref=sofacy_malware.id,
    relationship_type="uses",
    description="APT28은 Sofacy 백도어를 지속성 확보에 배포"
)

rel_indicates = Relationship(
    source_ref=ioc_hash.id,
    target_ref=sofacy_malware.id,
    relationship_type="indicates"
)

# 6. Bundle로 묶기
bundle = Bundle(
    objects=[
        apt28, spearphishing, powershell_exec,
        sofacy_malware, ioc_hash,
        rel_uses_phishing, rel_uses_ps,
        rel_deploys, rel_indicates
    ]
)

# 7. JSON 직렬화 및 저장
print(bundle.serialize(pretty=True))

# 파일로 저장
with open("apt28-threat-bundle.json", "w") as f:
    f.write(bundle.serialize(pretty=True))

print(f"[+] Bundle 생성 완료: {len(bundle.objects)}개 객체")
print(f"[+] Bundle ID: {bundle.id}")
```

이 코드를 실행하면 STIX 2.1 규격에 맞는 완전한 Bundle JSON이 생성됩니다. `stix2` 라이브러리가 ID 자동 생성, 타임스탬프 관리, 스키마 검증을 모두 처리하므로 수동 JSON 작성보다 훨씬 안전합니다.

### 2.5 ATT&CK Navigator와의 연동

ATT&CK Navigator는 MITRE ATT&CK 데이터를 시각적으로 표현하고 조작할 수 있는 웹 기반 도구입니다. 조직은 Navigator를 통해 자신의 환경에서 관찰된 공격 기법을 매핑하고, 방어 전략을 계획할 수 있습니다.

```json
{
  "techniques": [
    {
      "techniqueID": "T1078",
      "techniqueName": "Valid Accounts",
      "comment": "Observed in recent incident"
    },
    {
      "techniqueID": "T1566",
      "techniqueName": "Phishing",
      "comment": "Email-based vector"
    }
  ]
}
```

### 2.6 MITRE ATLAS와 AI 특화 위협 분류

MITRE ATLAS(Adversarial Threat Landscape for Artificial-Intelligence Systems)는 AI 시스템을 대상으로 하는 고유한 위협 기법을 분류합니다. 기존 ATT&CK 프레임워크는 일반적인 IT 보안에 초점을 맞추고 있으나, ATLAS는 머신러닝 모델, 학습 데이터, 추론 파이프라인 등 AI 특화 공격 벡터를 다룹니다.

주요 ATLAS 기법 ID와 설명:

- **AML.T0051.000 (Direct LLM Prompt Injection)**: 공격자가 LLM에 직접적인 프롬프트 주입 공격을 수행하여 의도하지 않은 명령을 실행하도록 유도합니다.
- **AML.T0051.001 (Indirect LLM Prompt Injection)**: 외부 데이터 소스를 통해 간접적으로 프롬프트를 주입합니다.
- **AML.T0018 (Backdoor ML Model)**: 모델 개발 또는 학습 과정에서 백도어를 심어 특정 입력에 대해 공격자가 의도한 결과를 생성합니다.
- **AML.T0054 (LLM Jailbreak)**: LLM의 안전 장치와 콘텐츠 필터를 우회하여 제한된 콘텐츠 생성을 강제합니다.
- **AML.T0020 (Poison Training Data)**: 모델 학습에 사용되는 데이터셋에 악의적인 데이터를 주입합니다.

---

## 3. 온톨로지 계층 설계

### 3.1 온톨로지 통합 모델 (UCO 참조)

> **참고**: Unified Cyber Ontology(UCO)는 원래 CASE(Cyber-investigation Analysis Standard Expression) 프로젝트의 일부로 디지털 포렌식과 사이버 수사 도메인을 위해 설계되었습니다([unifiedcyberontology.org](https://unifiedcyberontology.org/)). 여기서는 UCO의 설계 원칙을 차용하여 STIX+ATT&CK 통합에 적용하는 확장 모델을 다룹니다.

이 통합 모델은 STIX, ATT&CK, 표준 네트워크 데이터를 연결하는 상위 온톨로지 역할을 합니다:

```
UCO 최상위 클래스:
├─ SecurityEntity (보안 엔티티)
│  ├─ Actor (위협 주체) → APT, 내부자
│  ├─ Action (행동) → 기법, 절차
│  ├─ Artifact (산출물) → 파일, 네트워크 흔적
│  └─ Mitigator (완화 수단) → 보안 제어
│
├─ SecurityRelationship (관계)
│  ├─ causality (인과관계) → A는 B를 야기
│  ├─ responsibility (책임) → 주체는 행동을 실행
│  ├─ capability (역량) → 주체는 행동을 수행 가능
│  └─ mitigation (완화) → 제어는 행동을 탐지/차단
│
└─ SecurityEvent (사건)
   ├─ timestamp, location, context
   └─ links to entities and relationships
```

### 3.2 계층적 매핑 규칙

**L1 (상위 온톨로지)**: UCO 클래스 정의
```
UCO:Action ⊇ {attack-pattern, technique, procedure}
UCO:Artifact ⊇ {malware, tool, indicator}
UCO:Actor ⊇ {threat-actor, campaign, identity}
```

**L2 (표준 온톨로지)**: STIX와 ATT&CK 개념
```
STIX:attack-pattern ⊆ UCO:Action
ATT&CK:Technique ⊆ UCO:Action
STIX:malware ⊆ UCO:Artifact
```

**L3 (인스턴스 계층)**: 실제 데이터
```
Instance: APT28_RDP_2024 ∈ ATT&CK:T1021
Instance: APT28_RDP_2024 ∈ STIX:attack-pattern
Instance: APT28_RDP_2024 ∈ UCO:Action
```

### 3.3 온톨로지 확장 예시

금융 섹터 특화 온톨로지:

```
FinanceSecurityOntology ⊆ UCO
├─ FinancialActor (금융권 위협 주체)
│  └─ properties: targeted-sector="금융", avg-dwell-time="180일"
│
├─ FinancialAction (금융권 공격 기법)
│  └─ properties: impact-type="자금유출", regulatory-breach="PCI-DSS"
│
└─ FinancialMitigation (금융권 보안 제어)
   └─ properties: compliance-standard="PCI", audit-frequency="분기"
```

---

## 4. 지식 그래프 기반 탐지/자동화 파이프라인

### 4.1 아키텍처 개요

![지식 그래프 기반 APT 공격 상관분석 예시](/assets/img/posts/stix-knowledge-graph-example.svg)
*APT28의 공격 기법, 악성코드, 타겟, IOC 간의 관계를 지식 그래프로 표현한 예시. 노드 간 관계(uses, deploys, targets, indicates)와 공격 체인(attack sequence)이 시각적으로 드러난다.*

```mermaid
graph TB
    A["보안 데이터 수집<br/>(SIEM, Threat Intel, Logs)"]
    B["데이터 정규화<br/>(STIX SDOs)"]
    C["온톨로지 매핑<br/>(UCO 클래스 할당)"]
    D["지식 그래프<br/>(Neo4j/GraphDB)"]
    E["시맨틱 추론<br/>(SPARQL/규칙엔진)"]
    F["위협 상관분석<br/>(Threat Correlation)"]
    G["자동 탐지<br/>(Detection)"]
    H["플레이북 자동화<br/>(Automation)"]
    I["피드백 루프<br/>(Feedback)"]
    
    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    F --> H
    G --> I
    H --> I
    I --> D
    
    style D fill:#e1f5ff
    style E fill:#fff3e0
    style G fill:#f3e5f5
    style H fill:#e8f5e9
```

### 4.2 SPARQL 쿼리 예시

**예시 1: 특정 기법을 사용하는 모든 위협 행위자 찾기**

```sparql
PREFIX uco: <https://ontology.unifiedcyberontology.org/uco/>
PREFIX attack: <https://attack.mitre.org/ontology/>
PREFIX stix: <https://docs.oasis-open.org/cti/stix/v2.1/>

SELECT ?actor ?actor_name ?technique_id WHERE {
  ?actor a uco:ThreatActor ;
         stix:name ?actor_name ;
         uco:uses ?action .
  ?action uco:related_to attack:T1048 ;
          attack:technique_id ?technique_id .
}
ORDER BY ?actor_name
```

**예시 2: 특정 기법을 완화하는 모든 제어 조치**

```sparql
SELECT ?mitigation ?control_name ?affected_techniques WHERE {
  ?mitigation a uco:Mitigation ;
              stix:name ?control_name ;
              uco:mitigates ?technique .
  ?technique a attack:Technique ;
             attack:technique_id ?technique_id .
  
  FILTER (?technique_id = "T1021")
}
```

**예시 3: 3일 이내 관련 인디케이터가 탐지된 모든 기법**

```sparql
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT ?technique ?indicator ?last_seen WHERE {
  ?indicator a uco:Indicator ;
             uco:detected_at ?last_seen ;
             uco:indicates ?technique .
  
  BIND(NOW() - ?last_seen as ?time_diff)
  FILTER(?time_diff <= "P3D"^^xsd:duration)
}
ORDER BY DESC(?last_seen)
```

### 4.3 추론 규칙 엔진

SWRL (Semantic Web Rule Language) 기반 규칙:

```
Rule 1: 공격 상관분석
ThreatActor(?actor) ∧ uses(?actor, ?action1) ∧ uses(?actor, ?action2) 
∧ relatedTo(?action1, ?action2) → likelyCoordinated(?actor)

Rule 2: 연쇄 공격 탐지
Indicator(?ind1) ∧ Indicator(?ind2) ∧ detectsWithin(?ind1, ?ind2, 1hour)
∧ indicates(?ind1, ?action1) ∧ indicates(?ind2, ?action2) 
∧ sequence(?action1, ?action2) → chainedAttack(?ind1, ?ind2)

Rule 3: 취약성 기반 위험 예측
Actor(?actor) ∧ uses(?actor, ?technique) ∧ targets(?actor, ?system_type)
∧ exposesVulnerability(?technique, ?vuln) ∧ runsOn(?system_type, ?product)
→ predictedTarget(?actor, ?product, "high-risk")
```

### 4.4 자동화 플레이북 예시

```yaml
playbook:
  name: "APT28 RDP 기반 침입 자동 대응"
  trigger:
    - event_type: "technique_detected"
      technique_id: "T1021.001"
      actor_ioc: "APT28"
      confidence: 0.85
  
  conditions:
    - query: |
        SELECT ?affected_system WHERE {
          ?event a uco:SecurityEvent ;
                 uco:affected_asset ?affected_system ;
                 uco:confidence "0.85"^^xsd:double .
        }
  
  actions:
    - isolate_network_segment:
        systems: "${{affected_system}}"
        duration: "2 hours"
    
    - trigger_incident:
        severity: "critical"
        description: "APT28 RDP-based lateral movement detected"
    
    - block_iocs:
        ioc_type: "ip"
        query: |
          SELECT ?ioc WHERE {
            ?indicator a uco:Indicator ;
                       uco:value ?ioc ;
                       uco:indicates attack:T1021.001 ;
                       uco:confidence > 0.75 .
          }
        action: "block_for_24h"
    
    - enable_enhanced_logging:
        sources: ["RDP", "Kerberos", "DNS"]
        duration: "7 days"
```

---

## 5. 도입 시 리스크와 한계

### 5.1 기술적 리스크

**R1: 온톨로지 복잡도 증가**
- 현재: STIX + ATT&CK 각각 관리 → 기술 부채 분산
- 통합 후: 통합 온톨로지 관리 → 기술 부채 집중
- 완화: 점진적 도입 (pilot project → 팀 별 확대 → 전사)

**R2: 그래프 쿼리 성능 저하**
- 문제: 수백만 노드의 그래프에서 SPARQL 쿼리 → 수초~분단위 응답
- 예시: 100만 인디케이터 + 50만 기법 = 5천만 엣지
- 완화: 인덱싱, 캐싱, 샤딩 (Neo4j Fabric 등)

**R3: 의미론적 편향(Semantic Bias)**
- 문제: 온톨로지 설계자의 편견이 전사 분석에 영향
- 예시: "T1021"을 "lateral-movement"로만 분류 → 초기 침입 벡터로서의 용도 간과
- 완화: 다중 관점(multi-perspective) 온톨로지 설계, 정기 감사

### 5.2 운영 리스크

**R4: 데이터 품질 의존성**
- 문제: 쓰레기 입력(garbage in) → 쓰레기 출력(garbage out)
- 예시: STIX 인디케이터 신뢰도 점수가 잘못됨 → 추론 결과 왜곡
- 완화: 데이터 검증 파이프라인, 신뢰도 스코어 관리

**R5: 표준 진화 추적**
- 문제: ATT&CK는 분기마다 업데이트 → 온톨로지도 동적 갱신 필요
- 예시: ATT&CK는 분기마다 새 기법이 추가되므로(2025년 기준 ATT&CK v16) → 관련 규칙/쿼리 재검증 필요
- 완화: 자동 온톨로지 버전 관리, CI/CD 기반 검증

### 5.3 조직 리스크

**R6: 조직 간 온톨로지 불일치**
- 문제: A사의 온톨로지 ≠ B사의 온톨로지 → 위협 정보 교환 불가
- 현황: 표준 부재 → 각 조직이 독립적으로 설계
- 완화: OASIS/MITRE 주도 표준화, 참조 온톨로지(reference ontology) 준수

**R7: 법규 준수 이슈**
- 문제: GDPR, CCPA 등에서 개인정보 포함된 지식 그래프 저장 제약
- 예시: 사용자 행동 기반 이상 탐지 → 개인정보 처리 필요
- 완화: PII 마스킹, 데이터 거버넌스 정책 수립

### 5.4 한계와 현실적 제약

| 문제 | 원인 | 현실적 대안 |
|------|------|-----------|
| 온톨로지 유지보수 비용 | 전문가 부족 | 오픈소스 온톨로지 활용, 커뮤니티 참여 |
| 기존 시스템 통합 곤란 | API 불일치 | 마이크로서비스 아키텍처, 어댑터 개발 |
| 의사결정 시간 증가 | 복잡한 쿼리 | 미리 정의된 대시보드, 간소화된 인터페이스 |
| 보안 전문가 학습곡선 | 시맨틱 웹 기술 낮은 인지도 | 내부 교육, 클라우드 기반 SaaS 솔루션 활용 |

### 5.5 도구 비교: 어떤 그래프 DB를 선택할 것인가

온톨로지 기반 분석을 위한 그래프 데이터베이스 선택은 조직 규모와 요구사항에 따라 달라집니다:

| 도구 | 라이선스 | SPARQL 지원 | 규모 적합성 | 학습곡선 | 보안 업계 사용 사례 |
|------|---------|------------|-----------|---------|-------------------|
| **Neo4j** | Community/Enterprise | 플러그인 (neosemantics) | 중~대 | 중간 (Cypher 언어) | Palo Alto Unit 42, 다수 CTI 팀 |
| **Amazon Neptune** | AWS 관리형 | 네이티브 | 대 | 낮음 (관리형) | 클라우드 기반 SOC |
| **Apache Jena Fuseki** | Apache 2.0 | 네이티브 | 소~중 | 높음 | 학술/연구 기관 |
| **Stardog** | 상용 | 네이티브 | 중~대 | 중간 | 정부/방산 CTI |
| **Dgraph** | Apache 2.0 | GraphQL (변환 필요) | 대 | 중간 | 신생 보안 스타트업 |

**권장**: 처음 시작한다면 Neo4j Community + neosemantics 플러그인이 가장 현실적입니다. 커뮤니티가 크고, Cypher 쿼리 언어가 SPARQL보다 진입장벽이 낮으며, STIX 데이터를 직접 가져오는 도구([stix2neo4j](https://github.com/LiamSaliba/stix2neo4j))가 오픈소스로 존재합니다.

### 5.6 보안 온톨로지의 글로벌 동향

온톨로지 기반 위협 분석은 더 이상 학술적 아이디어가 아닙니다:

- **MITRE**: ATT&CK 데이터를 [STIX 2.1 형식으로 공식 배포](https://github.com/mitre/cti) 중. 사실상 표준 데이터 소스.
- **OASIS**: STIX 2.1에 이어 STIX 2.2 작업 진행 중. 그래프 기반 표현 강화 방향.
- **EU ENISA**: 유럽 사이버보안청이 CTI 표준화 가이드라인에서 STIX+ATT&CK 통합 권장.
- **미국 CISA**: 국토안보부 산하 기관이 STIX 기반 위협 정보 공유 플랫폼(AIS) 운영 중.
- **한국 KISA**: 국내에서도 C-TAS(Cyber Threat Analysis and Sharing) 시스템을 통해 STIX 형식의 위협 정보를 공유하고 있으나, 온톨로지 통합은 아직 초기 단계.

### 5.7 자주 묻는 질문 (FAQ)

**Q: 소규모 보안 팀(5명)인데, 지식 그래프까지 도입할 여력이 있을까요?**

A: 솔직히, 5명 규모에서 완전한 온톨로지 시스템은 과할 수 있습니다. 하지만 Level 1-2(STIX 표준 채택 + ATT&CK 태깅)만으로도 상당한 효과가 있습니다. MITRE가 제공하는 STIX 형식의 ATT&CK 데이터를 그대로 활용하면 별도 온톨로지 구축 없이도 기법 간 관계를 파악할 수 있습니다.

**Q: 기존 SIEM(Splunk, Elastic)과 충돌하지 않나요?**

A: 충돌하지 않습니다. 그래프 DB는 SIEM을 대체하는 것이 아니라 보완합니다. SIEM은 실시간 로그 수집과 알림에 강하고, 그래프 DB는 장기적인 위협 상관분석과 APT 귀속에 강합니다. 실제로 많은 팀이 Splunk에서 탐지한 이벤트를 Neo4j로 보내 상관분석하는 파이프라인을 구축합니다.

**Q: SPARQL을 꼭 배워야 하나요?**

A: 아닙니다. Neo4j를 사용한다면 Cypher 쿼리 언어가 더 직관적입니다. SPARQL은 RDF 기반 순수 시맨틱 웹 접근에 필요하고, 실무에서는 Cypher나 Gremlin 같은 프로퍼티 그래프 쿼리 언어가 더 보편적입니다. 어떤 쿼리 언어든 핵심은 "노드와 엣지 사이의 패턴 매칭"이라는 같은 개념입니다.

**Q: ATT&CK가 업데이트되면 온톨로지도 다시 만들어야 하나요?**

A: MITRE가 STIX 형식으로 ATT&CK를 배포하므로, 업데이트 시 새 STIX Bundle을 그래프 DB에 import하면 됩니다. 온톨로지 스키마 자체를 변경할 필요는 거의 없고, 인스턴스(데이터) 레벨에서 추가/수정만 하면 됩니다.

**Q: STIX와 ATT&CK 온톨로지 통합이 AI/ML 기반 위협 탐지와 어떻게 시너지를 내나요?**

A: 지식 그래프는 그래프 신경망(GNN)의 이상적인 입력 데이터 구조입니다. 노드(위협 행위자, 기법, 인디케이터)와 엣지(관계)로 이루어진 그래프를 GNN에 학습시키면, 기존 규칙 기반으로는 탐지하기 어려운 잠재적 위협 패턴을 발견할 수 있습니다. 예를 들어, 특정 기법 조합이 새로운 APT 그룹의 등장을 시사하거나, 아직 관찰되지 않은 기법이 특정 공격 체인에서 사용될 가능성을 예측할 수 있습니다. 실제로 Neo4j의 Graph Data Science 라이브러리나 PyTorch Geometric을 사용하면 그래프 임베딩 기반 이상 탐지를 비교적 빠르게 프로토타이핑할 수 있습니다.

---

## 6. 도입 시 정리 및 제언

### 6.1 단계별 도입 로드맵

**단기: 파일럿 프로젝트**
- 목표: 제한된 범위에서 개념 검증
- 범위: 특정 APT 그룹 3개 + 기법 100개
- 도구: Neo4j Community, SPARQL 쿼리 엔진
- 성과 지표: 수동 맵핑 작업 감소 여부 측정

**중기: 팀 레벨 도입**
- 목표: 보안 분석 팀 전체에서 활용 가능
- 범위: 국내 위협 인텔리전스 + 모든 기법
- 도구: Neo4j Enterprise, 자동화 플레이북
- 성과 목표(예시): 탐지 정확도 15% 증가, 거짓 긍정률 20% 감소 (조직 환경에 따라 상이)

**장기: 전사 통합**
- 목표: SIEM, EDR, 네트워크 방어 시스템 연동
- 범위: 전국내 위협 정보 + 모든 방어 제어
- 도구: GraphDB, Kubernetes 기반 마이크로서비스
- 성과 목표(예시): 평균 탐지 시간(MTTD) 50% 단축, 자동화 비율 60% 달성 (업계 벤치마크 기반 목표치)

### 6.2 기술 스택 추천

```
인프라:
├─ GraphDB: Neo4j Enterprise (프로덕션급 그래프 DB)
├─ 쿼리 엔진: Apache Jena (SPARQL 3.1 지원)
└─ 룰 엔진: SWRL + Jess (복잡한 추론)

데이터 통합:
├─ ETL: Apache Airflow (STIX 정규화)
├─ 메시지 큐: Apache Kafka (실시간 이벤트)
└─ API: GraphQL + REST (다양한 클라이언트 지원)

분석:
├─ 시맨틱 추론: Apache Jena + OWL 2 (W3C 표준 온톨로지 추론)
├─ 기계학습: TensorFlow GNN (그래프 신경망)
└─ 시각화: Gephi + D3.js (그래프 시각화)
```

### 6.3 거버넌스 및 표준화

**온톨로지 거버넌스 위원회**
- 구성: 보안팀장, 데이터분석팀장, 아키텍처팀장, 외부 전문가 1명
- 역할: 월 1회 온톨로지 검토, 변경 승인, 상호운용성 감시
- 책임: AICRA 참조 온톨로지와의 일관성 유지

**데이터 품질 SLA**
```
인디케이터:
├─ 신뢰도 점수: 자동 재평가 (주간)
├─ 유효성 검증: 30일 이상 미탐지 시 서서히 하강
└─ 폐기 정책: 90일 미탐지 → 아카이브

기법 매핑:
├─ ATT&CK 업데이트 반영: 48시간 내
├─ 내부 기법 추가: 기술팀 검토 후 7일 내
└─ 버전 관리: semantic versioning (v1.2.3)
```

---

## 7. 결론 및 정리 및 제언

### 7.1 핵심 메시지

사이버 위협 대응은 이제 개별 인디케이터를 하나씩 처리하는 수준을 넘어섰습니다. **지식 그래프 기반 시맨틱 분석**이 가져다주는 실질적인 변화는 다음과 같습니다:

1. **자동화된 위협 상관분석**: 수백 개의 산발적 인디케이터 → 통합된 공격 시나리오
2. **예측적 방어**: 알려지지 않은 공격 기법 추론 → 사전 방어 조치
3. **분석 효율화**: 수동 데이터 정규화 작업 대폭 감소 -> 고차원적 위협 분석에 집중

### 7.2 제언

한국 사이버 보안 산업이 이 방향으로 나아가려면 몇 가지가 필요합니다:

**1. 표준화 주도**
- OASIS STIX 위원회에 한국 조직 대표 참여
- MITRE ATT&CK Enterprise 버전에 K-APT 기법 추가 요청
- 한국 금융권, 에너지, 통신 특화 온톨로지 개발 주도

**2. 오픈소스 생태계 조성**
- 한국 오픈소스 지식 그래프 프로젝트 개시 (시작 예산: 5억 원)
- 학계-산업 협력 연구팀 구성 (KAIST, POSTECH, 주요 보안사)
- GitHub 상의 한국어 STIX/ATT&CK 튜토리얼 및 예제 코드 공개

**3. 인력 양성**
- 대학원 레벨 "지식 그래프 기반 사이버 위협 분석" 강좌 개발
- 기업 보안팀 대상 실무 교육 프로그램 (지식 그래프 기반 위협 분석 워크숍)
- 초급자 대상 온라인 교육 플랫폼 무료 공개

**4. 정책 제안**
- 정부 사이버안보 전략에 "시맨틱 위협 인텔리전스 표준화" 포함
- 관계부처와 협력하여 통합 위협 정보 플랫폼 구축 (국무조정실 주도)
- K-ISMS 인증기준에 온톨로지 기반 분석 능력 추가

### 7.3 기대효과

- **조직 레벨**: 위협 상관분석 자동화로 수동 데이터 정규화 작업 대폭 감소, 고차원 위협 분석에 집중 가능
- **산업 레벨**: 표준화된 온톨로지를 통해 보안 벤더/ISAC 간 위협 정보 교환 효율 향상
- **국가 레벨**: 글로벌 CTI(Cyber Threat Intelligence) 공유 네트워크에 한국 기여도 증가

---

## 8. 실무 도입 체크리스트

온톨로지 기반 위협 분석 도입을 검토하는 팀을 위한 체크리스트입니다:

### 사전 준비

- [ ] 현재 사용 중인 위협 데이터 포맷 목록 정리 (STIX, YARA, OpenIOC, 자체 포맷 등)
- [ ] 보안 팀의 데이터 정규화에 투입되는 시간 측정 (도입 전 baseline)
- [ ] 기존 SIEM/SOAR에서 ATT&CK 기법 태깅이 되어 있는지 확인
- [ ] 그래프 데이터베이스 운영 경험이 있는 인력 유무 파악
- [ ] 조직의 위협 인텔리전스 성숙도 자가 평가 (CREST CTI Maturity Model 기준)
- [ ] 내부 이해관계자(SOC, IR팀, CISO) 대상 온톨로지 기반 분석 필요성 브리핑

### 파일럿 프로젝트 (1-3개월)

- [ ] 범위 설정: 특정 APT 그룹 3-5개 + 관련 기법 50-100개
- [ ] Neo4j Community Edition 또는 Amazon Neptune 환경 구성
- [ ] Python stix2 + mitreattack-python 라이브러리 설치 및 기본 스크립트 작성
- [ ] STIX 2.1 데이터를 그래프 노드/엣지로 변환하는 ETL 파이프라인 구축
- [ ] ATT&CK Navigator와 연동하여 기법 커버리지 시각화
- [ ] 기본 SPARQL/Cypher 쿼리 5-10개 작성하여 위협 상관분석 가능성 검증
- [ ] 방어 커버리지 공백(gap) 분석 최초 실시 및 결과 리포트 작성

### 확장 (3-12개월)

- [ ] 실시간 이벤트 스트리밍 연결 (Kafka/Logstash -> 그래프 DB)
- [ ] SOAR 플레이북에 그래프 쿼리 기반 의사결정 통합
- [ ] 온톨로지 변경 관리 프로세스 수립 (ATT&CK 업데이트 반영 등)
- [ ] 팀 교육 및 대시보드 구축
- [ ] STIX-ATT&CK 교차 참조 자동화 파이프라인 운영 안정화
- [ ] GNN 기반 이상 탐지 프로토타입 개발 및 평가
- [ ] 외부 ISAC/ISAO와 TAXII 기반 자동 위협 정보 교환 체계 구축

---

## 9. 실제 적용 사례: APT 그룹 추적에 지식 그래프 활용하기

이론만으로는 감이 안 올 수 있습니다. 가상의 시나리오를 통해 실무에서 어떻게 쓰이는지 살펴보겠습니다.

### 시나리오: 금융권 대상 APT 공격 분석

어느 국내 금융기관의 보안 모니터링 시스템에서 다음과 같은 이벤트가 순차적으로 탐지되었다고 가정합니다:

1. 월요일 오전: 스피어 피싱 이메일 탐지 (첨부 파일 .hwp)
2. 월요일 오후: 내부 서버에서 비정상적인 PowerShell 실행 로그
3. 화요일: 외부 C2 서버와의 암호화된 통신 패턴 감지
4. 수요일: 내부 DB 서버에 비인가 접근 시도

기존 방식에서는 이 4개 이벤트가 각각 별도의 알림으로 처리됩니다. 하지만 지식 그래프에서는:

```mermaid
graph LR
    A["스피어 피싱<br/>T1566.001"] -->|"다음 단계"| B["PowerShell 실행<br/>T1059.001"]
    B -->|"연결"| C["C2 통신<br/>T1071.001"]
    C -->|"목표"| D["DB 접근<br/>T1078"]

    E["APT38<br/>(금융 특화)"] -.->|"사용 이력"| A
    E -.->|"사용 이력"| B
    E -.->|"사용 이력"| C

    style E fill:#ff9999
    style D fill:#ffcc99
```

SPARQL 쿼리 한 줄로 이 연결이 드러납니다:

```sparql
SELECT ?actor ?technique_chain WHERE {
  ?event1 a uco:SecurityEvent ; uco:technique attack:T1566_001 .
  ?event2 a uco:SecurityEvent ; uco:technique attack:T1059_001 .
  ?event3 a uco:SecurityEvent ; uco:technique attack:T1071_001 .
  ?actor a uco:ThreatActor ; uco:uses attack:T1566_001 ; uco:uses attack:T1059_001 .
  BIND(CONCAT(STR(?event1), " -> ", STR(?event2), " -> ", STR(?event3)) AS ?technique_chain)
}
```

이렇게 하면 개별 알림이 아닌 **"APT38 스타일의 금융권 대상 다단계 공격"**이라는 통합 시나리오로 즉시 판단할 수 있습니다.

### 기존 접근 vs 온톨로지 접근 비교

| 항목 | 기존 SIEM 규칙 기반 | 온톨로지/지식 그래프 기반 |
|------|-------------------|----------------------|
| 이벤트 상관 | 수동 또는 단순 시간 기반 | 시맨틱 관계 기반 자동 상관 |
| APT 귀속 | 분석관 경험에 의존 | 기법 패턴 자동 매칭 |
| 새로운 공격 패턴 | 규칙 추가 필요 | 추론 엔진이 유사 패턴 자동 탐지 |
| 팀 간 공유 | 리포트/이메일 | 그래프 쿼리 결과 공유 |
| 컨텍스트 유지 | 티켓별 분절 | 지식 그래프에 누적 |

---

## 10. 온톨로지 통합의 현실적 어려움과 대안

솔직히 말해서, 완전한 시맨틱 온톨로지 도입은 쉽지 않습니다. 현실적인 장벽과 대안을 정리합니다.

### 현실적 장벽

**1. 인력 문제**: OWL, SPARQL, 그래프 DB를 다룰 수 있는 보안 연구자/엔지니어가 드뭅니다. 대부분의 보안 팀은 Splunk SPL이나 KQL에 익숙하지, SPARQL은 처음 접합니다.

**2. 투자 대비 효과 불확실**: 소규모 조직에서 수백만 원을 들여 그래프 DB를 구축해도, 처리할 위협 데이터 양이 적으면 기존 SIEM으로 충분합니다.

**3. 표준 성숙도**: STIX 2.1은 비교적 안정적이지만, 온톨로지 계층의 표준(UCO 등)은 아직 성숙 단계에 있으며 도구 지원이 제한적입니다.

### 현실적 대안: 단계적 접근

완전한 온톨로지 대신, 다음과 같은 단계적 접근을 권장합니다:

```mermaid
graph TB
    A["Level 1: STIX 2.1 표준 채택<br/>(데이터 포맷 통일)"] --> B["Level 2: ATT&CK 태깅 자동화<br/>(기법 분류 체계화)"]
    B --> C["Level 3: 그래프 DB 파일럿<br/>(핵심 관계만 모델링)"]
    C --> D["Level 4: 추론 엔진 도입<br/>(자동 상관분석)"]
    D --> E["Level 5: 완전 온톨로지 통합<br/>(시맨틱 자동화)"]

    style A fill:#e8f5e9
    style B fill:#e8f5e9
    style C fill:#fff3e0
    style D fill:#fff3e0
    style E fill:#fce4ec
```

Level 1-2만 해도 상당한 효과를 볼 수 있고, 대부분의 조직은 여기서 시작하는 것이 현실적입니다.

---

## 11. 5분 만에 시작하기: STIX + Neo4j 실습

직접 해보고 싶은 분을 위한 빠른 시작 가이드입니다.

### 환경 준비

```bash
# Neo4j Community Edition (Docker)
docker run -d \
  --name neo4j-cti \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password123 \
  -e NEO4J_PLUGINS='["apoc", "n10s"]' \
  neo4j:5-community

# neosemantics (n10s) 플러그인이 STIX -> Neo4j 변환을 지원
```

### MITRE ATT&CK STIX 데이터 가져오기

```cypher
// Neo4j Browser (http://localhost:7474)에서 실행

// 1. n10s 초기화
CALL n10s.graphconfig.init();

// 2. MITRE ATT&CK Enterprise STIX 데이터 로드
CALL n10s.rdf.import.fetch(
  "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json",
  "JSON-LD"
);

// 3. 특정 APT 그룹이 사용하는 기법 조회
MATCH (actor:ThreatActor)-[:uses]->(technique:AttackPattern)
WHERE actor.name CONTAINS "APT28"
RETURN actor.name, technique.name, technique.external_id
ORDER BY technique.external_id;
```

### 실행 결과 예시

```
+--------------------------------------------------+
| actor.name | technique.name        | external_id |
+--------------------------------------------------+
| APT28      | Spearphishing Attach. | T1566.001   |
| APT28      | PowerShell            | T1059.001   |
| APT28      | Remote Desktop Proto. | T1021.001   |
| APT28      | Web Protocols         | T1071.001   |
+--------------------------------------------------+
```

이 간단한 쿼리만으로도 특정 위협 그룹의 기법 프로필을 즉시 파악할 수 있습니다. 여기에 조직의 방어 커버리지 데이터를 겹치면 **방어 공백(gap) 분석**이 자동화됩니다.

### 다음 단계

1. 조직의 SIEM 알림 데이터를 STIX Indicator로 변환
2. Neo4j에 import하여 ATT&CK 기법과 연결
3. 패턴 매칭으로 유사 APT 그룹 자동 식별
4. Cypher 쿼리를 SOAR 플레이북에 통합

---

## 12. Python으로 ATT&CK 기법 조회 및 STIX 교차 분석

실무에서 가장 자주 수행하는 작업은 ATT&CK 기법을 프로그래밍 방식으로 조회하고, STIX 데이터와 교차 참조하는 것입니다. 이 섹션에서는 Python `mitreattack-python`과 `stix2` 라이브러리를 결합한 실용적인 코드를 다룹니다.

### 12.1 ATT&CK 기법 조회 및 매핑

MITRE에서 공식 제공하는 `mitreattack-python` 라이브러리를 사용하면 ATT&CK Enterprise 매트릭스의 기법, 그룹, 소프트웨어 정보를 프로그래밍 방식으로 조회할 수 있습니다:

```python
# pip install mitreattack-python stix2
from mitreattack.stix20 import MitreAttackData
import json

# MITRE ATT&CK STIX 데이터 로드 (로컬 또는 원격)
# 최초 실행 시 다운로드: https://github.com/mitre/cti
attack_data = MitreAttackData("enterprise-attack.json")

# --- 기법 조회 ---

# 특정 기법 ID로 조회
technique = attack_data.get_object_by_attack_id(
    "T1566.001", "attack-pattern"
)
print(f"기법명: {technique['name']}")
print(f"설명: {technique['description'][:100]}...")

# 특정 전술(Tactic)에 속하는 모든 기법 조회
initial_access_techniques = attack_data.get_techniques_by_tactic(
    "initial-access", "enterprise-attack"
)
print(f"\n[Initial Access] 전술의 기법 수: {len(initial_access_techniques)}")
for tech in initial_access_techniques[:5]:
    ext_refs = tech.get("external_references", [])
    tech_id = next(
        (r["external_id"] for r in ext_refs
         if r.get("source_name") == "mitre-attack"), "N/A"
    )
    print(f"  - {tech_id}: {tech['name']}")

# --- 그룹(위협 행위자) 분석 ---

# 특정 그룹이 사용하는 모든 기법 조회
groups = attack_data.get_groups()
apt28_group = next(
    (g for g in groups if "APT28" in g.get("name", "")), None
)

if apt28_group:
    techniques_used = attack_data.get_techniques_used_by_group(
        apt28_group["id"]
    )
    print(f"\nAPT28이 사용하는 기법 수: {len(techniques_used)}")
    for entry in techniques_used[:10]:
        tech = entry["object"]
        ext_refs = tech.get("external_references", [])
        tech_id = next(
            (r["external_id"] for r in ext_refs
             if r.get("source_name") == "mitre-attack"), "N/A"
        )
        print(f"  - {tech_id}: {tech['name']}")

# --- 완화 조치 매핑 ---

# 특정 기법에 대한 완화 조치 조회
mitigations = attack_data.get_mitigations_mitigating_technique(
    technique["id"]
)
print(f"\nT1566.001 완화 조치:")
for m in mitigations:
    mitigation = m["object"]
    print(f"  - {mitigation['name']}: {mitigation.get('description', '')[:80]}...")
```

### 12.2 STIX-ATT&CK 교차 참조 쿼리

조직의 STIX 위협 인텔리전스 데이터와 ATT&CK 프레임워크를 교차 참조하면, 수집된 IOC가 어떤 공격 기법/그룹과 연관되는지 자동으로 파악할 수 있습니다:

```python
# pip install stix2 mitreattack-python requests
from stix2 import MemoryStore, Filter
from mitreattack.stix20 import MitreAttackData
import json

class STIXAttackCrossRef:
    """STIX 위협 인텔리전스와 ATT&CK 교차 참조 엔진"""

    def __init__(self, attack_data_path="enterprise-attack.json"):
        # ATT&CK STIX 데이터 로드
        self.attack = MitreAttackData(attack_data_path)

        # ATT&CK 데이터를 MemoryStore에도 로드 (STIX 쿼리용)
        with open(attack_data_path, "r") as f:
            attack_bundle = json.load(f)
        self.attack_store = MemoryStore(
            stix_data=attack_bundle["objects"]
        )

    def find_techniques_by_indicator(self, indicator_pattern):
        """
        인디케이터 패턴에서 관련 기법을 역추적합니다.

        예: 파일 해시 IOC -> 악성코드 -> 해당 악성코드를 사용하는 그룹
            -> 그룹이 사용하는 전체 기법 목록
        """
        results = {
            "indicator": indicator_pattern,
            "related_malware": [],
            "related_groups": [],
            "techniques": [],
            "mitigations": []
        }

        # 1. ATT&CK 소프트웨어(악성코드/도구)에서 패턴 매칭
        software_list = self.attack.get_software()
        for sw in software_list:
            desc = sw.get("description", "").lower()
            name = sw.get("name", "").lower()
            if indicator_pattern.lower() in desc or \
               indicator_pattern.lower() in name:
                results["related_malware"].append({
                    "name": sw["name"],
                    "id": sw["id"],
                    "type": sw.get("type", "unknown")
                })

                # 2. 해당 소프트웨어를 사용하는 그룹 조회
                groups = self.attack.get_groups_using_software(sw["id"])
                for g in groups:
                    group = g["object"]
                    group_info = {
                        "name": group["name"],
                        "id": group["id"]
                    }
                    results["related_groups"].append(group_info)

                    # 3. 그룹의 전체 기법 목록 조회
                    techs = self.attack.get_techniques_used_by_group(
                        group["id"]
                    )
                    for t in techs:
                        tech = t["object"]
                        ext_refs = tech.get("external_references", [])
                        tech_id = next(
                            (r["external_id"] for r in ext_refs
                             if r.get("source_name") == "mitre-attack"),
                            "N/A"
                        )
                        results["techniques"].append({
                            "id": tech_id,
                            "name": tech["name"],
                            "used_by": group["name"]
                        })

        # 4. 중복 제거
        seen = set()
        unique_techniques = []
        for t in results["techniques"]:
            key = t["id"]
            if key not in seen:
                seen.add(key)
                unique_techniques.append(t)
        results["techniques"] = unique_techniques

        return results

    def coverage_gap_analysis(self, defended_technique_ids):
        """
        조직이 방어하고 있는 기법 목록과 ATT&CK 전체 기법을
        비교하여 방어 공백(gap)을 식별합니다.
        """
        all_techniques = self.attack.get_techniques(
            remove_revoked_deprecated=True
        )

        total = len(all_techniques)
        covered = 0
        gaps = []

        for tech in all_techniques:
            ext_refs = tech.get("external_references", [])
            tech_id = next(
                (r["external_id"] for r in ext_refs
                 if r.get("source_name") == "mitre-attack"), None
            )
            if tech_id and tech_id in defended_technique_ids:
                covered += 1
            elif tech_id:
                gaps.append({
                    "id": tech_id,
                    "name": tech["name"]
                })

        return {
            "total_techniques": total,
            "covered": covered,
            "coverage_pct": round(covered / total * 100, 1),
            "gaps": gaps[:20],  # 상위 20개 공백만 반환
            "gap_count": len(gaps)
        }


# --- 사용 예시 ---
if __name__ == "__main__":
    engine = STIXAttackCrossRef("enterprise-attack.json")

    # 1. 인디케이터 기반 역추적
    results = engine.find_techniques_by_indicator("Emotet")
    print(f"[+] '{results['indicator']}' 관련 분석 결과:")
    print(f"    관련 악성코드: {len(results['related_malware'])}개")
    print(f"    관련 그룹: {len(results['related_groups'])}개")
    print(f"    연관 기법: {len(results['techniques'])}개")
    for t in results["techniques"][:5]:
        print(f"      - {t['id']}: {t['name']} (by {t['used_by']})")

    # 2. 방어 커버리지 공백 분석
    our_defenses = [
        "T1566.001", "T1059.001", "T1021.001",
        "T1078", "T1071.001", "T1048"
    ]
    gap = engine.coverage_gap_analysis(our_defenses)
    print(f"\n[+] 방어 커버리지 분석:")
    print(f"    전체 기법: {gap['total_techniques']}개")
    print(f"    방어 중: {gap['covered']}개 ({gap['coverage_pct']}%)")
    print(f"    공백: {gap['gap_count']}개")
    print(f"    주요 공백 (상위 5개):")
    for g in gap["gaps"][:5]:
        print(f"      - {g['id']}: {g['name']}")
```

이 코드의 핵심 가치는 **수동으로 스프레드시트에서 하던 교차 참조 작업을 자동화**한다는 점입니다. 새로운 IOC가 수집될 때마다 `find_techniques_by_indicator()`를 호출하면 관련 위협 그룹과 기법이 즉시 식별되고, `coverage_gap_analysis()`로 우리 조직의 방어 공백을 정량적으로 파악할 수 있습니다.

---

## 13. CTI 자동화 워크플로우 파이프라인

실무에서 위협 인텔리전스(CTI)를 운영하려면 데이터 수집부터 대응까지 일관된 파이프라인이 필요합니다. 아래 다이어그램은 STIX와 ATT&CK 온톨로지를 활용한 end-to-end CTI 자동화 워크플로우를 보여줍니다:

```mermaid
graph LR
    subgraph 수집["1. 데이터 수집"]
        A1["OSINT 피드<br/>(AlienVault OTX,<br/>Abuse.ch)"]
        A2["ISAC/ISAO<br/>(금융ISAC,<br/>KISA C-TAS)"]
        A3["내부 SIEM<br/>(Splunk,<br/>Elastic)"]
        A4["다크웹 모니터링<br/>(수동/자동)"]
    end

    subgraph 정규화["2. STIX 정규화"]
        B1["Raw Data<br/>Parser"]
        B2["STIX 2.1<br/>Validator"]
        B3["중복 제거<br/>(Dedup Engine)"]
    end

    subgraph 강화["3. 온톨로지 강화"]
        C1["ATT&CK<br/>기법 태깅"]
        C2["UCO 클래스<br/>매핑"]
        C3["신뢰도<br/>스코어링"]
    end

    subgraph 분석["4. 지식 그래프 분석"]
        D1["Neo4j<br/>그래프 DB"]
        D2["패턴 매칭<br/>(Cypher Query)"]
        D3["추론 엔진<br/>(SWRL Rules)"]
    end

    subgraph 대응["5. 자동 대응"]
        E1["SOAR<br/>플레이북 트리거"]
        E2["방화벽/EDR<br/>정책 업데이트"]
        E3["알림 및<br/>리포트 생성"]
    end

    A1 --> B1
    A2 --> B1
    A3 --> B1
    A4 --> B1
    B1 --> B2
    B2 --> B3
    B3 --> C1
    C1 --> C2
    C2 --> C3
    C3 --> D1
    D1 --> D2
    D2 --> D3
    D3 --> E1
    D3 --> E2
    D3 --> E3
    E1 -.->|"피드백"| D1
    E3 -.->|"피드백"| C3

    style 수집 fill:#e3f2fd
    style 정규화 fill:#e8f5e9
    style 강화 fill:#fff3e0
    style 분석 fill:#f3e5f5
    style 대응 fill:#ffebee
```

### 파이프라인 단계별 설명

**1단계 - 데이터 수집**: 외부 OSINT 피드(AlienVault OTX, Abuse.ch 등), 업계 정보 공유 조직(ISAC/ISAO), 내부 SIEM 로그, 다크웹 모니터링 등 다양한 소스에서 원시 위협 데이터를 수집합니다.

**2단계 - STIX 정규화**: 수집된 이질적인 데이터를 STIX 2.1 형식으로 변환합니다. 파서가 각 소스의 포맷을 STIX SDO/SRO로 매핑하고, 스키마 검증기가 유효성을 확인하며, 중복 제거 엔진이 동일 인디케이터를 병합합니다.

**3단계 - 온톨로지 강화**: 정규화된 STIX 객체에 ATT&CK 기법 ID를 자동 태깅하고, UCO 상위 클래스를 할당하며, 소스 신뢰도와 시간 경과에 따른 신뢰도 감쇠를 반영한 스코어를 부여합니다.

**4단계 - 지식 그래프 분석**: 강화된 데이터를 Neo4j 그래프 DB에 적재하고, Cypher 패턴 매칭으로 공격 체인을 식별하며, SWRL 추론 규칙으로 알려지지 않은 연결 관계를 추론합니다.

**5단계 - 자동 대응**: 분석 결과에 따라 SOAR 플레이북을 자동 트리거하고, 방화벽/EDR 정책을 업데이트하며, 분석 보고서를 자동 생성하여 관련 팀에 배포합니다.

이 파이프라인의 핵심은 **피드백 루프**입니다. SOAR 대응 결과가 다시 지식 그래프에 반영되어 향후 유사 공격에 대한 대응 정확도가 지속적으로 향상됩니다.

---

## 14. 자주 묻는 질문 (FAQ)

이 글 전반에 대해 자주 받는 질문과 답변을 정리했습니다.

**Q1: Python stix2 라이브러리의 학습 곡선은 어느 정도인가요?**

A: Python 기본 문법을 알고 있다면, stix2 라이브러리는 1-2일이면 기본 사용법을 익힐 수 있습니다. STIX 2.1 스펙 자체가 JSON 기반이라 직관적이고, 라이브러리가 ID 생성, 타임스탬프 관리, 스키마 검증을 자동 처리합니다. 공식 문서([stix2 ReadTheDocs](https://stix2.readthedocs.io/))에 풍부한 예제가 있으며, MITRE의 [cti-python-stix2](https://github.com/oasis-open/cti-python-stix2) 리포지토리에서 실제 사용 패턴을 참고할 수 있습니다. `mitreattack-python` 라이브러리도 비슷한 수준으로, ATT&CK 데이터를 STIX 객체로 직접 다루므로 두 라이브러리를 함께 익히는 것이 효율적입니다.

**Q2: 온톨로지 통합과 단순 API 연동의 차이점은 무엇인가요?**

A: API 연동은 "A 시스템에서 B 시스템으로 데이터를 보내는 것"에 초점을 맞춥니다. 반면 온톨로지 통합은 "A와 B의 데이터가 같은 의미 체계를 공유하도록 만드는 것"입니다. 예를 들어, API 연동으로 STIX 데이터를 ATT&CK Navigator에 전송할 수 있지만, "attack-pattern"이 "technique"과 같은 의미라는 것은 API가 알지 못합니다. 온톨로지 통합에서는 UCO 상위 클래스가 이 의미적 동등성을 정의하므로, 새로운 데이터 소스를 추가할 때 매핑 규칙을 반복 작성할 필요가 없습니다. 결과적으로 API 연동은 "점 대 점(point-to-point)" 연결이고, 온톨로지 통합은 "허브 앤 스포크(hub-and-spoke)" 연결입니다.

**Q3: 클라우드 환경에서 지식 그래프를 운영할 때의 비용은?**

A: AWS Neptune의 경우 db.r5.large 인스턴스 기준 시간당 약 $0.58(월 약 $420)에서 시작합니다. Neo4j AuraDB Professional은 월 $65부터입니다. 초기 파일럿 단계에서는 로컬 Neo4j Community Edition(무료)으로 시작하고, 데이터량이 수백만 노드를 넘어설 때 클라우드로 전환하는 것이 비용 효율적입니다. 중요한 것은 그래프 DB 비용보다 데이터 정규화 파이프라인의 개발/운영 비용이 더 크다는 점입니다. 인력 비용까지 고려하면, 자동화 파이프라인이 정착된 후의 ROI는 수동 분석 대비 상당히 높습니다.

**Q4: TAXII 서버를 직접 구축해야 하나요, 아니면 기존 서비스를 사용해도 되나요?**

A: 대부분의 경우 기존 TAXII 서비스를 사용하는 것이 효율적입니다. MITRE의 ATT&CK TAXII 서버(`cti-taxii.mitre.org`)에서 ATT&CK 데이터를 직접 가져올 수 있고, AlienVault OTX, Anomali STAXX 등의 서비스도 TAXII 2.1을 지원합니다. 직접 구축이 필요한 경우는 조직 내부 위협 인텔리전스를 외부 파트너와 양방향으로 공유해야 할 때입니다. 오픈소스 TAXII 서버로는 [Medallion](https://github.com/oasis-open/cti-taxii-server)이 대표적이며, Python 기반이라 커스터마이징이 비교적 용이합니다.

**Q5: 이 글에서 다룬 기술을 한국 법규(개인정보보호법, 정보통신망법) 하에서 적용할 때 주의할 점은?**

A: 지식 그래프에 저장되는 위협 인텔리전스 데이터가 개인정보를 포함할 수 있습니다. 특히 내부자 위협 분석 시 사용자 행동 데이터가 그래프에 적재될 수 있는데, 이 경우 개인정보보호법 제15조(개인정보 수집/이용)와 제17조(제3자 제공)에 따른 법적 근거가 필요합니다. 실무적으로는 (1) 그래프 노드에 PII 직접 저장을 피하고 해시 또는 가명 처리, (2) 접근 권한을 RBAC으로 통제, (3) 데이터 보존 기간을 정책으로 명시하고 자동 삭제 파이프라인을 구축하는 것을 권장합니다. 또한 위협 정보를 ISAC/ISAO를 통해 외부와 공유할 때는 정보통신망법 제48조의2(침해사고 대응)의 법적 근거를 확인하고, KISA의 개인정보 영향평가(PIA) 가이드라인을 참고하시기 바랍니다.

---

## 마치며

보안 데이터 표준화는 멋진 학술 주제가 아니라, 보안 팀의 위협 분석 효율을 높여주는 실용적인 도구입니다. STIX 2.1과 ATT&CK는 이미 충분히 성숙했고, 그래프 데이터베이스와 결합하면 수동으로 하던 위협 상관분석을 자동화할 수 있습니다.

이 글에서 다룬 핵심 내용을 정리하면:

- **STIX 2.1과 ATT&CK의 스키마 분절 문제**를 온톨로지 통합으로 해결할 수 있으며, UCO 기반 3계층 설계가 구조적 해법입니다
- **Python stix2 + mitreattack-python 라이브러리**로 프로그래밍 방식의 위협 데이터 생성, 조회, 교차 참조가 가능합니다
- **지식 그래프(Neo4j)와 SPARQL/Cypher 쿼리**를 결합하면 수동 위협 상관분석을 자동화할 수 있습니다
- **CTI 파이프라인의 5단계(수집-정규화-강화-분석-대응)**가 end-to-end 자동화의 골격이며, 피드백 루프가 핵심입니다
- **Level 1(STIX 채택)부터 단계적으로 도입**하는 것이 현실적이며, 소규모 팀도 즉시 시작할 수 있습니다

완벽한 온톨로지를 설계하는 것보다, **지금 당장 STIX 형식으로 데이터를 정규화하고 Neo4j에 넣어보는 것**이 첫 걸음입니다. Level 1부터 시작하면 됩니다.

질문이나 피드백은 언제든 환영합니다.

---

## 참고 자료

### 공식 표준/프레임워크
- [OASIS STIX 2.1 공식 문서](https://oasis-open.github.io/cti-documentation/stix/intro.html) - STIX 2.1 스펙과 예제
- [MITRE ATT&CK Framework](https://attack.mitre.org) - 위협 행동 분류 체계
- [MITRE ATT&CK Design and Philosophy](https://attack.mitre.org/docs/ATTACK_Design_and_Philosophy_March_2020.pdf) - ATT&CK 설계 철학 백서
- [TAXII 2.1 Specification](https://docs.oasis-open.org/cti/taxii/v2.1/taxii-v2.1.html) - STIX 데이터 교환 프로토콜
- [Unified Cyber Ontology (UCO)](https://unifiedcyberontology.org/) - 사이버 수사 도메인 온톨로지

### 도구/기술
- [Neo4j Knowledge Graphs](https://neo4j.com/knowledge-graphs/) - 그래프 데이터베이스
- [Apache Jena](https://jena.apache.org/) - Java 기반 시맨틱 웹 프레임워크 (SPARQL, OWL 추론)
- [SPARQL 1.1 Query Language (W3C)](https://www.w3.org/TR/sparql11-query/) - 그래프 쿼리 언어 표준
- [OWL 2 Web Ontology Language (W3C)](https://www.w3.org/TR/owl2-overview/) - 온톨로지 정의 표준
- [AICRA: OWASP Agentic Top 10 분석](/blog/2026/owasp-agentic-top-10-2026/) (관련 포스트)
- [AICRA: OWASP LLM Top 10 2025](/blog/2025/owasp-llm-top-10-2025/) (관련 포스트)

### 관련 연구/보고서
- [SANS 2024 SOC Survey](https://www.sans.org/white-papers/soc-survey/) - SOC 팀 운영 현황
- [MITRE ATT&CK Navigator](https://mitre-attack.github.io/attack-navigator/) - 기법 커버리지 시각화 도구
- [STIX/ATT&CK Mapping](https://github.com/mitre/cti) - MITRE 공식 STIX 형식 ATT&CK 데이터

---

**AICRA** | 2026년 3월 22일

*이 글에서 다루는 내용은 보안 커뮤니티의 피드백을 환영합니다.*
