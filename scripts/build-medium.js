#!/usr/bin/env node
// build-medium.js - Generate Medium-compatible markdown from Jekyll posts
// Usage: node scripts/build-medium.js [post-filename]
// If no filename given, processes all posts with crosspost.medium.enabled: true

const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, '..', '_posts');
const OUTPUT_DIR = path.join(__dirname, '..', '_crosspost', 'medium');
const SITE_URL = 'https://aicra-page.github.io';

// Simple frontmatter parser (handles quoted values with colons)
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta = {};
  const lines = match[1].split('\n');

  for (const line of lines) {
    // Match key: value, taking first colon only
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (!key || key.startsWith(' ') || key.startsWith('#')) continue;

    let val = line.slice(idx + 1).trim();
    // Handle arrays
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
    } else {
      val = val.replace(/^["']|["']$/g, '');
    }
    meta[key] = val;
  }

  return { meta, body: match[2] };
}

// Transform Jekyll markdown to Medium-compatible markdown
function transformForMedium(meta, body, filename) {
  let output = body;

  // Build canonical URL
  const dateMatch = filename.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)\.md$/);
  let permalink = meta.permalink;
  if (!permalink && dateMatch) {
    permalink = `/blog/${dateMatch[1]}/${dateMatch[4]}/`;
  }
  const canonicalUrl = `${SITE_URL}${permalink || '/'}`;

  // 1. Convert relative image paths to absolute
  output = output.replace(/!\[([^\]]*)\]\((?!http)(\/[^)]+)\)/g,
    `![$1](${SITE_URL}$2)`);

  // 2. Remove Jekyll-specific liquid tags
  output = output.replace(/\{%[^%]*%\}/g, '');
  output = output.replace(/\{\{[^}]*\}\}/g, '');

  // 3. Remove TOC markers
  output = output.replace(/\*\s*TOC\s*\n\{:toc\}/g, '');

  // 4. Convert internal links to absolute
  output = output.replace(/\[([^\]]+)\]\((?!http)(\/[^)]+)\)/g,
    `[$1](${SITE_URL}$2)`);

  // 5. Simplify complex tables if needed
  // (Keep simple tables as-is, Medium can handle basic ones)

  // 6. Add lead note
  const leadNote = meta.crosspost_lead_note ||
    `> *Originally published on [AICRA Research Blog](${canonicalUrl})*\n\n---\n\n`;

  // 7. Add footer CTA
  const footerCta = `\n\n---\n\n` +
    `*This article was originally published on the [AICRA Research Blog](${canonicalUrl}). ` +
    `Follow us for more AI security research and analysis.*\n`;

  // Build Medium frontmatter-style header
  const mediumTitle = meta.title || 'Untitled';
  const mediumSubtitle = meta.description || '';

  const header = `# ${mediumTitle}\n\n` +
    (mediumSubtitle ? `## ${mediumSubtitle}\n\n` : '');

  return {
    content: header + leadNote + output + footerCta,
    canonicalUrl,
    title: mediumTitle
  };
}

function processPost(filename) {
  const filepath = path.join(POSTS_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.error(`[!] Post not found: ${filepath}`);
    return;
  }

  const raw = fs.readFileSync(filepath, 'utf-8');
  const { meta, body } = parseFrontmatter(raw);

  const { content, canonicalUrl, title } = transformForMedium(meta, body, filename);

  // Ensure output dir exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const outFile = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(outFile, content, 'utf-8');

  console.log(`[+] Generated: ${outFile}`);
  console.log(`    Title: ${title}`);
  console.log(`    Canonical: ${canonicalUrl}`);
  console.log(`    Medium Import: Use "Import a story" on Medium with the canonical URL`);
}

// Main
const targetFile = process.argv[2];

if (targetFile) {
  processPost(targetFile);
} else {
  // Process all posts
  const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
  if (files.length === 0) {
    console.log('[*] No posts found in _posts/');
    process.exit(0);
  }
  console.log(`[*] Processing ${files.length} post(s)...\n`);
  for (const file of files) {
    processPost(file);
  }
  console.log(`\n[+] Done. Medium-ready files in: ${OUTPUT_DIR}`);
}
