#!/usr/bin/env node
/**
 * Frontmatter Validation Script
 * Validates all posts against _data/schema.yml requirements.
 * Used in CI/CD pipeline (GitHub Actions) and local development.
 *
 * Usage: node scripts/validate-frontmatter.js
 * Exit code 0 = all valid, 1 = errors found
 */

const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, '..', '_posts');
const REQUIRED_FIELDS = ['title', 'description', 'date', 'categories', 'tags', 'author'];
const VALID_CATEGORIES = ['Research', 'Analysis', 'Tutorial', 'News'];
const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];

function parseFrontmatter(content) {
  const match = content.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const fm = {};
  const lines = match[1].split('\n');
  let currentKey = null;
  let inArray = false;

  for (const line of lines) {
    const keyMatch = line.match(/^(\w[\w_-]*)\s*:\s*(.*)/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      const value = keyMatch[2].trim();

      if (value.startsWith('[') && value.endsWith(']')) {
        fm[currentKey] = value.slice(1, -1).split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
        inArray = false;
      } else if (value === '' || value === '|' || value === '>') {
        fm[currentKey] = [];
        inArray = true;
      } else {
        fm[currentKey] = value.replace(/['"]/g, '');
        inArray = false;
      }
    } else if (inArray && line.match(/^\s+-\s+(.*)/)) {
      const item = line.match(/^\s+-\s+(.*)/)[1].trim().replace(/['"]/g, '');
      if (!Array.isArray(fm[currentKey])) fm[currentKey] = [];
      fm[currentKey].push(item);
    }
  }
  return fm;
}

function validatePost(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fm = parseFrontmatter(content);
  const filename = path.basename(filePath);
  const errors = [];

  if (!fm) {
    errors.push(`${filename}: No frontmatter found`);
    return errors;
  }

  // Required fields
  for (const field of REQUIRED_FIELDS) {
    if (!fm[field] || (Array.isArray(fm[field]) && fm[field].length === 0)) {
      errors.push(`${filename}: Missing required field '${field}'`);
    }
  }

  // Date format
  if (fm.date && !/^\d{4}-\d{2}-\d{2}/.test(fm.date)) {
    errors.push(`${filename}: Invalid date format '${fm.date}' (expected YYYY-MM-DD)`);
  }

  // Severity validation
  if (fm.severity && !VALID_SEVERITIES.includes(fm.severity)) {
    errors.push(`${filename}: Invalid severity '${fm.severity}' (allowed: ${VALID_SEVERITIES.join(', ')})`);
  }

  // Word count check
  const bodyContent = content.replace(/^---[\s\S]*?---/, '').trim();
  const wordCount = bodyContent.split(/\s+/).length;
  if (wordCount < 500) {
    errors.push(`${filename}: Post too short (${wordCount} words, minimum 500)`);
  }

  return errors;
}

// Main
const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
let allErrors = [];

console.log(`[*] Validating ${files.length} posts...`);

for (const file of files) {
  const errors = validatePost(path.join(POSTS_DIR, file));
  if (errors.length > 0) {
    allErrors = allErrors.concat(errors);
  } else {
    console.log(`  [+] ${file}: OK`);
  }
}

if (allErrors.length > 0) {
  console.log('\n[-] Validation errors:');
  allErrors.forEach(e => console.log(`  [-] ${e}`));
  process.exit(1);
} else {
  console.log(`\n[+] All ${files.length} posts valid.`);
  process.exit(0);
}
