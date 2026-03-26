#!/usr/bin/env node
/**
 * AICRA Research Collector - Auto-collect AI security datasets + papers
 * Runs weekly via GitHub Actions or manually via: node scripts/collect-research.js
 *
 * Sources: HuggingFace Datasets API, arXiv API, Semantic Scholar API
 * Output: assets/data/datasets.json, assets/data/papers.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// === CONFIG ===
const DATASETS_PATH = path.join(__dirname, '..', 'assets', 'data', 'datasets.json');
const PAPERS_PATH = path.join(__dirname, '..', 'assets', 'data', 'papers.json');

const SECURITY_KEYWORDS = [
  'adversarial', 'prompt injection', 'jailbreak', 'red teaming',
  'model extraction', 'data poisoning', 'backdoor', 'malware',
  'intrusion detection', 'vulnerability', 'privacy', 'federated',
  'AI safety', 'LLM security', 'agent security', 'alignment',
  'deepfake', 'phishing', 'cybersecurity', 'threat', 'attack',
  'robustness', 'evasion', 'trojan', 'watermark'
];

const HF_SEARCH_QUERIES = [
  'security', 'adversarial', 'malware', 'prompt injection',
  'jailbreak', 'vulnerability', 'intrusion detection', 'cybersecurity'
];

const ARXIV_CATEGORIES = ['cs.CR', 'cs.AI', 'cs.LG'];

// === UTILS ===
function fetchJSON(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: { 'User-Agent': 'AICRA-Research-Collector/1.0', ...opts.headers },
      timeout: 15000
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: { 'User-Agent': 'AICRA-Research-Collector/1.0' },
      timeout: 15000
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function normalize(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function relevanceScore(text) {
  const lower = (text || '').toLowerCase();
  let score = 0;
  for (const kw of SECURITY_KEYWORDS) {
    if (lower.includes(kw)) score += 15;
  }
  return Math.min(score, 100);
}

// === DATASET COLLECTION ===
async function collectHuggingFaceDatasets(existing) {
  const existingNames = new Set(existing.map(d => normalize(d.name)));
  const newDatasets = [];

  for (const query of HF_SEARCH_QUERIES) {
    console.log(`  [HF] Searching: ${query}`);
    const data = await fetchJSON(`https://huggingface.co/api/datasets?search=${encodeURIComponent(query)}&sort=downloads&limit=20`);
    if (!data || !Array.isArray(data)) continue;

    for (const d of data) {
      const name = d.id.split('/').pop();
      if (existingNames.has(normalize(name))) continue;
      if (existingNames.has(normalize(d.id))) continue;

      const desc = `HuggingFace dataset: ${d.id}`;
      const score = relevanceScore(d.id + ' ' + (d.tags || []).join(' '));
      if (score < 30) continue;

      newDatasets.push({
        id: d.id.replace(/\//g, '-').toLowerCase(),
        name: name,
        description: desc,
        domain: [],
        source: 'HuggingFace',
        url: `https://huggingface.co/datasets/${d.id}`,
        size: '',
        license: (d.tags || []).find(t => t.startsWith('license:'))?.replace('license:', '') || '',
        year: new Date().getFullYear(),
        tags: (d.tags || []).filter(t => !t.startsWith('license:') && !t.startsWith('size_')).slice(0, 8),
        format: 'Parquet',
        papers_count: 0,
        threat_type: '',
        discovered_from: ['huggingface'],
        relevance_score: score,
        last_checked: new Date().toISOString()
      });
      existingNames.add(normalize(name));
    }
    await sleep(1000);
  }

  return newDatasets;
}

// === PAPER COLLECTION ===
async function collectArxivPapers(existing) {
  const existingIds = new Set(existing.map(p => p.arxiv_id).filter(Boolean));
  const existingTitles = new Set(existing.map(p => normalize(p.title)));
  const newPapers = [];

  // Search recent AI security papers from arXiv
  const queries = [
    'ti:adversarial+AND+cat:cs.CR',
    'ti:prompt+injection+AND+cat:cs.CR',
    'ti:jailbreak+AND+cat:cs.AI',
    'ti:LLM+security',
    'ti:AI+safety+AND+cat:cs.AI',
    'ti:malware+detection+AND+cat:cs.CR',
    'ti:intrusion+detection+AND+cat:cs.CR',
    'ti:backdoor+attack+AND+cat:cs.LG',
    'ti:model+extraction',
    'ti:data+poisoning'
  ];

  for (const query of queries) {
    console.log(`  [arXiv] Searching: ${query}`);
    const xml = await fetchText(`https://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&start=0&max_results=15&sortBy=submittedDate&sortOrder=descending`);
    if (!xml) continue;

    // Simple XML parsing for arXiv Atom feed
    const entries = xml.split('<entry>').slice(1);
    for (const entry of entries) {
      const getTag = (tag) => {
        const m = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
        return m ? m[1].trim() : '';
      };
      const title = getTag('title').replace(/\s+/g, ' ');
      const abstract = getTag('summary').replace(/\s+/g, ' ').substring(0, 500);
      const published = getTag('published');
      const updated = getTag('updated');

      // Extract arxiv ID from <id> tag
      const idMatch = entry.match(/<id>https?:\/\/arxiv\.org\/abs\/([^<]+)<\/id>/);
      const arxivId = idMatch ? idMatch[1].replace(/v\d+$/, '') : '';

      if (!arxivId || existingIds.has(arxivId)) continue;
      if (existingTitles.has(normalize(title))) continue;

      // Extract authors
      const authorMatches = [...entry.matchAll(/<author>\s*<name>([^<]+)<\/name>/g)];
      const authors = authorMatches.map(m => m[1].trim());

      // Extract categories
      const catMatches = [...entry.matchAll(/term="([^"]+)"/g)];
      const categories = catMatches.map(m => m[1]).filter(c => c.startsWith('cs.'));

      const score = relevanceScore(title + ' ' + abstract);
      if (score < 30) continue;

      const year = published ? parseInt(published.substring(0, 4)) : new Date().getFullYear();

      newPapers.push({
        id: arxivId.replace(/[./]/g, '-'),
        title: title,
        authors: authors.slice(0, 10),
        abstract: abstract,
        year: year,
        venue: '',
        arxiv_id: arxivId,
        doi: '',
        semantic_scholar_id: '',
        url: `https://arxiv.org/abs/${arxivId}`,
        pdf_url: `https://arxiv.org/pdf/${arxivId}`,
        categories: categories,
        keywords: [],
        relevance_score: score,
        match_reasons: SECURITY_KEYWORDS.filter(kw => (title + ' ' + abstract).toLowerCase().includes(kw)),
        published_at: published,
        updated_at: updated,
        discovered_from: ['arxiv'],
        last_checked: new Date().toISOString()
      });
      existingIds.add(arxivId);
      existingTitles.add(normalize(title));
    }
    await sleep(3000); // arXiv rate limit: 1 req/3s
  }

  return newPapers;
}

// === MAIN ===
async function main() {
  console.log('=== AICRA Research Collector ===');
  console.log(`Time: ${new Date().toISOString()}`);

  // Load existing data
  let datasets = [];
  try { datasets = JSON.parse(fs.readFileSync(DATASETS_PATH, 'utf8')); } catch (e) { console.log('No existing datasets.json'); }

  let papers = [];
  try { papers = JSON.parse(fs.readFileSync(PAPERS_PATH, 'utf8')); } catch (e) { console.log('No existing papers.json, creating new'); }

  console.log(`\nExisting: ${datasets.length} datasets, ${papers.length} papers`);

  // Collect datasets
  console.log('\n--- Collecting Datasets ---');
  const newDatasets = await collectHuggingFaceDatasets(datasets);
  console.log(`  Found ${newDatasets.length} new datasets`);

  // Collect papers
  console.log('\n--- Collecting Papers ---');
  const newPapers = await collectArxivPapers(papers);
  console.log(`  Found ${newPapers.length} new papers`);

  // Merge
  if (newDatasets.length > 0) {
    datasets.push(...newDatasets);
    datasets.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
    fs.writeFileSync(DATASETS_PATH, JSON.stringify(datasets, null, 2), 'utf8');
    console.log(`\nDatasets updated: ${datasets.length} total`);
  }

  if (newPapers.length > 0) {
    papers.push(...newPapers);
    papers.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
    fs.writeFileSync(PAPERS_PATH, JSON.stringify(papers, null, 2), 'utf8');
    console.log(`Papers updated: ${papers.length} total`);
  }

  // Summary
  console.log('\n=== Collection Complete ===');
  console.log(`Datasets: +${newDatasets.length} (total ${datasets.length})`);
  console.log(`Papers: +${newPapers.length} (total ${papers.length})`);

  if (newDatasets.length === 0 && newPapers.length === 0) {
    console.log('No new items found. No changes to commit.');
  }
}

main().catch(e => { console.error('Collector error:', e); process.exit(1); });
