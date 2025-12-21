# Medium 통합 가이드 (2025년 업데이트)

## 중요 공지: API 정책 변경

> **Medium은 2024년부터 새로운 Integration Token 발급을 중단했습니다.**
> 기존 토큰은 계속 작동하지만, 신규 사용자는 대안 방법을 사용해야 합니다.

---

## 통합 옵션 비교

| 방법 | 신규 사용자 | 자동화 수준 | 난이도 |
|------|------------|------------|--------|
| API Token (기존) | X | 높음 | 중 |
| Import URL | O | 중 | 낮음 |
| IFTTT 연동 | O | 중 | 낮음 |
| Playwright 자동화 | O | 높음 | 높음 |
| 수동 복사 | O | 없음 | 매우 낮음 |

---

## 옵션 1: API Token (기존 토큰 보유 시)

### 토큰 확인
```bash
# Medium 설정 > Security > Integration tokens
https://medium.com/me/settings/security
```

### API 테스트
```bash
# 사용자 정보 확인
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.medium.com/v1/me

# 응답 예시
{
  "data": {
    "id": "5303d74c64f66366f00cb9b2a94f3251bf...",
    "username": "aicra-security",
    "name": "AICRA",
    "url": "https://medium.com/@aicra-security"
  }
}
```

### GitHub Secrets 설정
```
MEDIUM_TOKEN: {토큰}
MEDIUM_USER_ID: {위 응답의 id}
```

---

## 옵션 2: Import URL (권장 대안)

Medium의 공식 Import 기능을 활용하는 방법입니다.

### 사용 방법

1. **GitHub Pages에 포스트 발행**
   ```
   https://aicra-page.github.io/AICRA-analyze/blog/2025/owasp-llm-top-10-2025/
   ```

2. **Medium Import 페이지 접속**
   ```
   https://medium.com/p/import
   ```

3. **URL 입력 후 Import**
   - 자동으로 콘텐츠 파싱
   - 이미지 자동 업로드
   - 포맷 유지

### 자동화 스크립트 (Playwright)

```javascript
// scripts/medium-import.js
const { chromium } = require('playwright');

async function importToMedium(postUrl) {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Medium 로그인 (수동 또는 저장된 세션)
  await page.goto('https://medium.com/m/signin');

  // Import 페이지로 이동
  await page.goto('https://medium.com/p/import');

  // URL 입력
  await page.fill('input[placeholder*="URL"]', postUrl);
  await page.click('button:has-text("Import")');

  // 결과 대기
  await page.waitForNavigation();

  console.log('Imported:', page.url());
  await browser.close();
}

// 사용 예
importToMedium('https://aicra-page.github.io/AICRA-analyze/blog/2025/owasp-llm-top-10-2025/');
```

---

## 옵션 3: IFTTT 연동

### 설정 방법

1. **IFTTT 가입**: https://ifttt.com

2. **Applet 생성**:
   - IF: Webhook (새 포스트 알림)
   - THEN: Medium (새 스토리 작성)

3. **GitHub Actions에서 Webhook 호출**:
   ```yaml
   - name: Trigger IFTTT
     run: |
       curl -X POST "https://maker.ifttt.com/trigger/new_post/with/key/${{ secrets.IFTTT_KEY }}" \
         -H "Content-Type: application/json" \
         -d '{"value1": "${{ env.POST_TITLE }}", "value2": "${{ env.POST_URL }}"}'
   ```

---

## 옵션 4: Playwright 전체 자동화

브라우저 자동화로 Medium에 직접 포스팅합니다.

### 설치
```bash
npm install playwright
npx playwright install chromium
```

### 전체 스크립트

```javascript
// scripts/medium-auto-post.js
const { chromium } = require('playwright');
const fs = require('fs');
const matter = require('gray-matter');
const { marked } = require('marked');

async function postToMedium(postPath, options = {}) {
  const {
    headless = false,
    sessionFile = 'medium-session.json'
  } = options;

  // 포스트 파싱
  const content = fs.readFileSync(postPath, 'utf8');
  const { data, content: body } = matter(content);
  const htmlContent = marked(body);

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    storageState: fs.existsSync(sessionFile) ? sessionFile : undefined
  });
  const page = await context.newPage();

  try {
    // Medium 새 스토리 페이지
    await page.goto('https://medium.com/new-story');

    // 로그인 확인
    if (page.url().includes('signin')) {
      console.log('Please login manually...');
      await page.waitForNavigation({ timeout: 120000 });
      // 세션 저장
      await context.storageState({ path: sessionFile });
    }

    // 제목 입력
    await page.waitForSelector('[data-testid="post-title"]');
    await page.fill('[data-testid="post-title"]', data.title);

    // 본문 입력 (HTML 붙여넣기)
    await page.click('[data-testid="post-content"]');
    await page.keyboard.press('Control+Shift+V'); // Paste as plain text first

    // 또는 직접 타이핑
    // await page.type('[data-testid="post-content"]', body);

    console.log('Draft created! Please review and publish manually.');

    // 스크린샷 저장
    await page.screenshot({ path: 'medium-draft.png' });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

// CLI 사용
const postPath = process.argv[2] || '_posts/2025-12-21-owasp-llm-top-10-2025.md';
postToMedium(postPath);
```

---

## 권장 워크플로우 (신규 사용자)

```
[GitHub 포스트 작성]
       |
       v
[GitHub Pages 자동 배포]
       |
       v
[Import URL 사용] ──> https://medium.com/p/import
       |                     ↓
       |              [URL 입력]
       |                     ↓
       v              [자동 Import]
[수동 검토 & 발행]
```

### 반자동화 스크립트

```bash
#!/bin/bash
# scripts/open-medium-import.sh

POST_URL="$1"
IMPORT_URL="https://medium.com/p/import"

echo "Opening Medium Import page..."
echo "Please paste this URL: $POST_URL"

# Windows
start "$IMPORT_URL"

# macOS
# open "$IMPORT_URL"

# Linux
# xdg-open "$IMPORT_URL"
```

---

## GitHub Actions 통합

### 워크플로우 업데이트

```yaml
# .github/workflows/crosspost-medium.yml
- name: Prepare Medium Import
  if: steps.changed.outputs.posts != ''
  run: |
    POST_FILE="${{ steps.changed.outputs.posts }}"
    POST_SLUG=$(basename "$POST_FILE" .md | sed 's/^[0-9-]*//')
    POST_URL="https://aicra-page.github.io/AICRA-analyze/blog/${POST_SLUG}/"

    echo "## Medium Import Ready" >> $GITHUB_STEP_SUMMARY
    echo "" >> $GITHUB_STEP_SUMMARY
    echo "1. Go to: https://medium.com/p/import" >> $GITHUB_STEP_SUMMARY
    echo "2. Paste URL: \`$POST_URL\`" >> $GITHUB_STEP_SUMMARY
    echo "3. Review and publish" >> $GITHUB_STEP_SUMMARY
```

---

## 문제 해결

### API 토큰 오류
- 401: 토큰이 만료되었거나 무효함
- **해결**: Import URL 방식으로 전환

### Import 실패
- 일부 HTML 태그 미지원
- **해결**: 마크다운 단순화, 이미지 별도 업로드

### Playwright 로그인 문제
- 2FA 활성화 시 수동 개입 필요
- **해결**: 세션 파일 저장 후 재사용

---

## 요약

| 상황 | 권장 방법 |
|------|----------|
| 기존 API 토큰 있음 | API 사용 |
| 신규 계정 | Import URL |
| 완전 자동화 필요 | Playwright |
| 간단히 시작 | 수동 복사 |

**현재 AICRA 권장**: Import URL 방식 (가장 안정적)
