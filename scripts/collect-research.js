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
  // Security FOR AI (AI 시스템 보호)
  'adversarial', 'prompt injection', 'jailbreak', 'red teaming',
  'model extraction', 'data poisoning', 'backdoor', 'trojan',
  'model inversion', 'membership inference', 'evasion attack',
  'robustness', 'alignment', 'AI safety', 'LLM security',
  'agent security', 'watermark', 'model stealing',
  'adversarial example', 'adversarial training', 'certified defense',
  'differential privacy', 'federated learning attack',
  // AI FOR Security (AI를 보안에 활용)
  'malware', 'intrusion detection', 'vulnerability', 'phishing',
  'deepfake', 'cybersecurity', 'threat detection', 'anomaly detection',
  'network security', 'cyber threat intelligence', 'fraud detection',
  'spam detection', 'botnet', 'ransomware', 'APT detection',
  'SIEM', 'SOC automation', 'digital forensics', 'incident response',
  // Shared keywords
  'privacy', 'federated', 'attack', 'defense', 'threat',
  'information security', 'cyber attack', 'zero-day',
  'supply chain attack', 'code security'
];

const HF_SEARCH_QUERIES = [
  // Security for AI
  'security', 'adversarial', 'prompt injection', 'jailbreak',
  'backdoor attack', 'model extraction', 'data poisoning',
  'adversarial robustness', 'AI safety', 'red teaming',
  // AI for Security
  'malware', 'vulnerability', 'intrusion detection', 'cybersecurity',
  'phishing', 'deepfake', 'threat detection', 'anomaly detection',
  'fraud detection', 'ransomware', 'botnet detection',
  'digital forensics', 'network security'
];

const ARXIV_CATEGORIES = ['cs.CR', 'cs.AI', 'cs.LG'];

// Top journals/conferences for AI security research
const TOP_VENUES = [
  // Security top-4
  { query: 'IEEE Symposium on Security and Privacy', short: 'IEEE S&P' },
  { query: 'ACM Conference on Computer and Communications Security', short: 'CCS' },
  { query: 'USENIX Security Symposium', short: 'USENIX Security' },
  { query: 'Network and Distributed System Security', short: 'NDSS' },
  // AI top conferences
  { query: 'NeurIPS', short: 'NeurIPS' },
  { query: 'ICML', short: 'ICML' },
  { query: 'ICLR', short: 'ICLR' },
  { query: 'AAAI', short: 'AAAI' },
  { query: 'CVPR', short: 'CVPR' },
  // Security journals (SCI)
  { query: 'IEEE Transactions on Information Forensics and Security', short: 'TIFS' },
  { query: 'IEEE Transactions on Dependable and Secure Computing', short: 'TDSC' },
  { query: 'Computers & Security', short: 'COSE' },
  { query: 'Journal of Information Security and Applications', short: 'JISA' },
  // AI journals (SCI)
  { query: 'Artificial Intelligence', short: 'AIJ' },
  { query: 'Pattern Recognition', short: 'PR' },
  { query: 'IEEE Transactions on Neural Networks', short: 'TNNLS' },
  // Information security focused journals (SCI)
  { query: 'ACM Transactions on Privacy and Security', short: 'TOPS' },
  { query: 'Journal of Computer Security', short: 'JCS' },
  { query: 'International Journal of Information Security', short: 'IJIS' },
  { query: 'Security and Communication Networks', short: 'SCN' },
  { query: 'Journal of Cybersecurity', short: 'JoC' },
  { query: 'Digital Investigation', short: 'DIIN' },
  { query: 'Forensic Science International: Digital Investigation', short: 'FSI-DI' },
  // Information security conferences
  { query: 'RAID', short: 'RAID' },
  { query: 'ESORICS', short: 'ESORICS' },
  { query: 'Annual Computer Security Applications Conference', short: 'ACSAC' },
  { query: 'Detection of Intrusions and Malware', short: 'DIMVA' },
  { query: 'International Conference on Dependable Systems and Networks', short: 'DSN' },
  { query: 'IEEE European Symposium on Security and Privacy', short: 'EuroS&P' },
  { query: 'ACM Workshop on Artificial Intelligence and Security', short: 'AISec' },
  { query: 'SafeAI', short: 'SafeAI' },
  // Korean journals
  { query: 'Journal of the Korea Institute of Information Security', short: 'KIISC' },
  { query: 'ETRI Journal', short: 'ETRI' },
  { query: 'Korean Institute of Information Scientists', short: 'KIISE' },
  { query: 'Korea Information Processing Society', short: 'KIPS' },
  { query: 'Journal of Information Security', short: 'JIS-KR' },
  // Chinese/Asian journals and conferences
  { query: 'Science China Information Sciences', short: 'SCIS' },
  { query: 'Journal of Computer Science and Technology', short: 'JCST' },
  { query: 'Chinese Journal of Electronics', short: 'CJE' },
  { query: 'ACM ASIA Conference on Computer and Communications Security', short: 'ASIACCS' },
  { query: 'International Conference on Information and Communications Security', short: 'ICICS' },
];

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
    'ti:data+poisoning',
    'ti:deepfake+detection',
    'ti:federated+learning+attack',
    'ti:adversarial+robustness+AND+cat:cs.LG',
    'ti:AI+agent+security',
    'ti:RAG+attack',
    'ti:cybersecurity+AND+cat:cs.CR',
    // AI for Security queries
    'ti:anomaly+detection+AND+cat:cs.CR',
    'ti:threat+detection+AND+cat:cs.CR',
    'ti:phishing+detection',
    'ti:ransomware+AND+cat:cs.CR',
    'ti:network+intrusion+AND+cat:cs.CR',
    'ti:digital+forensics+AND+cat:cs.CR',
    'ti:fraud+detection+AND+cat:cs.AI',
    // Security for AI additional
    'ti:model+inversion+attack',
    'ti:membership+inference',
    'ti:differential+privacy+AND+cat:cs.LG',
    'ti:adversarial+patch',
    'ti:supply+chain+attack'
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

// === TOP JOURNAL/CONFERENCE PAPER COLLECTION (Semantic Scholar) ===
async function collectTopVenuePapers(existing) {
  const existingTitles = new Set(existing.map(p => normalize(p.title)));
  const existingDois = new Set(existing.map(p => p.doi).filter(Boolean));
  const newPapers = [];

  for (const venue of TOP_VENUES) {
    // Search each venue with security keywords
    // Both "AI for Security" and "Security for AI" queries
    const secQueries = [
      'adversarial', 'security', 'attack', 'privacy', 'malware', 'backdoor',
      'intrusion detection', 'vulnerability', 'deepfake', 'robustness',
      'phishing', 'threat detection'
    ];
    for (const kw of secQueries) {
      console.log(`  [S2] ${venue.short}: ${kw}`);
      const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(kw)}&venue=${encodeURIComponent(venue.query)}&year=2024-2026&limit=10&fields=title,authors,year,venue,citationCount,externalIds,abstract,url`;
      const data = await fetchJSON(url);
      if (!data || !data.data) { await sleep(1500); continue; }

      for (const p of data.data) {
        if (!p.title) continue;
        if (existingTitles.has(normalize(p.title))) continue;
        const doi = p.externalIds?.DOI || '';
        if (doi && existingDois.has(doi)) continue;
        const arxivId = p.externalIds?.ArXiv || '';

        const abstract = (p.abstract || '').substring(0, 500);
        const score = relevanceScore(p.title + ' ' + abstract);
        if (score < 15) continue; // Lower threshold for top venues (already high quality)

        const authors = (p.authors || []).map(a => a.name).slice(0, 10);

        newPapers.push({
          id: (doi || arxivId || normalize(p.title).substring(0, 30)).replace(/[./]/g, '-'),
          title: p.title,
          authors: authors,
          abstract: abstract,
          year: p.year || new Date().getFullYear(),
          venue: venue.short,
          arxiv_id: arxivId,
          doi: doi,
          semantic_scholar_id: p.paperId || '',
          url: p.url || (doi ? `https://doi.org/${doi}` : ''),
          pdf_url: arxivId ? `https://arxiv.org/pdf/${arxivId}` : '',
          categories: [],
          keywords: [],
          relevance_score: score + 20, // Bonus for top venue
          match_reasons: SECURITY_KEYWORDS.filter(k => (p.title + ' ' + abstract).toLowerCase().includes(k)),
          published_at: '',
          updated_at: '',
          discovered_from: ['semantic-scholar', venue.short],
          last_checked: new Date().toISOString()
        });
        existingTitles.add(normalize(p.title));
        if (doi) existingDois.add(doi);
      }
      await sleep(1500); // Semantic Scholar: ~100 req/5min
    }
  }

  return newPapers;
}

// === HIGH-CITATION PAPER COLLECTION (Semantic Scholar) ===
async function collectHighCitationPapers(existing) {
  const existingTitles = new Set(existing.map(p => normalize(p.title)));
  const newPapers = [];

  // AI security domain queries sorted by citation count
  const hiCiteQueries = [
    'adversarial examples', 'adversarial attacks deep learning',
    'prompt injection LLM', 'jailbreak language model',
    'data poisoning machine learning', 'backdoor attack neural network',
    'model extraction attack', 'membership inference attack',
    'federated learning privacy', 'differential privacy deep learning',
    'malware detection deep learning', 'intrusion detection machine learning',
    'deepfake detection', 'adversarial robustness',
    'AI safety alignment', 'red teaming language model',
    'network anomaly detection', 'vulnerability detection AI',
    'phishing detection machine learning', 'ransomware detection',
    'cyber threat intelligence', 'digital forensics machine learning'
  ];

  for (const query of hiCiteQueries) {
    console.log(`  [HiCite] ${query}`);
    // Sort by citationCount descending via relevance (S2 default is relevance, but high-cited papers rank high)
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=5&fields=title,authors,year,venue,citationCount,externalIds,abstract,url&year=2018-2026`;
    const data = await fetchJSON(url);
    if (!data || !data.data) { await sleep(2000); continue; }

    // Filter for high citation papers only
    const highCited = (data.data || []).filter(p => (p.citationCount || 0) >= 50);
    for (const p of highCited) {
      if (!p.title || existingTitles.has(normalize(p.title))) continue;
      const doi = p.externalIds?.DOI || '';
      const arxivId = p.externalIds?.ArXiv || '';
      const abstract = (p.abstract || '').substring(0, 500);
      const authors = (p.authors || []).map(a => a.name).slice(0, 10);

      newPapers.push({
        id: (doi || arxivId || normalize(p.title).substring(0, 30)).replace(/[./]/g, '-'),
        title: p.title,
        authors: authors,
        abstract: abstract,
        year: p.year || 0,
        venue: p.venue || '',
        arxiv_id: arxivId,
        doi: doi,
        semantic_scholar_id: p.paperId || '',
        url: p.url || '',
        pdf_url: arxivId ? `https://arxiv.org/pdf/${arxivId}` : '',
        categories: [],
        keywords: [],
        citation_count: p.citationCount || 0,
        relevance_score: Math.min(100, 50 + Math.floor((p.citationCount || 0) / 10)),
        match_reasons: ['high-citation', query],
        published_at: '',
        updated_at: '',
        discovered_from: ['semantic-scholar', 'high-citation'],
        last_checked: new Date().toISOString()
      });
      existingTitles.add(normalize(p.title));
    }
    await sleep(2000);
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

  // Collect papers (arXiv)
  console.log('\n--- Collecting Papers (arXiv) ---');
  const newArxiv = await collectArxivPapers(papers);
  console.log(`  Found ${newArxiv.length} new arXiv papers`);

  // Collect papers (Top journals/conferences via Semantic Scholar)
  console.log('\n--- Collecting Papers (Top Venues) ---');
  const allPapersSoFar = [...papers, ...newArxiv];
  const newVenue = await collectTopVenuePapers(allPapersSoFar);
  console.log(`  Found ${newVenue.length} new top venue papers`);

  // Collect high-citation papers
  console.log('\n--- Collecting High-Citation Papers ---');
  const allPapersNow = [...papers, ...newArxiv, ...newVenue];
  const newHiCite = await collectHighCitationPapers(allPapersNow);
  console.log(`  Found ${newHiCite.length} new high-citation papers`);

  const newPapers = [...newArxiv, ...newVenue, ...newHiCite];

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
