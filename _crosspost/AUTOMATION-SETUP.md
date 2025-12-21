# AICRA 크로스포스팅 자동화 설정 가이드

## 플랫폼별 자동화 현황

| 플랫폼 | 자동화 수준 | 방법 | 설정 필요 |
|--------|------------|------|----------|
| GitHub Pages | 완전 자동 | GitHub Actions | 설정 완료 |
| Medium | 반자동 | API + 수동 발행 | API 토큰 |
| Naver Blog | 수동 | 템플릿 복사 | 없음 |
| Substack | 반자동 | 다이제스트 생성 + 수동 발행 | 선택적 Webhook |

---

## 1. Medium 자동화 설정

### Step 1: Medium Integration Token 발급

1. https://medium.com/me/settings/security 접속
2. "Integration tokens" 섹션에서 토큰 생성
3. 토큰 복사 (한 번만 표시됨!)

### Step 2: GitHub Secrets 설정

```bash
# GitHub Repository Settings > Secrets and variables > Actions
MEDIUM_TOKEN: {발급받은 토큰}
MEDIUM_USER_ID: {Medium 사용자 ID}

# Variables 탭에서
ENABLE_CROSSPOST: true
```

### Step 3: Medium User ID 확인

```bash
curl -H "Authorization: Bearer {YOUR_TOKEN}" \
  https://api.medium.com/v1/me
```

### 동작 방식
1. `_posts/`에 새 포스트 push
2. GitHub Actions가 자동 실행
3. Medium에 **Draft** 상태로 생성
4. Medium에서 수동으로 발행 확인

---

## 2. Substack 자동화 설정

### 옵션 A: Zapier 연동 (권장)

1. **Zapier 계정 생성**: https://zapier.com

2. **Zap 설정**:
   - Trigger: Webhook (Catch Hook)
   - Action: Email by Zapier (Send Outbound Email)
   - To: {Substack 뉴스레터 이메일}

3. **GitHub Variables 설정**:
   ```
   ZAPIER_WEBHOOK_URL: https://hooks.zapier.com/hooks/catch/...
   ENABLE_SUBSTACK: true
   ```

4. **동작 방식**:
   - 매주 일요일 다이제스트 자동 생성
   - Zapier로 웹훅 전송
   - 이메일로 Substack에 전달
   - Substack에서 수동 발행

### 옵션 B: Make.com 연동

1. **Make 시나리오 생성**
2. **Webhook 트리거 설정**
3. **Substack API 대안 모듈 연결**

### 옵션 C: 수동 (현재 설정)

1. 매주 일요일 다이제스트 자동 생성
2. `_crosspost/substack/` 폴더에 저장
3. 내용 복사 → Substack 에디터에 붙여넣기
4. 월요일 오전 9시 발행 예약

---

## 3. Naver Blog (수동)

### 워크플로우

1. GitHub Pages에 포스트 발행
2. `_crosspost/naver/` 폴더의 요약본 확인
3. 네이버 블로그 에디터에 복사
4. 해시태그 추가
5. 발행

### 템플릿 사용법

```bash
# 자동 생성된 요약본 위치
_crosspost/naver/2025-12-21-owasp-llm-top-10-2025.md
```

---

## 4. 환경 변수 요약

### GitHub Repository Settings > Secrets

| Secret | 용도 |
|--------|------|
| `MEDIUM_TOKEN` | Medium API 토큰 |
| `MEDIUM_USER_ID` | Medium 사용자 ID |

### GitHub Repository Settings > Variables

| Variable | 값 | 용도 |
|----------|---|------|
| `ENABLE_CROSSPOST` | `true` | Medium 자동화 활성화 |
| `ENABLE_SUBSTACK` | `true` | Substack 다이제스트 활성화 |
| `ZAPIER_WEBHOOK_URL` | URL | Zapier 웹훅 (선택) |

---

## 5. 워크플로우 수동 실행

### Medium 크로스포스팅
```bash
# GitHub Actions > crosspost-medium > Run workflow
# 특정 포스트 지정 가능
```

### Substack 다이제스트
```bash
# GitHub Actions > substack-digest > Run workflow
# force_generate: true로 강제 생성 가능
```

---

## 6. 문제 해결

### Medium API 오류
- 429: Rate limit - 잠시 후 재시도
- 401: 토큰 만료 - 새 토큰 발급
- 400: 잘못된 형식 - 콘텐츠 확인

### Substack 다이제스트 미생성
- 지난 7일간 새 포스트 없음 → force_generate 사용
- cron 스케줄 확인 (UTC 기준)

### Naver 복사 깨짐
- HTML 형식으로 변환 필요
- 마크다운 → HTML 변환 도구 사용

---

## 7. 향후 개선 계획

- [ ] DeepL API 연동 (자동 영문 번역)
- [ ] RSS to Substack 자동화
- [ ] 네이버 API 대안 탐색
- [ ] 분석 대시보드 구축
