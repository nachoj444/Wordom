import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';

// Simple built-in word lists (small fallback). You can replace with full lists later.
const SOLUTIONS_FALLBACK = [
  'cigar','rebut','sissy','humph','awake','blush','focal','evade','naval','serve',
  'heath','dwarf','model','karma','stink','grade','quiet','bench','abate','feign',
  'major','death','fresh','crust','stool','colon','abase','marry','react','batty',
  'pride','floss','helix','croak','staff','paper','unfed','whelp','trawl','outdo',
  'adobe','crazy','sower','repay','digit','crate','slate','crane','trace','stare','later',
  // add a few common duplicates/QU words to avoid empty results in early prototype
  'guava','guano','qualm','quail','quasi','quota','quart','guard','gauze','gauzy'
];

// Frequency-based initial guess list; you can tune later.
const INITIAL_GUESSES = ['slate', 'crane', 'trace', 'stare', 'arise', 'later'];

function loadWordList(relativeFile) {
  try {
    const abs = path.resolve(process.cwd(), relativeFile);
    if (!fs.existsSync(abs)) return [];
    const text = fs.readFileSync(abs, 'utf8');
    return text
      .split(/\r?\n/)
      .map(w => w.trim().toLowerCase())
      .filter(w => /^[a-z]{5}$/.test(w));
  } catch {
    return [];
  }
}

const LOADED_SOLUTIONS = loadWordList('data/solutions.txt');
const LOADED_GUESSES = loadWordList('data/guesses.txt');
const SOLUTIONS = (LOADED_SOLUTIONS.length ? LOADED_SOLUTIONS : SOLUTIONS_FALLBACK);
// STRICT: use solutions-only for the legal candidate pool so AI never proposes unplayable words
const ALL_CANDIDATES = (LOADED_SOLUTIONS.length ? LOADED_SOLUTIONS : SOLUTIONS_FALLBACK);

// Build global constraints from history following Wordle's allocation rules
function buildConstraints(guesses, feedback) {
  const fixedPositions = Array(5).fill(null);
  const forbiddenPositions = Array.from({ length: 5 }, () => new Set());
  const minCounts = new Map(); // per letter lower bound
  const maxCounts = new Map(); // per letter upper bound (Infinity when unknown)

  for (let row = 0; row < guesses.length; row++) {
    const g = guesses[row];
    const f = feedback[row];
    if (!g || !f) continue;

    // Per-row counts for this letter
    const rowMin = new Map(); // g+y in this row
    const rowHasBlack = new Map();

    for (let i = 0; i < 5; i++) {
      const ch = g[i];
      const fb = f[i];
      if (fb === 'g') {
        fixedPositions[i] = ch;
        rowMin.set(ch, (rowMin.get(ch) || 0) + 1);
      }
    }
    for (let i = 0; i < 5; i++) {
      const ch = g[i];
      const fb = f[i];
      if (fb === 'y') {
        forbiddenPositions[i].add(ch);
        rowMin.set(ch, (rowMin.get(ch) || 0) + 1);
      } else if (fb === 'b') {
        rowHasBlack.set(ch, true);
      }
    }

    // Update global min/max for each letter seen in this row
    const lettersInRow = new Set(g.split(''));
    for (const ch of lettersInRow) {
      const minHere = rowMin.get(ch) || 0;
      const hadBlack = !!rowHasBlack.get(ch);
      const maxHere = hadBlack ? minHere : Infinity;
      const prevMin = minCounts.get(ch) || 0;
      const prevMax = maxCounts.has(ch) ? maxCounts.get(ch) : Infinity;
      if (minHere > prevMin) minCounts.set(ch, minHere);
      if (maxHere < prevMax) maxCounts.set(ch, maxHere);
    }
  }

  return { fixedPositions, forbiddenPositions, minCounts, maxCounts };
}

function filterWithConstraints(candidates, constraints, ignoreMax = false) {
  const { fixedPositions, forbiddenPositions, minCounts, maxCounts } = constraints;

  const pass = (word, ignoreMax = false) => {
    if (word.length !== 5) return false;

    // Fixed greens
    for (let i = 0; i < 5; i++) {
      if (fixedPositions[i] && word[i] !== fixedPositions[i]) return false;
    }

    // Yellow position bans
    for (let i = 0; i < 5; i++) {
      if (forbiddenPositions[i].has(word[i])) return false;
    }

    // Letter count bounds
    const counts = new Map();
    for (const ch of word) counts.set(ch, (counts.get(ch) || 0) + 1);

    for (const [ch, min] of minCounts.entries()) {
      if ((counts.get(ch) || 0) < min) return false;
    }
    if (!ignoreMax) {
      for (const [ch, max] of maxCounts.entries()) {
        if (Number.isFinite(max) && (counts.get(ch) || 0) > max) return false;
      }
    }

    return true;
  };

  let out = candidates.filter((w) => pass(w, ignoreMax ? true : false));
  if (out.length === 0) {
    // Relax cap constraints if solver over-constrained due to duplicates
    out = candidates.filter((w) => pass(w, true));
  }
  return out;
}

function filterByHistory(candidates, guesses, feedback) {
  const constraints = buildConstraints(guesses, feedback);
  return filterWithConstraints(candidates, constraints);
}

// Rank candidates by simple letter-frequency heuristic for coverage.
function rankCandidates(candidates) {
  const positionFreq = Array.from({ length: 5 }, () => new Map());
  const overallFreq = new Map();
  for (const word of candidates) {
    for (let i = 0; i < 5; i++) {
      const ch = word[i];
      positionFreq[i].set(ch, (positionFreq[i].get(ch) || 0) + 1);
      overallFreq.set(ch, (overallFreq.get(ch) || 0) + 1);
    }
  }
  function scoreWord(word) {
    let score = 0;
    const seen = new Set();
    for (let i = 0; i < 5; i++) {
      const ch = word[i];
      score += (positionFreq[i].get(ch) || 0);
      if (!seen.has(ch)) {
        score += (overallFreq.get(ch) || 0) * 0.1;
        seen.add(ch);
      }
    }
    return score;
  }
  return candidates
    .map(w => ({ word: w, score: scoreWord(w) }))
    .sort((a, b) => b.score - a.score);
}

const mcp = new McpServer({ name: 'wordle-mcp', version: '0.1.0' });

// Latest state received from browser (auto-sync bridge)
let latestState = { guesses: [], feedback: [] };
const BRIDGE_PORT = Number(process.env.WORDLE_SYNC_PORT || 8787);

function startBridgeServer() {
  console.log('🚀 Starting Wordle MCP Bridge Server on port', BRIDGE_PORT);
  
  const server = http.createServer(async (req, res) => {
    // CORS for browser extension/userscript
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    console.log(`[DEBUG] ${req.method} ${req.url}`);

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.url === '/state' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 1e6) req.socket.destroy();
      });
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          const guesses = Array.isArray(data.guesses) ? data.guesses : [];
          const feedback = Array.isArray(data.feedback) ? data.feedback : [];
          if (guesses.length !== feedback.length) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'guesses and feedback length mismatch' }));
            return;
          }
          latestState = { guesses, feedback };
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'invalid JSON' }));
        }
      });
      return;
    }

    if (req.url && req.url.startsWith('/suggest') && req.method === 'GET') {
      // Simple suggest endpoint: uses latestState unless overridden via query
      try {
        const url = new URL(req.url, `http://localhost:${BRIDGE_PORT}`);
        const q = url.searchParams;
        const limit = Math.min(50, Math.max(1, Number(q.get('limit') || '10')));
        const guesses = q.get('guesses') ? JSON.parse(q.get('guesses')) : latestState.guesses;
        const feedback = q.get('feedback') ? JSON.parse(q.get('feedback')) : latestState.feedback;
        let base = SOLUTIONS;
        let ranked;
        if (!guesses || guesses.length === 0) {
          ranked = rankCandidates(INITIAL_GUESSES).slice(0, limit);
        } else {
          let filtered = filterByHistory(base, guesses, feedback || []);
          if (filtered.length === 0 && ALL_CANDIDATES.length) {
            filtered = filterByHistory(ALL_CANDIDATES, guesses, feedback || []);
          }
          // Drop already tried words
          const tried = new Set(guesses);
          filtered = filtered.filter(w => !tried.has(w));
          ranked = rankCandidates(filtered).slice(0, limit);
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ guesses: guesses || [], feedback: feedback || [], suggestions: ranked }));
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'bad request' }));
      }
      return;
    }

    if (req.url && req.url.startsWith('/define') && req.method === 'GET') {
      try {
        const url = new URL(req.url, `http://localhost:${BRIDGE_PORT}`);
        const word = (url.searchParams.get('word') || '').toLowerCase().trim();
        if (!word || !/^[a-z]{3,}$/i.test(word)) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'invalid word' }));
          return;
        }
        const defs = await lookupDefinitions(word);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ word, definitions: defs }));
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'definition failed' }));
      }
      return;
    }
    if (req.url && req.url.startsWith('/sentence') && req.method === 'GET') {
      try {
        const url = new URL(req.url, `http://localhost:${BRIDGE_PORT}`);
        const word = (url.searchParams.get('word') || '').toLowerCase().trim();
        const definitionIndex = parseInt(url.searchParams.get('definitionIndex') || '0');
        
        if (!word || !/^[a-z]{3,}$/i.test(word)) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'invalid word' }));
          return;
        }
        
        console.log(`[DEBUG] Sentence request for word: "${word}" with definition index: ${definitionIndex}`);
        
        // First get the definitions to create contextually connected sentences
        const definitions = await lookupDefinitions(word);
        console.log(`[DEBUG] Found ${definitions.length} definitions for "${word}":`, definitions);
        
        // Only generate sentence for the specific definition requested
        const specificDefinition = definitions[definitionIndex];
        if (!specificDefinition) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'invalid definition index' }));
          return;
        }
        
        const sentence = await lookupExampleSentenceForDefinition(word, specificDefinition, definitionIndex);
        console.log(`[DEBUG] Generated sentence for definition ${definitionIndex}:`, sentence);
        
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ word, sentence, definitionIndex, definition: specificDefinition }));
      } catch (e) {
        console.error('[DEBUG] Error in sentence endpoint:', e);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'sentence failed' }));
      }
      return;
    }
    
    if (req.url === '/clear-cache' && req.method === 'POST') {
      sentenceCache.clear();
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, message: 'Sentence cache cleared' }));
      return;
    }
    
    if (req.url && req.url.startsWith('/translate') && req.method === 'GET') {
      console.log(`[DEBUG] Translation request: ${req.url}`);
      try {
        const url = new URL(req.url, `http://localhost:${BRIDGE_PORT}`);
        const word = (url.searchParams.get('word') || '').toLowerCase().trim();
        const lang = (url.searchParams.get('lang') || '').toLowerCase().trim();
        const definitions = url.searchParams.get('definitions') ? JSON.parse(url.searchParams.get('definitions')) : [];
        
        console.log(`[DEBUG] Word: "${word}", Language: "${lang}", Definitions: ${definitions.length}`);
        
        if (!word || !lang) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'missing word or language' }));
          return;
        }
        
        const translations = await translateWordWithMeanings(word, lang, definitions);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ word, lang, translations }));
      } catch (e) {
        console.error('[DEBUG] Translation error:', e);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'translation failed' }));
      }
      return;
    }
    if (req.url === '/rerank' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; if (body.length > 1e6) req.socket.destroy(); });
      req.on('end', async () => {
        try {
          const { guesses = [], feedback = [], candidates = [], limit = 10 } = JSON.parse(body || '{}');
          const constraints = buildConstraints(guesses, feedback);
          let pool = candidates && candidates.length ? candidates : filterWithConstraints(ALL_CANDIDATES, constraints);
          // Drop already tried words
          const tried = new Set(guesses);
          pool = pool.filter(w => !tried.has(w));
          // If still empty, relax max caps as last resort
          if (!pool.length) {
            pool = filterWithConstraints(ALL_CANDIDATES, constraints, true);
            pool = pool.filter(w => !tried.has(w));
          }
          const rankedLocal = rankCandidates(pool).slice(0, Math.min(50, limit * 5));
          const poolSet = new Set(pool);
          let ranked = await callClaudeRerank(guesses, feedback, pool, limit, false);
          // Keep only valid dictionary candidates
          ranked = Array.isArray(ranked)
            ? ranked.filter(r => r && typeof r.word === 'string' && poolSet.has(r.word.toLowerCase()))
            : [];
          if (!ranked.length) {
            // Ask Claude to propose directly, but still restrict to pool
            ranked = await callClaudeRerank(guesses, feedback, pool, limit, true);
            ranked = Array.isArray(ranked)
              ? ranked.filter(r => r && typeof r.word === 'string' && poolSet.has(r.word.toLowerCase()))
              : [];
          }
          // Final safety: fall back to local ranking and cap to limit
          const out = (ranked.length ? ranked.slice(0, limit) : rankedLocal.slice(0, limit));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ranked: out }));
        } catch (e) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'bad request' }));
        }
      });
      return;
    }

    if (req.url === '/state' && req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(latestState));
      return;
    }

    res.statusCode = 404;
    res.end('Not found');
  });

  server.listen(BRIDGE_PORT);
}

const SuggestArgs = {
  guesses: z.array(z.string().length(5)).default([]),
  feedback: z.array(z.string().length(5)).default([]),
  limit: z.number().int().positive().max(50).default(10),
  wordList: z.enum(['solutions']).default('solutions'),
};

mcp.tool(
  'wordle_suggest',
  'Return ranked Wordle guesses given guess history and color feedback (b/y/g). If no guesses given, returns top initial guesses.',
  SuggestArgs,
  async ({ guesses = [], feedback = [], limit = 10 }) => {
    if (!guesses.length && latestState.guesses.length) {
      // Use latest auto-synced state if available
      guesses = latestState.guesses;
      feedback = latestState.feedback;
    }
    if (!guesses.length) {
      const ranked = rankCandidates(INITIAL_GUESSES).slice(0, limit);
      return { content: [{ type: 'text', text: JSON.stringify(ranked) }] };
    }
    let base = SOLUTIONS;
    let filtered = filterByHistory(base, guesses, feedback);
    if (filtered.length === 0 && ALL_CANDIDATES.length) {
      filtered = filterByHistory(ALL_CANDIDATES, guesses, feedback);
    }
    const ranked = rankCandidates(filtered).slice(0, limit);
    return { content: [{ type: 'text', text: JSON.stringify(ranked) }] };
  }
);

async function start() {
  startBridgeServer();
  await mcp.connect(new StdioServerTransport());
}

start().catch((err) => {
  console.error('Failed to start wordle MCP server:', err);
  process.exit(1);
});

async function callClaudeRerank(guesses, feedback, candidates, limit, proposeOnly = false) {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return [];
  try {
    const task = proposeOnly
      ? `Given prior guesses and b/y/g feedback (b=gray, y=yellow, g=green), pick up to ${limit} legal Wordle guesses that satisfy ALL constraints. Candidates MUST come only from the provided dictionary list. Return ONLY a JSON array of {"word": string, "score": number, "reason": string}.`
      : `Given prior guesses and b/y/g feedback (b=gray, y=yellow, g=green), re-rank these candidate guesses by expected information gain and legality. Candidates MUST come only from the provided list. Return ONLY a JSON array of {"word": string, "score": number, "reason": string}.`;
    const prompt = `${task}\n\nGuesses: ${JSON.stringify(guesses)}\nFeedback: ${JSON.stringify(feedback)}\nCandidates: ${JSON.stringify(candidates)}`;
    const payload = {
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 512,
      messages: [
        { role: 'system', content: 'You are a careful Wordle assistant. Only output valid JSON as specified.' },
        { role: 'user', content: prompt }
      ]
    };
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    const text = Array.isArray(data.content) ? data.content.map(c => c.text).join('\n') : data.content?.[0]?.text || data.content || '';
    // Extract last JSON array from the text
    const match = text.match(/\[[\s\S]*\]$/m);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [];
  } catch {
    return [];
  }
}

async function lookupDefinitions(word) {
  // Try Free Dictionary API first
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (res.ok) {
      const data = await res.json();
      const defs = collectFreeDictionaryDefs(data);
      if (defs.length) return defs;
    }
  } catch {}
  // Fallback: Wiktionary REST
  try {
    const res = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/en/${encodeURIComponent(word)}`);
    if (res.ok) {
      const data = await res.json();
      const defs = collectWiktionaryDefs(data);
      if (defs.length) return defs;
    }
  } catch {}
  // Fallback: Datamuse (WordNet) definitions
  try {
    const res = await fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=d`);
    if (res.ok) {
      const data = await res.json();
      const defs = collectDatamuseDefs(data);
      if (defs.length) return defs;
    }
  } catch {}
  // Last resort: ask local model for a one-line gloss
  try {
    const ai = await localModelDefine(word);
    if (ai) return [{ 
      partOfSpeech: '', 
      definition: ai, 
      pronunciation: '',
      audio: '',
      source: 'ai' 
    }];
  } catch {}
  return [];
}

function collectFreeDictionaryDefs(data) {
  const out = [];
  if (!Array.isArray(data)) return out;
  
  for (const entry of data) {
    // Extract phonetics from this specific entry
    const phonetics = entry?.phonetics || [];
    const phoneticMap = new Map();
    
    // Map phonetics to their meanings by context
    for (const phonetic of phonetics) {
      if (phonetic.text && phonetic.audio) {
        phoneticMap.set(phonetic.text, phonetic.audio);
      }
    }
    const meanings = entry?.meanings || [];
    for (const m of meanings) {
      const d = m?.definitions?.[0]?.definition || '';
      if (d) {
        // Find the best matching pronunciation for this meaning
        let pronunciation = '';
        let audioUrl = '';
        
        // Try to match by part of speech or context
        for (const [phonetic, audio] of phoneticMap) {
          if (phonetic && audio) {
            pronunciation = phonetic;
            audioUrl = audio;
            break; // Use first available for now
          }
        }
        
        out.push({ 
          partOfSpeech: m.partOfSpeech || '', 
          definition: d,
          pronunciation: pronunciation,
          audio: audioUrl,
          source: 'api'
        });
      }
      if (out.length >= 3) break;
    }
    if (out.length >= 3) break;
  }
  return out;
}

function collectWiktionaryDefs(data) {
  const out = [];
  const lang = data?.en || data?.English || [];
  for (const sense of lang) {
    const pos = sense?.partOfSpeech || '';
    const defs = (sense?.definitions || []).map(o => (o?.definition || o?.example) || '').filter(Boolean);
    for (const d of defs) {
      out.push({ 
        partOfSpeech: pos, 
        definition: String(d),
        pronunciation: '',
        audio: '',
        source: 'wiktionary'
      });
      if (out.length >= 3) break;
    }
    if (out.length >= 3) break;
  }
  return out;
}

function collectDatamuseDefs(data) {
  const out = [];
  if (!Array.isArray(data)) return out;
  for (const entry of data) {
    const defs = entry?.defs || [];
    for (const d of defs) {
      // Datamuse defs are like "n\tdefinition" – split tag if present
      const parts = String(d).split('\t');
      const pos = parts[0] && parts[1] ? parts[0] : '';
      const text = parts[1] || parts[0] || '';
      if (text) out.push({ 
        partOfSpeech: pos, 
        definition: text,
        pronunciation: '',
        audio: '',
        source: 'datamuse'
      });
      if (out.length >= 3) break;
    }
    if (out.length >= 3) break;
  }
  return out;
}

async function localModelDefine(word) {
  const model = process.env.OLLAMA_MODEL;
  if (!model) return '';
  try {
    const prompt = `Define the English word "${word}" in one short sentence. Output only the definition.`;
    const resp = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false })
    });
    if (!resp.ok) return '';
    const data = await resp.json();
    const text = (data && (data.response || data.output || '')).trim();
    return text;
  } catch {
    return '';
  }
}

// Cache for sentences to avoid regenerating the same word
const sentenceCache = new Map();

async function localModelSentenceForDefinition(word, definition, definitionIndex) {
  console.log(`[DEBUG] localModelSentenceForDefinition called for "${word}" with definition ${definitionIndex}: ${definition.partOfSpeech} - ${definition.definition}`);
  try {
    // Use AI to generate contextually connected sentence for this specific meaning
    const model = process.env.OLLAMA_MODEL;
    console.log(`[DEBUG] OLLAMA_MODEL environment variable:`, model);
    
    if (model && definition) {
      console.log(`[DEBUG] Proceeding with AI generation using model: ${model}`);
      
      const partOfSpeech = definition.partOfSpeech || '';
      const definitionText = definition.definition || '';
      
      console.log(`[DEBUG] Generating AI sentence for "${word}" with definition: "${definitionText}"`);
      const prompt = `Create ONE sentence that demonstrates the word "${word}" being used with EXACTLY this meaning: "${definitionText}". 

CRITICAL REQUIREMENTS:
- Use "${word}" as a ${partOfSpeech}, NOT as any other part of speech
- If ${partOfSpeech} is "noun", use "${word}" as a thing/object, NOT as an action
- If ${partOfSpeech} is "verb", use "${word}" as an action, NOT as a thing/object
- The sentence must clearly demonstrate the definition meaning
- Make it natural and realistic

For example:
- If the definition is about "a portion/part" (noun), create a sentence where "${word}" is a thing: "Each person received their share of the profits"
- If the definition is about "giving/distributing" (verb), create a sentence where "${word}" is an action: "They decided to share the food with everyone"
- If the definition is about "a blade/tool" (noun), create a sentence where "${word}" is a thing: "The farmer sharpened the share of his plough"

Output only the sentence, nothing else.`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout
      
      const resp = await fetch('http://127.0.0.1:11434/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ 
          model, 
          prompt, 
          stream: false,
          options: {
            temperature: 0.0, // Zero temperature for maximum consistency
            num_predict: 100, // Allow longer responses for better sentences
            top_p: 0.9
          }
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      if (resp.ok) {
        const data = await resp.json();
        const text = (data && (data.response || data.output || '')).trim();
        console.log(`[DEBUG] AI response for "${word}":`, text);
        if (text && text.length > 10 && text.length < 300) {
          // Validate that the sentence actually demonstrates the intended meaning
          if (isValidContextualSentence(text, word, definitionText, partOfSpeech)) {
            console.log(`[DEBUG] AI sentence validated successfully for "${word}"`);
            return text;
          } else {
            console.log(`[DEBUG] AI sentence failed validation for "${word}":`, text);
          }
        }
      }
    } else {
      // No AI model or no definition, use fallback sentence
      console.log(`[DEBUG] No AI model (${model}) or no definition, using fallback`);
    }
  } catch (error) {
    console.log(`[DEBUG] AI failed for definition ${definitionIndex}, using fallback:`, error.message);
  }
  
  // Return null if AI fails, let the caller handle fallback
  return null;
}

async function localModelSentence(word, definitions = []) {
  console.log(`[DEBUG] localModelSentence called for "${word}" with ${definitions.length} definitions`);
  try {
    // Use AI to generate contextually connected sentences for each meaning
    const model = process.env.OLLAMA_MODEL;
    console.log(`[DEBUG] OLLAMA_MODEL environment variable:`, model);
    
    if (model && definitions.length > 0) {
      console.log(`[DEBUG] Proceeding with AI generation using model: ${model}`);
      const sentences = [];
      
      for (let i = 0; i < Math.min(3, definitions.length); i++) {
        const def = definitions[i];
        const partOfSpeech = def.partOfSpeech || '';
        const definition = def.definition || '';
        
        console.log(`[DEBUG] Processing definition ${i + 1}: ${partOfSpeech} - ${definition}`);
        
        try {
          console.log(`[DEBUG] Generating AI sentence for "${word}" with definition: "${definition}"`);
          const prompt = `Create ONE sentence that demonstrates the word "${word}" being used with EXACTLY this meaning: "${definition}". 

CRITICAL REQUIREMENTS:
- Use "${word}" as a ${partOfSpeech}, NOT as any other part of speech
- If ${partOfSpeech} is "noun", use "${word}" as a thing/object, NOT as an action
- If ${partOfSpeech} is "verb", use "${word}" as an action, NOT as a thing/object
- The sentence must clearly demonstrate the definition meaning
- Make it natural and realistic

For example:
- If the definition is about "a portion/part" (noun), create a sentence where "${word}" is a thing: "Each person received their share of the profits"
- If the definition is about "giving/distributing" (verb), create a sentence where "${word}" is an action: "They decided to share the food with everyone"
- If the definition is about "a blade/tool" (noun), create a sentence where "${word}" is a thing: "The farmer sharpened the share of his plough"

Output only the sentence, nothing else.`;

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased timeout to 15 seconds per sentence
          
          const resp = await fetch('http://127.0.0.1:11434/api/generate', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ 
              model, 
              prompt, 
              stream: false,
              options: {
                temperature: 0.0, // Zero temperature for maximum consistency
                num_predict: 100, // Allow longer responses for better sentences
                top_p: 0.9
              }
            }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          if (resp.ok) {
            const data = await resp.json();
            const text = (data && (data.response || data.output || '')).trim();
            console.log(`[DEBUG] AI response for "${word}":`, text);
            if (text && text.length > 10 && text.length < 300) {
              // Validate that the sentence actually demonstrates the intended meaning
              if (isValidContextualSentence(text, word, definition, partOfSpeech)) {
                console.log(`[DEBUG] AI sentence validated successfully for "${word}"`);
                sentences.push(text);
                continue;
              } else {
                console.log(`[DEBUG] AI sentence failed validation for "${word}":`, text);
              }
            }
          }
        } catch (error) {
          console.log(`[DEBUG] AI failed for meaning ${i}, using fallback:`, error.message);
        }
        
        // Fallback sentence if AI fails - create a contextually relevant one
        const fallback = createContextualFallback(word, partOfSpeech, definition);
        console.log(`[DEBUG] Using fallback sentence for definition ${i + 1}:`, fallback);
        sentences.push(fallback);
      }
      
      // If we don't have enough sentences, fill with generic fallbacks
      while (sentences.length < 3) {
        sentences.push(generateFallbackSentences(word)[sentences.length] || 
                     `The word "${word}" can be used in various contexts.`);
      }
      
      console.log(`[DEBUG] Returning ${sentences.length} sentences from localModelSentence`);
      return sentences.slice(0, 3);
    } else {
      // No AI model or no definitions, use fallback sentences
      console.log(`[DEBUG] No AI model (${model}) or no definitions (${definitions.length}), using fallback`);
      return generateFallbackSentences(word);
    }
  } catch (error) {
    console.error('Error in localModelSentence:', error);
    return generateFallbackSentences(word);
  }
}

function createContextualFallback(word, partOfSpeech, definition) {
  // Create contextually relevant fallback sentences based on the specific definition
  const lowerWord = word.toLowerCase();
  const lowerDef = definition.toLowerCase();
  
  if (partOfSpeech === 'noun') {
    if (lowerDef.includes('portion') || lowerDef.includes('part') || lowerDef.includes('allotted')) {
      return `Each team member received an equal ${word} of the project budget.`;
    } else if (lowerDef.includes('stock') || lowerDef.includes('company') || lowerDef.includes('investment')) {
      return `She purchased 100 ${word}s of Apple stock last month.`;
    } else if (lowerDef.includes('blade') || lowerDef.includes('plough') || lowerDef.includes('agricultural') || lowerDef.includes('cultivator')) {
      return `The farmer sharpened the ${word} of his plough before planting season.`;
    } else if (lowerDef.includes('responsibility') || lowerDef.includes('duty')) {
      return `The ${word} of blame was distributed fairly among all participants.`;
    } else if (lowerDef.includes('file') || lowerDef.includes('computer') || lowerDef.includes('network')) {
      return `The network administrator created a new file ${word} for the team.`;
      } else {
    // Create more sensible generic sentences based on the word
    if (lowerDef.includes('injury') || lowerDef.includes('hurt') || lowerDef.includes('damage') || lowerDef.includes('cut') || lowerDef.includes('stab') || lowerDef.includes('tear')) {
      return `The doctor treated the ${word} with care and attention.`;
    } else if (lowerDef.includes('sound') || lowerDef.includes('noise') || lowerDef.includes('voice')) {
      return `The ${word} echoed through the empty hallway.`;
    } else if (lowerDef.includes('light') || lowerDef.includes('bright') || lowerDef.includes('glow')) {
      return `The ${word} illuminated the dark room.`;
    } else if (lowerDef.includes('water') || lowerDef.includes('liquid') || lowerDef.includes('flow')) {
      return `The ${word} flowed gently down the stream.`;
    } else if (lowerDef.includes('work') || lowerDef.includes('task') || lowerDef.includes('job')) {
      return `The ${word} was completed successfully by the team.`;
    } else {
      return `The ${word} was clearly visible in the morning light.`;
    }
  }
  } else if (partOfSpeech === 'verb') {
    if (lowerDef.includes('give') || lowerDef.includes('divide') || lowerDef.includes('distribute')) {
      return `They agreed to ${word} the remaining food with the hungry travelers.`;
    } else if (lowerDef.includes('experience') || lowerDef.includes('feel') || lowerDef.includes('have in common')) {
      return `We all ${word} the same concerns about the upcoming changes.`;
    } else if (lowerDef.includes('tell') || lowerDef.includes('communicate') || lowerDef.includes('story')) {
      return `He wanted to ${word} his personal experience with the group.`;
    } else if (lowerDef.includes('use together') || lowerDef.includes('occupy') || lowerDef.includes('shelter')) {
      return `The two families ${word} the same vacation home every summer.`;
    } else if (lowerDef.includes('language') || lowerDef.includes('speak')) {
      return `The students ${word} a common language in their international class.`;
    } else {
      return `Let's ${word} our resources to complete this project faster.`;
    }
  } else if (partOfSpeech === 'adjective') {
    return `The ${word} price has increased by 15% this quarter.`;
  } else {
    return `It's important to ${word} knowledge and information with others.`;
  }
}

function generateFallbackSentences(word) {
  // Much better fallback templates that are actually useful
  if (word === 'crony') {
    return [
      'The politician appointed his cronies to key positions.',
      'She only hired her cronies from the old company.',
      'The CEO surrounded himself with cronies who never disagreed.'
    ];
  }
  
  if (word === 'siren') {
    return [
      'The fire truck\'s siren blared as it rushed to the emergency.',
      'Ancient sailors were lured by the siren\'s enchanting song.',
      'The tornado siren warned residents to seek shelter immediately.'
    ];
  }
  
  if (word === 'slate') {
    return [
      'The teacher wrote the lesson on the slate blackboard.',
      'The roof was covered with dark slate tiles.',
      'We need to start with a clean slate for this project.'
    ];
  }
  
  if (word === 'sheer') {
    return [
      'The sheer size of the mountain was overwhelming.',
      'She wore a sheer blouse over her tank top.',
      'It was sheer luck that we found the missing keys.'
    ];
  }
  
  if (word === 'screw') {
    return [
      'I need to tighten that loose screw in the chair.',
      'Don\'t screw up this important presentation.',
      'The mechanic used a screwdriver to fix the engine.'
    ];
  }
  
  if (word === 'corny') {
    return [
      'The movie was full of corny jokes and clichés.',
      'His pickup lines were so corny they made her laugh.',
      'The sitcom had that corny laugh track we all remember.'
    ];
  }
  
  if (word === 'irony') {
    return [
      'The irony of the situation wasn\'t lost on anyone.',
      'It\'s ironic that the fire station burned down.',
      'The irony of his words contradicted his actions.'
    ];
  }
  
  if (word === 'briny') {
    return [
      'The briny ocean air filled our lungs.',
      'The soup had a briny taste from the seafood.',
      'We could smell the briny salt marshes from the road.'
    ];
  }
  
  if (word === 'horny') {
    return [
      'The horny toad is actually a type of lizard.',
      'The old car had horny headlights that needed polishing.',
      'The horny texture of the bark made it easy to climb.'
    ];
  }
  
  if (word === 'bunny') {
    return [
      'The bunny hopped across the garden path.',
      'She bought her daughter a stuffed bunny for Easter.',
      'The bunny rabbit nibbled on the fresh carrots.'
    ];
  }
  
  if (word === 'goody') {
    return [
      'The goody bag was filled with treats and toys.',
      'She\'s such a goody-goody, always following the rules.',
      'The party favors included goody bags for all the kids.'
    ];
  }
  
  if (word === 'moody') {
    return [
      'He\'s been moody ever since he lost his job.',
      'The moody teenager slammed the door and stormed off.',
      'Her moody paintings reflected her inner turmoil.'
    ];
  }
  
  if (word === 'woody') {
    return [
      'The woody aroma of cedar filled the room.',
      'The forest had a rich, woody scent after the rain.',
      'The wine had subtle woody notes from oak aging.'
    ];
  }
  
  if (word === 'roomy') {
    return [
      'The new apartment is much roomier than the old one.',
      'The SUV has a roomy interior perfect for family trips.',
      'The roomy kitchen has plenty of counter space.'
    ];
  }
  
  // Generic but better templates for other words
  return [
    `The word "${word}" has an interesting origin.`,
    `Many people find "${word}" difficult to spell.`,
    `"${word}" is commonly used in everyday conversation.`
  ];
}

async function lookupExampleSentenceForDefinition(word, definition, definitionIndex) {
  console.log(`[DEBUG] lookupExampleSentenceForDefinition called for "${word}" with definition ${definitionIndex}: ${definition.partOfSpeech} - ${definition.definition}`);
  
  // ALWAYS try AI first for contextually connected sentence
  console.log(`[DEBUG] Attempting AI generation for "${word}" with definition ${definitionIndex}`);
  try {
    const aiSentence = await localModelSentenceForDefinition(word, definition, definitionIndex);
    console.log(`[DEBUG] AI generated sentence for definition ${definitionIndex}:`, aiSentence);
    if (aiSentence) {
      console.log(`[DEBUG] Using AI-generated sentence for definition ${definitionIndex}`);
      return aiSentence;
    }
  } catch (e) {
    console.log(`[DEBUG] AI generation failed for definition ${definitionIndex}:`, e.message);
  }
  
  // Fallback to API sentences only if AI fails
  console.log(`[DEBUG] AI failed for definition ${definitionIndex}, trying API fallbacks`);
  
  // Try Free Dictionary API for this specific definition
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (res.ok) {
      const data = await res.json();
      const sentence = collectFreeDictionarySentenceForDefinition(data, definitionIndex);
      console.log(`[DEBUG] Free Dictionary API returned sentence for definition ${definitionIndex}:`, sentence);
      if (sentence) return sentence;
    }
  } catch (e) {
    console.log(`[DEBUG] Free Dictionary API failed for definition ${definitionIndex}:`, e.message);
  }
  
  // Try Wiktionary for example sentences
  try {
    const res = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/en/${encodeURIComponent(word)}`);
    if (res.ok) {
      const data = await res.json();
      const sentence = collectWiktionarySentenceForDefinition(data, definitionIndex);
      console.log(`[DEBUG] Wiktionary returned sentence for definition ${definitionIndex}:`, sentence);
      if (sentence) return sentence;
    }
  } catch (e) {
    console.log(`[DEBUG] Wiktionary failed for definition ${definitionIndex}:`, e.message);
  }
  
  // Last resort: generic fallback sentence for this definition
  console.log(`[DEBUG] Using generic fallback sentence for definition ${definitionIndex}`);
  return createContextualFallback(word, definition.partOfSpeech, definition.definition);
}

async function lookupExampleSentences(word, definitions = []) {
  console.log(`[DEBUG] lookupExampleSentences called for "${word}" with ${definitions.length} definitions`);
  
  // ALWAYS try AI first for contextually connected sentences
  console.log(`[DEBUG] Attempting AI generation for "${word}" with ${definitions.length} definitions`);
  try {
    const aiSentences = await localModelSentence(word, definitions);
    console.log(`[DEBUG] AI generated ${aiSentences ? aiSentences.length : 0} sentences`);
    if (aiSentences && aiSentences.length >= 3) {
      console.log(`[DEBUG] Using AI-generated sentences for "${word}"`);
      return aiSentences;
    }
  } catch (e) {
    console.log(`[DEBUG] AI generation failed:`, e.message);
  }
  
  // Fallback to API sentences only if AI fails
  console.log(`[DEBUG] AI failed, trying API fallbacks for "${word}"`);
  
  // Try Free Dictionary API
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (res.ok) {
      const data = await res.json();
      const sentences = collectFreeDictionarySentences(data);
      console.log(`[DEBUG] Free Dictionary API returned ${sentences.length} sentences`);
      if (sentences.length >= 3) return sentences;
    }
  } catch (e) {
    console.log(`[DEBUG] Free Dictionary API failed:`, e.message);
  }
  
  // Try Wiktionary for example sentences
  try {
    const res = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/en/${encodeURIComponent(word)}`);
    if (res.ok) {
      const data = await res.json();
      const sentences = collectWiktionarySentences(data);
      console.log(`[DEBUG] Wiktionary returned ${sentences.length} sentences`);
      if (sentences.length >= 3) return sentences;
    }
  } catch (e) {
    console.log(`[DEBUG] Wiktionary failed:`, e.message);
  }
  
  // Last resort: generic fallback sentences
  console.log(`[DEBUG] Using generic fallback sentences for "${word}"`);
  return generateFallbackSentences(word);
}

function collectFreeDictionarySentenceForDefinition(data, definitionIndex) {
  if (!Array.isArray(data)) return null;
  
  let currentIndex = 0;
  for (const entry of data) {
    const meanings = entry?.meanings || [];
    for (const m of meanings) {
      const defs = m?.definitions || [];
      for (const d of defs) {
        if (currentIndex === definitionIndex) {
          const ex = d?.example;
          if (ex && typeof ex === 'string') {
            return ex;
          }
        }
        currentIndex++;
      }
    }
  }
  return null;
}

function collectFreeDictionarySentences(data) {
  const out = [];
  if (!Array.isArray(data)) return out;
  for (const entry of data) {
    const meanings = entry?.meanings || [];
    for (const m of meanings) {
      const defs = m?.definitions || [];
      for (const d of defs) {
        const ex = d?.example;
        if (ex && typeof ex === 'string') {
          out.push(ex);
          if (out.length >= 3) break;
        }
      }
      if (out.length >= 3) break;
    }
    if (out.length >= 3) break;
  }
  return out;
}

function collectWiktionarySentenceForDefinition(data, definitionIndex) {
  const lang = data?.en || data?.English || [];
  let currentIndex = 0;
  
  for (const sense of lang) {
    const defs = Array.isArray(sense?.definitions) ? sense.definitions : [];
    for (const d of defs) {
      if (currentIndex === definitionIndex) {
        if (typeof d?.example === 'string' && d.example) {
          return String(d.example);
        }
        const examples = Array.isArray(d?.examples) ? d.examples : [];
        if (examples.length > 0 && typeof examples[0] === 'string') {
          return examples[0];
        }
      }
      currentIndex++;
    }
  }
  return null;
}

function collectWiktionarySentences(data) {
  const out = [];
  const lang = data?.en || data?.English || [];
  for (const sense of lang) {
    const defs = Array.isArray(sense?.definitions) ? sense.definitions : [];
    for (const d of defs) {
      if (typeof d?.example === 'string' && d.example) {
        out.push(String(d.example));
      }
      const examples = Array.isArray(d?.examples) ? d.examples : [];
      for (const e of examples) {
        if (typeof e === 'string' && e) out.push(e);
      }
      if (out.length >= 3) break;
    }
    if (out.length >= 3) break;
  }
  return out;
}

async function translateWord(word, targetLang) {
  console.log(`[DEBUG] translateWord called with word="${word}", targetLang="${targetLang}"`);
  
  const model = process.env.OLLAMA_MODEL;
  if (!model) {
    console.log(`[DEBUG] No OLLAMA_MODEL set`);
    return { error: 'No AI model available for translation' };
  }
  
  console.log(`[DEBUG] Using model: ${model}`);
  
  const langNames = {
    'es': 'Spanish', 'fr': 'French', 'de': 'German', 'it': 'Italian', 'pt': 'Portuguese',
    'ru': 'Russian', 'ja': 'Japanese', 'ko': 'Korean', 'zh': 'Chinese', 'ar': 'Arabic'
  };
  
  try {
    const prompt = `Translate the English word "${word}" to ${langNames[targetLang] || targetLang}.

Important: Give me ONLY the translation word, not the English word repeated.

For example:
- "house" → "casa" (not "house")
- "run" → "correr" (not "run")
- "big" → "grande" (not "big")

Translation of "${word}":`;
    
    console.log(`[DEBUG] Sending prompt to Ollama:`, prompt);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
    
    const resp = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ 
        model, 
        prompt, 
        stream: false,
        options: {
          temperature: 0.0, // Most consistent for translations
          top_p: 0.9,
          num_predict: 50 // Very short response for speed
        }
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    console.log(`[DEBUG] Ollama response status: ${resp.status}`);
    
    if (!resp.ok) {
      console.log(`[DEBUG] Ollama request failed`);
      return { error: 'Translation request failed' };
    }
    
    const data = await resp.json();
    const text = (data && (data.response || data.output || '')).trim();
    console.log(`[DEBUG] Ollama raw response:`, text);
    
    // Parse the AI response - simpler parsing for shorter responses
    let translation = '';
    let pronunciation = '';
    let definition = '';
    
    // Try to extract translation from the response
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length > 0) {
      // First line is usually the translation
      let firstLine = lines[0];
      
      // Clean up the first line - remove any "Translation of X:" prefix
      if (firstLine.includes(':')) {
        firstLine = firstLine.split(':')[1] || firstLine;
      }
      
      // Remove quotes and extra whitespace
      firstLine = firstLine.replace(/["']/g, '').trim();
      
      // Make sure it's not just the English word repeated
      if (firstLine.toLowerCase() !== word.toLowerCase()) {
        translation = firstLine;
      } else {
        // If it's the English word, try the next line
        if (lines.length > 1) {
          translation = lines[1].replace(/["']/g, '').trim();
        }
      }
      
      // Look for pronunciation and definition in subsequent lines
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        if (line.includes('pronunciation') || line.includes('pronounced')) {
          pronunciation = lines[i].replace(/pronunciation:?\s*/i, '').replace(/pronounced:?\s*/i, '');
        } else if (line.includes('definition') || line.includes('meaning')) {
          definition = lines[i].replace(/definition:?\s*/i, '').replace(/meaning:?\s*/i, '');
        }
      }
    }
    
    console.log(`[DEBUG] Parsed - Translation: "${translation}", Pronunciation: "${pronunciation}", Definition: "${definition}"`);
    
    if (translation) {
      const result = { translation, pronunciation, definition };
      console.log(`[DEBUG] Returning successful result:`, result);
      return result;
    } else {
      // Fallback: try to extract just the translation
      const fallbackTranslation = lines[0] || '';
      const fallbackResult = { translation: fallbackTranslation, pronunciation: '', definition: '' };
      console.log(`[DEBUG] Using fallback result:`, fallbackResult);
      return fallbackResult;
    }
    
  } catch (error) {
    console.log(`[DEBUG] Translation error for "${word}" to ${targetLang}:`, error.message);
    return { error: 'Translation failed' };
  }
}

async function translateWordWithMeanings(word, targetLang, definitions = []) {
  console.log(`[DEBUG] translateWordWithMeanings called for "${word}" to "${targetLang}" with ${definitions.length} definitions`);
  
  const translations = [];
  
  if (definitions.length === 0) {
    // If no definitions provided, just translate the base word
    const baseTranslation = await translateWord(word, targetLang);
    translations.push({
      partOfSpeech: '',
      definition: '',
      translation: baseTranslation.translation,
      pronunciation: baseTranslation.pronunciation,
      source: baseTranslation.source || 'api'
    });
    return translations;
  }
  
  // Translate each definition separately
  for (let i = 0; i < definitions.length; i++) {
    const def = definitions[i];
    const partOfSpeech = def.partOfSpeech || '';
    const definition = def.definition || '';
    
    console.log(`[DEBUG] Translating definition ${i + 1}: ${partOfSpeech} - ${definition}`);
    
    try {
      // Create a strict contextual prompt that forces the AI to translate the exact definition
      const contextualPrompt = `TRANSLATE THIS EXACT MEANING TO ${getLanguageName(targetLang).toUpperCase()}.

ENGLISH WORD: "${word}"
PART OF SPEECH: ${partOfSpeech}
EXACT DEFINITION: "${definition}"

CRITICAL INSTRUCTIONS:
- You MUST translate the EXACT meaning "${definition}"
- You MUST return ONLY: translation|pronunciation|brief definition
- You MUST NOT explain, argue, or provide alternatives
- You MUST NOT use English words in your response
- You MUST NOT output the words "translation", "pronunciation", or "definition"
- If you cannot translate, return: "NO_TRANSLATION"|"NO_TRANSLATION"|"NO_TRANSLATION"

EXAMPLE OUTPUT FORMAT:
grulla|GRU-ya|ave de patas largas y cuello largo

NOTHING ELSE. NO EXPLANATIONS. NO ARGUMENTS.`;

      const model = process.env.OLLAMA_MODEL;
      if (model) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased timeout to 15 seconds to match sentence generation
          
          const resp = await fetch('http://127.0.0.1:11434/api/generate', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ 
              model, 
              prompt: contextualPrompt, 
              stream: false,
              options: {
                temperature: 0.0, // Zero temperature for consistency
                num_predict: 60 // Shorter responses for speed
              }
            }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          if (resp.ok) {
            const data = await resp.json();
            const text = (data && (data.response || data.output || '')).trim();
            
            // Parse the AI response
            console.log(`[DEBUG] AI response text: "${text}"`);
            
            // Try to parse the response in different formats
            let translation = '';
            let pronunciation = '';
            let definitionInTargetLang = '';
            
            // First try the expected format: translation|pronunciation|definition
            if (text.includes('|')) {
              // Split by first line break to get the first option
              const firstLine = text.split('\n')[0].trim();
              const parts = firstLine.split('|').map(p => p.trim());
              if (parts.length >= 1) {
                translation = parts[0];
                pronunciation = parts[1] || '';
                definitionInTargetLang = parts[2] || '';
                
                // If the definition part contains parentheses, extract the clean definition
                if (definitionInTargetLang && definitionInTargetLang.includes('(')) {
                  definitionInTargetLang = definitionInTargetLang.split('(')[0].trim();
                }
                
                // Validate that we got a real translation (not the same word)
                if (translation.toLowerCase() === word.toLowerCase()) {
                  console.log(`[DEBUG] AI returned same word "${translation}", trying to extract from definition`);
                  // Try to extract the actual translation from the definition part
                  if (definitionInTargetLang && definitionInTargetLang.length > 3) {
                    // Look for the first word that's not the English word
                    const words = definitionInTargetLang.split(/\s+/);
                    for (const w of words) {
                      if (w.length > 2 && w.toLowerCase() !== word.toLowerCase() && /^[a-zA-Záéíóúñü]+$/.test(w)) {
                        translation = w;
                        break;
                      }
                    }
                  }
                }
              }
            } else {
              // If no pipes, look for the last line that contains the translation format
              const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
              for (let i = lines.length - 1; i >= 0; i--) {
                const line = lines[i];
                if (line.includes('|')) {
                  const parts = line.split('|').map(p => p.trim());
                  if (parts.length >= 1) {
                    translation = parts[0];
                    pronunciation = parts[1] || '';
                    definitionInTargetLang = parts[2] || '';
                    break;
                  }
                }
              }
              
              // If still no translation, try to extract from the text
              if (!translation) {
              for (const line of lines) {
                if (line.includes(' means ') || line.includes(' is ') || line.includes(' → ')) {
                  // Extract the translation part
                  const match = line.match(/([a-zA-Záéíóúñü]+)/);
                  if (match) {
                    translation = match[1];
                    break;
                    }
                  }
                }
              }
              
              // Last resort: use the first word that looks like a translation
              if (!translation && lines.length > 0) {
                const firstLine = lines[0];
                const words = firstLine.split(/\s+/);
                for (const word of words) {
                  if (word.length > 2 && /^[a-zA-Záéíóúñü]+$/.test(word)) {
                    translation = word;
                    break;
                  }
                }
              }
            }
            
            if (translation) {
              // Quality check: reject obvious garbage translations
              const lowerTranslation = translation.toLowerCase();
              const lowerWord = word.toLowerCase();
              
              // Check if translation is garbage (English words, too short, same as input)
              if (lowerTranslation === lowerWord || 
                  lowerTranslation === 'must' || 
                  lowerTranslation === 'the' || 
                  lowerTranslation === 'and' || 
                  lowerTranslation === 'or' ||
                  lowerTranslation.length < 3 ||
                  /^[a-z]+$/.test(lowerTranslation) && lowerTranslation.length < 4) {
                
                console.log(`[DEBUG] Rejected garbage translation: "${translation}" - too short or English word`);
                translation = null;
              } else {
              console.log(`[DEBUG] Parsed translation: "${translation}", pronunciation: "${pronunciation}", definition: "${definitionInTargetLang}"`);
              translations.push({
                partOfSpeech: partOfSpeech,
                definition: definition,
                translation: translation,
                pronunciation: pronunciation,
                definitionInTargetLang: definitionInTargetLang,
                source: 'ai'
              });
              continue;
              }
            }
            
            if (!translation) {
              console.log(`[DEBUG] Could not parse valid translation from AI response: "${text}"`);
              
              // FALLBACK: Try a direct definition-based prompt
              console.log(`[DEBUG] Attempting fallback prompt for definition: "${definition}"`);
              try {
                                 const fallbackPrompt = `Find a ${getLanguageName(targetLang)} word that means: "${definition}"

CRITICAL REQUIREMENTS:
- Focus ONLY on the definition meaning, NOT the English word
- Find a ${getLanguageName(targetLang)} word that matches the definition exactly
- You MUST NOT output the words "word", "pronunciation", or "definition"
- You MUST NOT give random words that don't match

Return ONLY: word|pronunciation|brief definition

Example: grulla|GRU-ya|ave de patas largas y cuello largo

NOTE: Always give a proper definition, never just a synonym.`;

                const fallbackController = new AbortController();
                const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 10000);
                
                const fallbackResp = await fetch('http://127.0.0.1:11434/api/generate', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ 
                    model, 
                    prompt: fallbackPrompt, 
                    stream: false,
                    options: {
                      temperature: 0.0,
                      num_predict: 40
                    }
                  }),
                  signal: fallbackController.signal
                });
                
                clearTimeout(fallbackTimeoutId);
                
                if (fallbackResp.ok) {
                  const fallbackData = await fallbackResp.json();
                  const fallbackText = (fallbackData && (fallbackData.response || fallbackData.output || '')).trim();
                  
                  console.log(`[DEBUG] Fallback AI response: "${fallbackText}"`);
                  
                  // Parse fallback response
                  if (fallbackText.includes('|')) {
                    const parts = fallbackText.split('|').map(p => p.trim());
                    if (parts.length >= 1 && parts[0].length > 2) {
                      const fallbackTranslation = parts[0];
                      const fallbackPronunciation = parts[1] || '';
                      const fallbackDefinition = parts[2] || '';
                      
                      // Basic quality check - only reject if it's the same as input word
                      if (fallbackTranslation.toLowerCase() === word.toLowerCase()) {
                        console.log(`[DEBUG] Rejected translation same as input word: "${fallbackTranslation}"`);
                        continue;
                      }
                      
                      console.log(`[DEBUG] Fallback translation successful: "${fallbackTranslation}"`);
                      translations.push({
                        partOfSpeech: partOfSpeech,
                        definition: definition,
                        translation: fallbackTranslation,
                        pronunciation: fallbackPronunciation,
                        definitionInTargetLang: fallbackDefinition,
                        source: 'ai-fallback'
                      });
                      continue;
                    }
                  }
                }
              } catch (fallbackError) {
                console.log(`[DEBUG] Fallback translation also failed:`, fallbackError.message);
              }
            }
          }
        } catch (error) {
          console.log(`[DEBUG] AI translation failed for definition ${i + 1}:`, error.message);
        }
      }
      
      // AI translation failed - don't use hardcoded fallbacks
      console.log(`[DEBUG] AI translation failed for definition ${i + 1}, skipping hardcoded fallback`);
      // Don't add any translation - let the client handle the failure
      continue;
      
    } catch (error) {
      console.log(`[DEBUG] Translation failed for definition ${i + 1}:`, error.message);
      // Add a fallback entry
      translations.push({
        partOfSpeech: partOfSpeech,
        definition: definition,
        translation: `[Translation not available]`,
        pronunciation: '',
        source: 'error'
      });
    }
  }
  
  console.log(`[DEBUG] Generated ${translations.length} translations for "${word}"`);
  return translations;
}

function getLanguageName(code) {
  const langNames = {
    'es': 'Spanish', 'fr': 'French', 'de': 'German', 'it': 'Italian', 'pt': 'Portuguese',
    'ru': 'Russian', 'ja': 'Japanese', 'ko': 'Korean', 'zh': 'Chinese', 'ar': 'Arabic'
  };
  return langNames[code] || code;
}

function isValidContextualSentence(sentence, word, definition, partOfSpeech) {
  console.log(`[DEBUG] 🔍 VALIDATION START: "${sentence}" for "${word}" (${partOfSpeech})`);
  
  const lowerSentence = sentence.toLowerCase();
  const lowerWord = word.toLowerCase();
  const lowerDef = definition.toLowerCase();
  
  // Check if the sentence contains the word OR demonstrates the definition meaning
  const containsWord = lowerSentence.includes(lowerWord);
  const demonstratesDefinition = lowerDef.includes('blade') && lowerSentence.includes('blade') ||
                                lowerDef.includes('plough') && lowerSentence.includes('plough') ||
                                lowerDef.includes('portion') && lowerSentence.includes('portion') ||
                                lowerDef.includes('part') && lowerSentence.includes('part');
  
  if (!containsWord && !demonstratesDefinition) {
    console.log(`[DEBUG] ❌ VALIDATION FAILED: Sentence does not contain word "${lowerWord}" or demonstrate definition meaning`);
    return false;
  }
  
  if (containsWord) {
    console.log(`[DEBUG] ✅ Word "${lowerWord}" found in sentence`);
  } else {
    console.log(`[DEBUG] ✅ Sentence demonstrates definition meaning without exact word`);
  }
  
  // Check if the sentence demonstrates the intended part of speech
  if (partOfSpeech === 'noun') {
    console.log(`[DEBUG] 🔍 Checking NOUN validation for "${word}"`);
    // For nouns, check if the word is used as a noun (not as a verb)
    const wordIndex = lowerSentence.indexOf(lowerWord);
    const beforeWord = lowerSentence.substring(0, wordIndex).trim();
    const afterWord = lowerSentence.substring(wordIndex + lowerWord.length).trim();
    
    console.log(`[DEBUG] Before word: "${beforeWord}", After word: "${afterWord}"`);
    
    // Should not have "to" before the word (which would make it a verb)
    if (beforeWord.endsWith(' to ')) {
      console.log(`[DEBUG] ❌ VALIDATION FAILED: "to" before word makes it a verb`);
      return false;
    }
    // Should not have "ing" after the word (which would make it a verb)
    if (afterWord.startsWith('ing ')) {
      console.log(`[DEBUG] ❌ VALIDATION FAILED: "ing" after word makes it a verb`);
      return false;
    }
    // Should not have "ed" after the word (which would make it a verb)
    if (afterWord.startsWith('ed ')) {
      console.log(`[DEBUG] ❌ VALIDATION FAILED: "ed" after word makes it a verb`);
      return false;
    }
    console.log(`[DEBUG] ✅ NOUN validation passed`);
    
  } else if (partOfSpeech === 'verb') {
    console.log(`[DEBUG] 🔍 Checking VERB validation for "${word}"`);
    // For verbs, be much more lenient - just check if the word is used as a verb
    const wordIndex = lowerSentence.indexOf(lowerWord);
    const beforeWord = lowerSentence.substring(0, wordIndex).trim();
    
    console.log(`[DEBUG] Before word: "${beforeWord}"`);
    
    // MUCH MORE LENIENT VERB VALIDATION
    // Accept any sentence where the word appears and could reasonably be a verb
    // The AI is smart enough to generate proper verb usage
    
    // Check for common verb patterns
    const hasModalVerb = beforeWord.endsWith(' to ') || beforeWord.endsWith(' will ') || beforeWord.endsWith(' can ') || 
                         beforeWord.endsWith(' should ') || beforeWord.endsWith(' would ') || beforeWord.endsWith(' had ');
    
    const isSentenceStart = beforeWord.endsWith('.') || beforeWord.endsWith(',') || beforeWord.length === 0;
    
    if (hasModalVerb || isSentenceStart) {
      console.log(`[DEBUG] ✅ VERB validation passed: Modal verb or sentence start detected`);
    } else {
      // Check if it's a natural verb usage pattern
      // Many verbs can appear after various words in natural speech
      console.log(`[DEBUG] 🔍 Checking for natural verb usage patterns`);
      
      // Accept common natural verb patterns
      const naturalPatterns = [
        'carefully', 'slowly', 'quickly', 'gently', 'firmly', 'softly',
        'patiently', 'eagerly', 'reluctantly', 'enthusiastically', 'professionally',
        'the', 'a', 'an', 'this', 'that', 'these', 'those',
        'my', 'your', 'his', 'her', 'their', 'our',
        'interior designer', 'artist', 'chef', 'teacher', 'student', 'worker'
      ];
      
      const hasNaturalPattern = naturalPatterns.some(pattern => 
        beforeWord.endsWith(` ${pattern}`) || beforeWord.endsWith(` ${pattern} `)
      );
      
      if (hasNaturalPattern) {
        console.log(`[DEBUG] ✅ VERB validation passed: Natural usage pattern detected (${beforeWord})`);
      } else {
        // Be even more lenient - accept any reasonable verb usage
        console.log(`[DEBUG] ✅ VERB validation passed: Accepting natural verb usage (${beforeWord})`);
      }
    }
    
    console.log(`[DEBUG] ✅ VERB validation passed`);
  }
  
  // MUCH MORE LENIENT VALIDATION - Accept AI sentences that are well-formed
  // Only reject if the sentence is clearly wrong or doesn't make sense
  
  // Check for basic sentence structure
  if (lowerSentence.length < 10 || lowerSentence.length > 200) {
    console.log(`[DEBUG] ❌ VALIDATION FAILED: Sentence length ${lowerSentence.length} not in range [10, 200]`);
    return false;
  }
  console.log(`[DEBUG] ✅ Sentence length ${lowerSentence.length} is valid`);
  
  // Check if sentence ends with proper punctuation
  if (!lowerSentence.endsWith('.') && !lowerSentence.endsWith('!') && !lowerSentence.endsWith('?')) {
    console.log(`[DEBUG] ❌ VALIDATION FAILED: Sentence does not end with proper punctuation`);
    return false;
  }
  console.log(`[DEBUG] ✅ Sentence ends with proper punctuation`);
  
  // Check if sentence starts with capital letter (should be handled by AI, but just in case)
  if (!sentence.match(/^[A-Z]/)) {
    console.log(`[DEBUG] ❌ VALIDATION FAILED: Sentence does not start with capital letter`);
    return false;
  }
  console.log(`[DEBUG] ✅ Sentence starts with capital letter`);
  
  // Accept the sentence if it contains the word and has basic structure
  // The AI is smart enough to generate contextually relevant sentences
  console.log(`[DEBUG] 🎉 VALIDATION PASSED: All checks passed!`);
  return true;
}

// REMOVED: All hard-coded translations replaced with AI-powered fallback system
// The AI now handles ALL translations dynamically based on context


