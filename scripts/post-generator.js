#!/usr/bin/env node
/**
 * AICRA Blog Post Generator
 *
 * Converts raw text + images into properly formatted AICRA blog posts.
 * - Auto-generates frontmatter (layout, date, categories, tags, thumbnail)
 * - Copies images to assets/img/posts/ with proper references
 * - Structures content with headings, tables, mermaid placeholders
 * - Generates thumbnail SVG from title
 * - Supports templates: threat-analysis, architecture-deep-dive, incident-retrospective
 *
 * Usage:
 *   node scripts/post-generator.js --title "Post Title" --text input.txt [--images img1.png img2.png]
 *   node scripts/post-generator.js --interactive
 *   node scripts/post-generator.js --from-obsidian "K:/Obsidian/note.md"
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const POSTS_DIR = path.join(ROOT, '_posts');
const ASSETS_DIR = path.join(ROOT, 'assets', 'img', 'posts');
const TEMPLATES_DIR = path.join(ROOT, '_templates');

// ============================================================
// Slug & Date Utilities
// ============================================================

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[가-힣]+/g, match => {
      // Simple Korean to romanization mapping for common terms
      const map = {
        '보안': 'security', '분석': 'analysis', '위협': 'threat',
        '공격': 'attack', '방어': 'defense', '시스템': 'system',
        '인공지능': 'ai', '연구': 'research', '프레임워크': 'framework',
        '취약점': 'vulnerability', '디지털': 'digital', '트윈': 'twin',
        '온톨로지': 'ontology', '에이전트': 'agent',
      };
      for (const [kr, en] of Object.entries(map)) {
        if (match.includes(kr)) return en;
      }
      return '';
    })
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ============================================================
// Frontmatter Generator
// ============================================================

function generateFrontmatter({ title, description, date, categories, tags, author, template }) {
  const slug = slugify(title);
  const thumbName = `${slug}.svg`;

  const fm = {
    layout: 'post',
    title: `"${title}"`,
    description: `"${description || title}"`,
    date: date || today(),
    last_modified_at: date || today(),
    categories: `[${(categories || ['Research']).join(', ')}]`,
    tags: `[${(tags || []).join(', ')}]`,
    author: author || 'AICRA',
    toc: true,
    lang: 'ko',
    thumbnail: `/assets/img/posts/${thumbName}`,
  };

  let lines = ['---'];
  for (const [key, val] of Object.entries(fm)) {
    lines.push(`${key}: ${val}`);
  }
  lines.push('---');
  return { frontmatter: lines.join('\n'), slug, thumbName };
}

// ============================================================
// Thumbnail SVG Generator
// ============================================================

function generateThumbnailSvg(title, slug) {
  const colors = [
    { bg: '#2F5D50', fg: '#ffffff' },
    { bg: '#B5422C', fg: '#ffffff' },
    { bg: '#1565c0', fg: '#ffffff' },
    { bg: '#4a148c', fg: '#ffffff' },
    { bg: '#e65100', fg: '#ffffff' },
  ];
  const color = colors[Math.abs(hashCode(slug)) % colors.length];

  // Truncate title for SVG display
  const displayTitle = title.length > 30 ? title.slice(0, 28) + '...' : title;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" font-family="Pretendard, sans-serif">
  <rect width="400" height="200" fill="${color.bg}" rx="8"/>
  <text x="200" y="90" text-anchor="middle" fill="${color.fg}" font-size="16" font-weight="700">${escapeXml(displayTitle)}</text>
  <text x="200" y="130" text-anchor="middle" fill="${color.fg}" font-size="11" opacity="0.8">AICRA Research Blog</text>
  <line x1="120" y1="150" x2="280" y2="150" stroke="${color.fg}" stroke-width="1" opacity="0.3"/>
  <text x="200" y="175" text-anchor="middle" fill="${color.fg}" font-size="10" opacity="0.6">${today()}</text>
</svg>`;
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hashCode(s) {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

// ============================================================
// Content Structurer
// ============================================================

function structureContent(rawText, { images, template }) {
  let content = rawText;

  // 1. If raw text has no markdown headings, try to add structure
  if (!content.match(/^##\s/m)) {
    content = autoStructure(content);
  }

  // 2. Insert image references
  if (images && images.length > 0) {
    const imgRefs = images.map((img, i) => {
      const ext = path.extname(img);
      const basename = path.basename(img, ext);
      return `![${basename}](/assets/img/posts/${path.basename(img)})\n*${basename}*`;
    });
    // Insert first image after first heading
    const firstHeadingEnd = content.indexOf('\n', content.indexOf('## '));
    if (firstHeadingEnd > 0) {
      content = content.slice(0, firstHeadingEnd + 1) + '\n' + imgRefs[0] + '\n' + content.slice(firstHeadingEnd + 1);
    }
    // Append remaining images before references section
    if (imgRefs.length > 1) {
      const refsIdx = content.lastIndexOf('## 참고');
      const insertPoint = refsIdx > 0 ? refsIdx : content.length;
      content = content.slice(0, insertPoint) + imgRefs.slice(1).join('\n\n') + '\n\n' + content.slice(insertPoint);
    }
  }

  // 3. Add reference section if missing
  if (!content.match(/^##.*참고|^##.*References/m)) {
    content += '\n\n---\n\n## 참고 자료\n\n- [출처를 추가하세요]\n';
  }

  return content;
}

function autoStructure(text) {
  // Split by double newlines and try to create sections
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  if (paragraphs.length < 3) return text;

  let structured = '';
  structured += `## 개요\n\n${paragraphs[0]}\n\n---\n\n`;
  structured += `## 본문\n\n${paragraphs.slice(1, -1).join('\n\n')}\n\n---\n\n`;
  structured += `## 결론\n\n${paragraphs[paragraphs.length - 1]}\n`;

  return structured;
}

// ============================================================
// Image Processor
// ============================================================

function processImages(images) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
  const processed = [];

  for (const img of images) {
    const absPath = path.resolve(img);
    if (!fs.existsSync(absPath)) {
      console.error(`[!] Image not found: ${absPath}`);
      continue;
    }
    const dest = path.join(ASSETS_DIR, path.basename(img));
    fs.copyFileSync(absPath, dest);
    processed.push(path.basename(img));
    console.log(`[+] Image copied: ${dest}`);
  }

  return processed;
}

// ============================================================
// Post Writer
// ============================================================

function generatePost({ title, description, text, images, categories, tags, author, template, date }) {
  // 1. Generate frontmatter
  const { frontmatter, slug, thumbName } = generateFrontmatter({
    title, description, date, categories, tags, author, template
  });

  // 2. Process images
  let processedImages = [];
  if (images && images.length > 0) {
    processedImages = processImages(images);
  }

  // 3. Structure content
  const content = structureContent(text, { images: processedImages, template });

  // 4. Generate thumbnail SVG
  const thumbSvg = generateThumbnailSvg(title, slug);
  const thumbPath = path.join(ASSETS_DIR, thumbName);
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
  fs.writeFileSync(thumbPath, thumbSvg, 'utf-8');
  console.log(`[+] Thumbnail: ${thumbPath}`);

  // 5. Write post file
  const postDate = date || today();
  const filename = `${postDate}-${slug}.md`;
  const postPath = path.join(POSTS_DIR, filename);
  fs.writeFileSync(postPath, frontmatter + '\n\n' + content, 'utf-8');

  console.log(`[+] Post created: ${postPath}`);
  console.log(`    Title: ${title}`);
  console.log(`    Slug: ${slug}`);
  console.log(`    Images: ${processedImages.length}`);
  console.log(`    Thumbnail: ${thumbName}`);

  return { postPath, filename, slug };
}

// ============================================================
// Obsidian Note Converter
// ============================================================

function convertFromObsidian(obsidianPath) {
  if (!fs.existsSync(obsidianPath)) {
    console.error(`[!] Obsidian note not found: ${obsidianPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(obsidianPath, 'utf-8');

  // Parse Obsidian frontmatter if present
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  let title = path.basename(obsidianPath, '.md');
  let text = raw;
  let tags = [];

  if (fmMatch) {
    const fmLines = fmMatch[1].split('\n');
    for (const line of fmLines) {
      if (line.startsWith('title:')) title = line.slice(6).trim().replace(/^["']|["']$/g, '');
      if (line.startsWith('tags:')) {
        const tagStr = line.slice(5).trim();
        if (tagStr.startsWith('[')) {
          tags = tagStr.slice(1, -1).split(',').map(t => t.trim());
        }
      }
    }
    text = fmMatch[2];
  }

  // Convert Obsidian wikilinks to markdown links
  text = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '[$2]($1)');
  text = text.replace(/\[\[([^\]]+)\]\]/g, '[$1]($1)');

  // Convert Obsidian image embeds
  text = text.replace(/!\[\[([^\]]+)\]\]/g, '![$1](/assets/img/posts/$1)');

  return generatePost({
    title,
    text,
    tags,
    categories: ['Research'],
  });
}

// ============================================================
// CLI Interface
// ============================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    title: null, text: null, textFile: null, images: [],
    categories: [], tags: [], template: null,
    fromObsidian: null, date: null, author: null,
    description: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--title': case '-t': opts.title = args[++i]; break;
      case '--text': opts.textFile = args[++i]; break;
      case '--description': case '-d': opts.description = args[++i]; break;
      case '--images': case '-i':
        while (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          opts.images.push(args[++i]);
        }
        break;
      case '--categories': case '-c':
        while (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          opts.categories.push(args[++i]);
        }
        break;
      case '--tags':
        while (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          opts.tags.push(args[++i]);
        }
        break;
      case '--template': opts.template = args[++i]; break;
      case '--from-obsidian': opts.fromObsidian = args[++i]; break;
      case '--date': opts.date = args[++i]; break;
      case '--author': opts.author = args[++i]; break;
      case '--help': case '-h': printHelp(); process.exit(0);
    }
  }
  return opts;
}

function printHelp() {
  console.log(`
AICRA Blog Post Generator
==========================

Usage:
  node scripts/post-generator.js [options]

Options:
  --title, -t       Post title (required unless --from-obsidian)
  --text            Path to text file with post content
  --description, -d Post description/subtitle
  --images, -i      Image file paths (space separated)
  --categories, -c  Categories (default: Research)
  --tags            Tags (space separated)
  --template        Template: threat-analysis, architecture-deep-dive, incident-retrospective
  --from-obsidian   Convert Obsidian note to blog post
  --date            Post date (default: today, format: YYYY-MM-DD)
  --author          Author name (default: AICRA)
  --help, -h        Show this help

Examples:
  node scripts/post-generator.js --title "MCP Security Guide" --text draft.txt --tags mcp security
  node scripts/post-generator.js --from-obsidian "K:/Obsidian/4-Projects/AICRA-Blog/draft.md"
  node scripts/post-generator.js --title "New Threat" --text content.md --images diagram.svg photo.png
`);
}

// ============================================================
// Main
// ============================================================

const opts = parseArgs();

if (opts.fromObsidian) {
  convertFromObsidian(opts.fromObsidian);
} else if (opts.title) {
  let text = '';
  if (opts.textFile) {
    if (!fs.existsSync(opts.textFile)) {
      console.error(`[!] Text file not found: ${opts.textFile}`);
      process.exit(1);
    }
    text = fs.readFileSync(opts.textFile, 'utf-8');
  } else {
    text = '## 개요\n\n이 포스트의 내용을 작성하세요.\n\n---\n\n## 참고 자료\n\n- [출처 추가]\n';
  }

  generatePost({
    title: opts.title,
    description: opts.description,
    text,
    images: opts.images,
    categories: opts.categories.length ? opts.categories : ['Research'],
    tags: opts.tags,
    author: opts.author,
    template: opts.template,
    date: opts.date,
  });
} else {
  console.log('[!] --title or --from-obsidian required. Use --help for usage.');
  process.exit(1);
}
