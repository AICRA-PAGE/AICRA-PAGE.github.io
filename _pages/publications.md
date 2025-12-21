---
layout: default
title: Publications
permalink: /publications/
description: AICRA 연구 발표 및 출판물
---

<div class="publications-page">

# Publications

AICRA 연구회의 연구 발표, 논문, 그리고 기술 보고서를 소개합니다.

---

## 2025

### Research Papers

<div class="publication-list">

{% for post in site.posts %}
{% if post.type == 'paper' %}
<div class="publication-item">
  <div class="pub-year">{{ post.date | date: "%Y" }}</div>
  <div class="pub-content">
    <h4><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h4>
    <p class="pub-authors">{{ post.authors | default: "AICRA Research Team" }}</p>
    {% if post.venue %}
    <p class="pub-venue">{{ post.venue }}</p>
    {% endif %}
    <div class="pub-links">
      {% if post.pdf %}
      <a href="{{ post.pdf }}" class="pub-link">PDF</a>
      {% endif %}
      {% if post.code %}
      <a href="{{ post.code }}" class="pub-link">Code</a>
      {% endif %}
      {% if post.slides %}
      <a href="{{ post.slides }}" class="pub-link">Slides</a>
      {% endif %}
    </div>
  </div>
</div>
{% endif %}
{% endfor %}

</div>

### Technical Reports

<div class="publication-list">

| Date | Title | Authors |
|------|-------|---------|
| 2025-12 | OWASP LLM Top 10 2025 한국어 분석 | AICRA |
| 2025-12 | MCP Security Analysis Framework | AICRA |

</div>

---

## Contributing

연구 발표 및 기술 보고서 기여에 관심이 있으시면 [GitHub](https://github.com/AICRA-PAGE/AICRA-analyze)에서 PR을 제출해주세요.

</div>

<style>
.publications-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
}

.publication-list {
  margin: 1.5rem 0;
}

.publication-item {
  display: flex;
  gap: 1.5rem;
  padding: 1.5rem 0;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.pub-year {
  font-weight: 600;
  color: var(--primary-color, #2563eb);
  min-width: 50px;
}

.pub-content h4 {
  margin: 0 0 0.5rem 0;
  font-weight: 600;
}

.pub-content h4 a {
  color: var(--text-primary, #1f2937);
  text-decoration: none;
}

.pub-content h4 a:hover {
  color: var(--primary-color, #2563eb);
}

.pub-authors {
  font-size: 0.9rem;
  color: var(--text-secondary, #6b7280);
  margin: 0.25rem 0;
}

.pub-venue {
  font-size: 0.85rem;
  font-style: italic;
  color: var(--text-tertiary, #9ca3af);
  margin: 0.25rem 0;
}

.pub-links {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.pub-link {
  padding: 0.25rem 0.75rem;
  font-size: 0.8rem;
  border-radius: 4px;
  background: var(--bg-secondary, #f3f4f6);
  color: var(--text-secondary, #4b5563);
  text-decoration: none;
  transition: all 0.2s;
}

.pub-link:hover {
  background: var(--primary-color, #2563eb);
  color: white;
}

[data-theme="dark"] .pub-content h4 a {
  color: var(--text-primary, #f3f4f6);
}

[data-theme="dark"] .pub-link {
  background: var(--bg-tertiary, #374151);
  color: var(--text-secondary, #9ca3af);
}
</style>
