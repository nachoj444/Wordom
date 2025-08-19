const { Server } = require('@modelcontextprotocol/sdk/server');
const { z } = require('zod');

// Simple built-in word lists (small fallback). You can replace with full lists later.
const SOLUTIONS = [
  'cigar','rebut','sissy','humph','awake','blush','focal','evade','naval','serve',
  'heath','dwarf','model','karma','stink','grade','quiet','bench','abate','feign',
  'major','death','fresh','crust','stool','colon','abase','marry','react','batty',
  'pride','floss','helix','croak','staff','paper','unfed','whelp','trawl','outdo',
  'adobe','crazy','sower','repay','digit','crate','slate','crane','trace','stare','later'
];

// Frequency-based initial guess list; you can tune later.
const INITIAL_GUESSES = ['slate', 'crane', 'trace', 'stare', 'arise', 'later'];

// Convert feedback like "bgybb" to constraints and filter candidates.
function applyFeedbackConstraints(candidates, guess, feedback) {
  const guessLetters = guess.split('');

  // Count letters required by greens+yellows for minimum occurrences
  const requiredCounts = new Map();
  const forbiddenPositions = Array.from({ length: 5 }, () => new Set());
  const fixedPositions = Array(5).fill(null);
  const notPresent = new Set();

  // First pass: greens lock positions and count
  guessLetters.forEach((ch, i) => {
    const f = feedback[i];
    if (f === 'g') {
      fixedPositions[i] = ch;
      requiredCounts.set(ch, (requiredCounts.get(ch) || 0) + 1);
    }
  });

  // Second pass: yellows add counts and ban positions; blacks tentative
  guessLetters.forEach((ch, i) => {
    const f = feedback[i];
    if (f === 'y') {
      forbiddenPositions[i].add(ch);
      requiredCounts.set(ch, (requiredCounts.get(ch) || 0) + 1);
    } else if (f === 'b') {
      // We cannot immediately ban ch entirely because duplicates may exist.
      // We will resolve after counts computed.
    }
  });

  // Compute maximum allowed counts for letters marked black in all their occurrences
  // If a letter never appears as g/y, and appears as b, then it must be absent
  const gyLetters = new Set([...requiredCounts.keys()]);
  guessLetters.forEach((ch, i) => {
    if (feedback[i] === 'b' && !gyLetters.has(ch)) {
      notPresent.add(ch);
    }
  });

  function wordPasses(word) {
    if (word.length !== 5) return false;

    // Fixed positions
    for (let i = 0; i < 5; i++) {
      if (fixedPositions[i] && word[i] !== fixedPositions[i]) return false;
    }

    // Not present letters
    for (const ch of notPresent) {
      if (word.includes(ch)) return false;
    }

    // Forbidden positions (yellows)
    for (let i = 0; i < 5; i++) {
      for (const ch of forbiddenPositions[i]) {
        if (word[i] === ch) return false;
      }
    }

    // Required minimum counts
    const counts = new Map();
    for (const ch of word) counts.set(ch, (counts.get(ch) || 0) + 1);
    for (const [ch, minCount] of requiredCounts.entries()) {
      if ((counts.get(ch) || 0) < minCount) return false;
    }

    // For each yellow letter, ensure it exists somewhere else
    for (let i = 0; i < 5; i++) {
      if (feedback[i] === 'y') {
        if (!word.includes(guess[i])) return false;
      }
    }

    return true;
  }

  return candidates.filter(wordPasses);
}

function filterByHistory(candidates, guesses, feedback) {
  let filtered = candidates;
  for (let i = 0; i < guesses.length; i++) {
    filtered = applyFeedbackConstraints(filtered, guesses[i], feedback[i]);
  }
  return filtered;
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
        score += (overallFreq.get(ch) || 0) * 0.1; // small bonus for unique letters
        seen.add(ch);
      }
    }
    return score;
  }
  return candidates
    .map(w => ({ word: w, score: scoreWord(w) }))
    .sort((a, b) => b.score - a.score);
}

const server = new Server({ name: 'wordle-mcp', version: '0.1.0' });

const SuggestParams = z.object({
  guesses: z.array(z.string().length(5)).default([]),
  feedback: z.array(z.string().length(5)).default([]),
  limit: z.number().int().positive().max(50).default(10),
  wordList: z.enum(['solutions']).default('solutions'),
});

server.tool('wordle/suggest', {
  description:
    'Return ranked Wordle guesses given guess history and color feedback (b/y/g). If no guesses given, returns top initial guesses.',
  inputSchema: SuggestParams,
  handler: async ({ guesses, feedback, limit }) => {
    // Initial guess case
    if (!guesses.length) {
      const ranked = rankCandidates(INITIAL_GUESSES).slice(0, limit);
      return { content: [{ type: 'json', data: ranked }] };
    }

    const base = SOLUTIONS;
    const filtered = filterByHistory(base, guesses, feedback);
    const ranked = rankCandidates(filtered).slice(0, limit);
    return { content: [{ type: 'json', data: ranked }] };
  },
});

async function start() {
  await server.start();
}

start().catch((err) => {
  console.error('Failed to start wordle MCP server:', err);
  process.exit(1);
});


