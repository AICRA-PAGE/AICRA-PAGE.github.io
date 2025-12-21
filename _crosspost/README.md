# AICRA Cross-Posting Guide
# 인공지능보안연구회 크로스포스팅 가이드

## Overview / 개요

This directory contains templates and guides for cross-posting AICRA blog content to multiple platforms.

이 디렉토리는 AICRA 블로그 콘텐츠를 여러 플랫폼에 크로스포스팅하기 위한 템플릿과 가이드를 포함합니다.

## Platforms / 플랫폼

| Platform | Language | Format | Frequency |
|----------|----------|--------|-----------|
| GitHub Pages | KO | Full | Immediate |
| Naver Blog | KO | Summary (800자) | Immediate |
| Medium | EN | Full Translation | Immediate |
| Substack | KO | Weekly Digest | Monday 09:00 |

## Workflow / 워크플로우

```
[GitHub 원본 작성]
       |
       v
[GitHub Pages 자동 배포] -----> https://aicra-page.github.io/AICRA-analyze
       |
       +---> [Naver 요약본 생성] ---> naver-template.md 사용
       |
       +---> [Medium 영문 번역] ---> medium-template.md 사용
       |
       v
[주간 다이제스트 축적] -----> weekly-digest.md
       |
       v (매주 월요일)
[Substack 뉴스레터 발송]
```

## Templates / 템플릿

### 1. Naver Blog Template
- **File**: `naver-template.md`
- **Max Length**: 800자
- **Focus**: 인포그래픽, 핵심 요약
- **Hashtags**: #인공지능보안 #AI보안 #LLM보안

### 2. Medium Template
- **File**: `medium-template.md`
- **Language**: English
- **Focus**: Technical deep-dive, code examples
- **Tags**: ai-security, llm-security, owasp

### 3. Substack Digest Template
- **File**: `substack-template.md`
- **Frequency**: Weekly
- **Content**: Curated articles + expert commentary

## Quick Start / 빠른 시작

### Step 1: Write Original Post
```bash
# Create new post in _posts/
_posts/2025-12-21-your-post-title.md
```

### Step 2: Generate Platform Versions
```bash
# Copy templates and customize
cp _crosspost/naver-template.md _crosspost/naver/2025-12-21-your-post.md
cp _crosspost/medium-template.md _crosspost/medium/2025-12-21-your-post.md
```

### Step 3: Publish to Platforms
1. **Naver**: Copy HTML to Naver Blog editor
2. **Medium**: Import markdown or copy-paste
3. **Substack**: Add to weekly digest, send Monday

## Content Guidelines / 콘텐츠 가이드라인

### Naver Blog (네이버 블로그)
- 800자 이내 요약
- 시각적 콘텐츠 강조 (인포그래픽, 다이어그램)
- 해시태그 5-10개
- SEO 키워드: AI보안, LLM, OWASP

### Medium
- Full English translation
- Technical accuracy priority
- Include code examples when relevant
- Canonical URL to GitHub Pages

### Substack Newsletter
- 주간 하이라이트 3-5개
- 전문가 코멘터리 추가
- Call-to-action 포함
- 구독 유도 문구

## Automation Ideas / 자동화 아이디어

Future enhancements:
- GitHub Actions for auto-translation
- API integration with Naver/Medium
- Scheduled Substack publishing
- Analytics tracking across platforms
