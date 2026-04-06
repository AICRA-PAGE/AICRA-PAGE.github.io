# AICRA Blog - AI Security Research

## Project Overview
Korean AI security research blog on GitHub Pages. Academic tone, 5000+ word posts, mermaid diagrams.

## Tech Stack
Jekyll 4.3, Ruby, al-folio inspired theme. Plugins: paginate-v2, toc, seo-tag, archives.

## Key Commands
```bash
bundle exec jekyll serve    # Dev server :4000
bundle exec jekyll build    # Production build
```

## Coding Conventions
- Posts: `_posts/YYYY-MM-DD-slug.md`, Korean body, English terms
- Frontmatter: title, date, categories, tags, toc: true
- Diagrams: mermaid blocks. Styles: `_sass/_custom.scss` only.

## Key Files
`_config.yml` (site config), `_posts/*.md` (articles), `_sass/_custom.scss` (theme), `Gemfile` (deps)
