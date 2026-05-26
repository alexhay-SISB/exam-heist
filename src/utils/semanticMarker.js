/**
 * Semantic marker for IGCSE Business answers.
 *
 * Built without any external API — runs entirely in the browser.
 * Designed to be far more forgiving than keyword exact-match:
 *
 *  • Stemming   — "fires", "fired", "firing" all reduce to "fire"
 *  • Synonyms   — "sack", "dismiss", "terminate" all canonicalise to "fire"
 *  • Phrases    — "limited liability" / "just in time" stay as one concept
 *  • Negation   — "not profitable" is detected and excluded from concept matches
 *  • Fuzzy text — minor misspellings tolerated via stem matching
 *  • Context    — bonus credit for referencing the business when required
 *
 * Public surface: `markAnswer(studentText, question)` returns the same shape
 * the FeedbackModal already consumes:
 *   { correct, coverage, hits[], missing[], usedContext }
 */

// =====================================================================
//  Stopwords / function words — never count as evidence of knowledge
// =====================================================================
const STOPWORDS = new Set([
  'a','an','the','is','are','was','were','be','been','being','am',
  'and','or','but','so','if','as','to','in','on','at','by','for','of',
  'with','from','up','down','this','that','these','those','it','its',
  'they','them','their','there','here','will','would','can','could',
  'should','may','might','must','shall','have','has','had','having',
  'do','does','did','one','two','three','four','five','six','some',
  'any','all','no','than','then','when','where','which','who','whom',
  'whose','why','how','what','i','you','he','she','we','us','me','my',
  'your','his','her','our','also','very','more','most','less','least',
  'much','many','few','such','only','just','about','into','out','over',
  'under','again','further','once','said','say','says','get','got',
  'gets','make','made','makes','take','took','taken','use','used','uses',
  'come','came','comes','go','went','goes','put','puts','too','also','still'
]);

// =====================================================================
//  Naive but effective stemmer (Porter-lite). Strips common suffixes.
// =====================================================================
const stem = (word) => {
  if (!word || word.length < 4) return word;
  let w = word.toLowerCase();
  // Pass 1: apply the first matching suffix rule
  const rules = [
    [/ies$/, 'y'],    [/ied$/, 'y'],   [/ying$/, 'y'],
    [/ier$/, 'y'],    [/iest$/, 'y'],
    [/ational$/, 'ate'], [/ization$/, 'ize'], [/isation$/, 'ize'],
    [/ousness$/, 'ous'], [/iveness$/, 'ive'],
    [/ments$/, 'ment'],  [/ment$/, ''],
    [/tional$/, 'tion'], [/tions$/, ''], [/tion$/, ''],
    [/ssal$/, 'ss'],   // dismissal → dismiss
    [/ssion$/, 'ss'],   // commission → commiss (close enough)
    [/ness$/, ''],       [/ities$/, 'ity'], [/ity$/, ''],
    [/ful$/, ''],        [/less$/, ''],     [/able$/, ''],
    [/ously$/, 'ous'],
    [/edly$/, ''],       [/ingly$/, ''],
    [/ively$/, 'ive'],
    [/ly$/, ''],
    [/ings$/, ''],       [/ing$/, ''],
    [/ers$/, ''],        [/er$/, ''],
    [/est$/, ''],
    [/ied$/, ''],        [/ed$/, ''],
    [/es$/, ''],         [/s$/, '']
  ];
  // Apply every applicable rule once (no early break). This lets
  // "dismissal" reduce via /ssal$/ → "dismiss" and then via /s$/ → "dismis",
  // so it unifies with "dismiss" → "dismis".
  for (const [re, rep] of rules) {
    if (re.test(w)) w = w.replace(re, rep);
  }
  // Pass 2: strip trailing 'e' on 4+ char words so "fire"/"fired" both → "fir",
  // "produce"/"production" both → "produc".
  if (w.length >= 4 && w.endsWith('e')) w = w.slice(0, -1);
  // Pass 3: collapse doubled trailing consonants from CVC-doubled -ing/-ed
  // stems — "skimming" → "skimm" → "skim", "running" → "runn" → "run".
  // Exclude common natural doubles: ll (small, all), ss (bliss), rr (purr),
  // ff (cliff), zz (buzz), gg (egg), tt — only collapse the ones produced
  // by the -ing/-ed/-er rules.
  if (w.length >= 4 && /([bcdghjkmnpqv])\1$/i.test(w)) w = w.slice(0, -1);
  return w;
};

// =====================================================================
//  IGCSE Business synonym groups.
//  Within each group, every word maps to the FIRST word as its canonical
//  form. Words go through the stemmer first so "employees", "employed",
//  "employment", "employs" all hit the same key.
// =====================================================================
const SYNONYM_GROUPS = [
  // ── Money / finance ──────────────────────────────────────────────
  ['money', 'cash', 'fund', 'finance', 'capital', 'currency', 'dollar', 'pound', 'euro', 'amount', 'sum', 'saving'],
  ['invest', 'put-in', 'put-into', 'inject', 'commit', 'contribute', 'inputed'],
  ['employment', 'job', 'work', 'role', 'position', 'occupation', 'contract-of-employment'],
  ['ended', 'end', 'terminate', 'stop', 'cease', 'finish', 'conclude'],
  ['against', 'unwilling', 'involuntary', 'forced', 'without-consent'],
  ['rule', 'regulation', 'policy', 'law', 'procedure', 'guideline', 'code'],
  ['size', 'scale', 'big', 'large', 'small', 'grown', 'magnitude'],
  ['unit', 'per-unit', 'per-item', 'each'],
  ['average', 'mean', 'typical', 'unit-cost'],
  ['profit', 'earning', 'gain', 'return', 'surplus', 'net', 'bottom-line'],
  ['loss', 'deficit', 'lose', 'shortfall'],
  ['cost', 'expense', 'spend', 'outlay', 'expenditure', 'outgoing', 'overhead'],
  ['price', 'fee', 'charge', 'rate', 'tariff'],
  ['revenue', 'turnover', 'sale', 'income', 'takings', 'receipt'],
  ['budget', 'allocation', 'forecast', 'plan'],
  ['cashflow', 'cash-flow', 'liquidity', 'liquid'],
  // Distinct finance concepts — don't merge these or you lose the ability
  // to distinguish "trade credit" from "bank loan" in Identify questions.
  ['loan', 'borrow', 'lending', 'lend', 'bank-loan'],
  ['credit', 'pay-later', 'on-credit', 'trade-credit', 'buy-now-pay-later'],
  ['debt', 'owed', 'amount-owed'],
  ['overdraft', 'short-term-borrowing'],
  ['factoring', 'debt-factoring', 'invoice-factoring'],
  ['share', 'equity', 'stake', 'stock'],
  ['shareholder', 'investor', 'stockholder', 'owner'],
  ['retain', 'reinvest', 'plough-back', 'keep'],
  ['interest', 'rate-of-return'],
  ['asset', 'property', 'holding', 'possession'],
  ['liability', 'debt-owed', 'obligation'],
  ['working-capital', 'circulating-capital'],
  ['break-even', 'break-even-point'],
  ['margin-of-safety', 'safety-margin'],
  ['gross-profit', 'trading-profit'],
  ['net-profit', 'final-profit'],

  // ── People / HR ─────────────────────────────────────────────────
  ['employee', 'worker', 'staff', 'workforce', 'labour', 'labor', 'personnel', 'crew'],
  ['manager', 'boss', 'supervisor', 'leader', 'director', 'executive', 'foreman', 'head'],
  ['owner', 'proprietor', 'founder', 'entrepreneur'],
  ['customer', 'client', 'consumer', 'buyer', 'shopper', 'purchaser'],
  ['supplier', 'vendor', 'wholesaler', 'distributor'],
  ['recruit', 'hire', 'employ', 'take-on', 'appoint', 'engage'],
  ['fire', 'dismiss', 'sack', 'terminate', 'let-go', 'discharge', 'remove'],
  ['quit', 'resign', 'leave'],
  ['promote', 'advance', 'elevate', 'upgrade'],
  ['train', 'teach', 'coach', 'develop', 'instruct', 'educate'],
  ['motivate', 'inspire', 'encourage', 'incentivise', 'incentivize', 'energise'],
  ['delegate', 'assign', 'hand-over', 'pass-on'],
  ['communicate', 'inform', 'tell', 'message', 'convey', 'report'],
  ['recruitment', 'hiring', 'staffing'],
  ['internal-recruit', 'promote-from-within', 'in-house'],
  ['external-recruit', 'outside-hire'],
  ['induction', 'orientation', 'on-boarding'],
  ['on-the-job', 'in-house-training'],
  ['off-the-job', 'external-training'],
  ['salary', 'wage', 'pay', 'remuneration', 'paycheque', 'paycheck'],
  ['bonus', 'incentive', 'reward', 'commission'],
  ['benefit', 'perk', 'fringe', 'allowance'],
  ['autocratic', 'authoritarian', 'top-down', 'dictatorial'],
  ['democratic', 'participative', 'consultative', 'collaborative'],
  ['laissez-faire', 'hands-off', 'delegating'],
  ['span-of-control', 'reports-to'],
  ['hierarchy', 'chain-of-command', 'reporting-line'],
  ['turnover', 'attrition', 'churn'],
  ['redundancy', 'lay-off', 'downsize', 'restructure'],
  ['union', 'trade-union', 'syndicate', 'organised-labour'],

  // ── Marketing ───────────────────────────────────────────────────
  ['market', 'industry', 'sector', 'audience'],
  ['marketing', 'promotion', 'publicity', 'communication'],
  ['advertise', 'promote', 'publicise', 'publicize', 'market'],
  ['brand', 'label', 'name', 'trademark'],
  ['product', 'good', 'item', 'merchandise', 'offering'],
  ['service', 'offering'],
  ['research', 'survey', 'study', 'investigation'],
  ['primary-research', 'first-hand-data', 'field-research'],
  ['secondary-research', 'desk-research', 'published-data'],
  ['questionnaire', 'survey', 'poll', 'form'],
  ['focus-group', 'discussion-group'],
  ['segment', 'group', 'cluster', 'category'],
  ['niche', 'specialist', 'specialised', 'specialized'],
  ['mass-market', 'broad-market', 'general-market'],
  ['target', 'aim-at', 'focus-on'],
  ['promotion', 'advertise', 'publicity', 'marketing-campaign'],
  ['discount', 'sale', 'reduction', 'mark-down', 'cut-price'],
  ['skim', 'price-skim', 'high-initial-price'],
  ['penetration', 'low-initial-price', 'entry-price'],
  ['cost-plus', 'mark-up', 'cost-based'],
  ['competitive-price', 'match-price', 'price-match'],
  ['promotional-price', 'special-offer'],
  ['distribute', 'deliver', 'supply', 'channel'],
  ['e-commerce', 'online-sale', 'online-shop', 'internet-sale'],
  ['retail', 'shop', 'store', 'high-street'],
  ['wholesale', 'bulk-sale'],
  ['life-cycle', 'product-lifecycle'],
  ['extension-strategy', 'lifecycle-extend'],
  ['marketing-mix', 'four-p', '4p', 'four-ps'],
  ['unique-selling-point', 'usp', 'unique-selling-proposition'],
  ['demand', 'want', 'need', 'desire', 'appetite'],
  ['supply', 'provision', 'availability'],
  ['competition', 'rivalry', 'competitive-pressure'],
  ['competitor', 'rival', 'opponent'],

  // ── Operations ──────────────────────────────────────────────────
  ['produce', 'make', 'manufacture', 'create', 'build', 'output', 'fabricate'],
  ['production', 'manufacturing', 'output', 'making'],
  ['job-production', 'one-off-production', 'custom-production'],
  ['batch-production', 'group-production'],
  ['flow-production', 'mass-production', 'continuous-production', 'assembly-line'],
  ['lean-production', 'lean-manufacturing'],
  ['just-in-time', 'jit', 'pull-system'],
  ['inventory', 'stock', 'supplies', 'goods-on-hand'],
  ['buffer-stock', 'safety-stock', 'reserve-stock'],
  ['quality', 'standard', 'grade', 'workmanship'],
  ['quality-control', 'qc', 'inspection'],
  ['quality-assurance', 'qa', 'process-quality'],
  ['total-quality-management', 'tqm', 'company-wide-quality'],
  ['kaizen', 'continuous-improvement', 'incremental-improvement'],
  ['automation', 'mechanise', 'robotic', 'machine-driven'],
  ['capacity', 'capability', 'output-limit'],
  ['utilisation', 'utilization', 'use-of-capacity'],
  ['productivity', 'output-per-worker', 'efficiency'],
  ['efficiency', 'productive', 'effective'],
  ['waste', 'wastage', 'spoilage', 'inefficiency'],
  ['supply-chain', 'logistics', 'distribution-chain'],
  ['outsource', 'sub-contract', 'contract-out'],
  ['technology', 'tech', 'innovation', 'digital'],
  ['location', 'site', 'place', 'position', 'situate'],
  ['economies-of-scale', 'scale-economies', 'bulk-savings'],
  ['diseconomies-of-scale', 'too-big', 'over-grown'],

  // ── External / economic ─────────────────────────────────────────
  ['globalisation', 'globalization', 'global-trade', 'international-trade'],
  ['multinational', 'mnc', 'global-company'],
  ['export', 'sell-abroad', 'overseas-sale', 'foreign-sale'],
  ['import', 'buy-abroad', 'overseas-purchase', 'foreign-purchase'],
  ['exchange-rate', 'currency-rate', 'forex'],
  ['appreciate', 'strengthen', 'rise-in-value'],
  ['depreciate', 'weaken', 'fall-in-value'],
  ['tariff', 'import-tax', 'import-duty', 'custom-duty'],
  ['quota', 'import-limit', 'trade-restriction'],
  ['protectionism', 'trade-barrier', 'protectionist-policy'],
  ['free-trade', 'open-trade', 'liberalised-trade'],
  ['recession', 'downturn', 'slump', 'contraction'],
  ['boom', 'expansion', 'upturn', 'growth-phase'],
  ['inflation', 'rising-price', 'price-rise', 'cost-of-living-rise'],
  ['deflation', 'falling-price'],
  ['interest-rate', 'borrowing-cost', 'cost-of-borrow'],
  ['business-cycle', 'economic-cycle', 'trade-cycle'],
  ['gdp', 'gross-domestic-product', 'national-output'],
  ['unemployment', 'jobless', 'out-of-work'],
  ['government', 'state', 'authority', 'public-sector'],
  ['tax', 'taxation', 'levy', 'duty'],
  ['subsidy', 'grant', 'support-payment'],
  ['regulation', 'rule', 'law', 'legislation', 'policy'],
  ['legal', 'lawful', 'statutory'],
  ['ethical', 'moral', 'principled', 'responsible'],
  ['environmental', 'green', 'eco-friendly', 'sustainable'],
  ['sustainable', 'eco-friendly', 'long-term-friendly', 'green'],
  ['recycle', 'reuse', 'reclaim'],
  ['renewable', 'green-energy', 'sustainable-energy'],
  ['pollution', 'contamination', 'emission'],
  ['carbon', 'greenhouse-gas', 'co2', 'emission'],
  ['pressure-group', 'lobby', 'activist-group', 'campaign-group'],
  ['stakeholder', 'interested-party'],

  // ── Ownership / structure ───────────────────────────────────────
  ['sole-trader', 'one-person-business', 'self-employed', 'sole-proprietor'],
  ['partnership', 'partners', 'joint-business'],
  ['private-limited', 'ltd', 'limited-company'],
  ['public-limited', 'plc', 'listed-company'],
  ['franchise', 'franchisee', 'franchisor', 'licensed-business'],
  ['cooperative', 'co-op', 'co-operative'],
  ['charity', 'non-profit', 'voluntary-org'],
  ['social-enterprise', 'mission-business'],
  ['public-sector', 'state-owned', 'government-owned'],
  ['private-sector', 'privately-owned'],
  ['limited-liability', 'liability-limited', 'capped-liability'],
  ['unlimited-liability', 'personal-liability', 'liability-unlimited'],
  ['incorporated', 'incorporation', 'separate-legal-entity'],
  ['unincorporated', 'no-separate-entity'],
  ['merger', 'combine', 'join-together', 'amalgamate'],
  ['takeover', 'acquisition', 'buy-out'],
  ['integration', 'merge', 'combine'],
  ['horizontal-integration', 'same-stage-merger'],
  ['vertical-integration', 'supply-chain-merger'],
  ['conglomerate', 'unrelated-merger', 'diversified-group'],

  // ── Concepts / measurements ────────────────────────────────────
  ['business', 'firm', 'company', 'enterprise', 'organisation', 'organization'],
  ['size', 'scale', 'magnitude'],
  ['grow', 'expand', 'enlarge', 'develop', 'increase'],
  ['shrink', 'decline', 'contract', 'reduce'],
  ['increase', 'rise', 'go-up', 'boost', 'higher'],
  ['decrease', 'fall', 'drop', 'go-down', 'lower', 'reduce', 'cut'],
  ['important', 'critical', 'vital', 'essential', 'key', 'crucial', 'significant'],
  ['good', 'beneficial', 'positive', 'great', 'excellent', 'advantage'],
  ['bad', 'negative', 'harmful', 'damaging', 'poor', 'disadvantage'],
  ['fast', 'quick', 'rapid', 'speedy'],
  ['slow', 'sluggish', 'gradual'],
  ['cheap', 'low-cost', 'inexpensive', 'budget', 'affordable'],
  ['expensive', 'high-cost', 'costly', 'dear', 'pricey'],
  ['risk', 'danger', 'hazard', 'threat'],
  ['opportunity', 'chance', 'opening', 'prospect'],
  ['strength', 'advantage', 'plus-point'],
  ['weakness', 'disadvantage', 'drawback', 'downside'],
  ['cause', 'lead-to', 'result-in', 'bring-about', 'trigger'],
  ['affect', 'impact', 'influence'],
  ['help', 'support', 'assist', 'aid'],
  ['need', 'require', 'demand'],
  ['provide', 'supply', 'offer', 'give', 'deliver'],
  ['reduce', 'cut', 'lower', 'decrease', 'minimise', 'minimize', 'shrink'],
  ['raise', 'lift', 'increase', 'boost', 'lift'],
  ['save', 'preserve', 'protect'],
  ['waste', 'squander', 'lose'],
  ['plan', 'strategy', 'roadmap', 'blueprint'],
  ['decision', 'choice', 'judgement', 'verdict'],
  ['objective', 'goal', 'aim', 'target', 'purpose'],
  ['policy', 'rule', 'guideline', 'principle'],
  ['profit-motive', 'making-money', 'maximise-profit', 'maximize-profit'],
  ['survival', 'staying-in-business', 'continuity'],
  ['market-share', 'percentage-of-market'],
  ['growth', 'expansion', 'development'],
  ['added-value', 'value-added', 'extra-value'],
  ['specialisation', 'specialization', 'division-of-labour', 'specialise'],
  ['opportunity-cost', 'next-best-alternative'],
  ['scarcity', 'limited-resource', 'shortage'],
  ['needs', 'essentials', 'necessities'],
  ['wants', 'desires', 'non-essentials']
];

// Build a map: stemmed-token → canonical-stemmed-token
const SYNONYM_MAP = new Map();
const PHRASE_MAP = new Map();      // multi-word original → hyphenated token
const buildMaps = () => {
  for (const group of SYNONYM_GROUPS) {
    const canonical = stem(group[0].replace(/-/g, ''));
    for (const word of group) {
      // Hyphenated phrase: preserve as a single token
      if (word.includes('-')) {
        const phraseKey = word.toLowerCase();
        PHRASE_MAP.set(phraseKey.replace(/-/g, ' '), word.toLowerCase());
        SYNONYM_MAP.set(stem(word.replace(/-/g, '')), canonical);
        SYNONYM_MAP.set(word.toLowerCase(), canonical);
      } else {
        SYNONYM_MAP.set(stem(word.toLowerCase()), canonical);
      }
    }
  }
};
buildMaps();

// =====================================================================
//  Tokenise text into a Set of canonical concept tokens.
//  1. Replace known multi-word phrases with hyphenated single tokens
//  2. Lowercase, strip punctuation
//  3. Drop stopwords + words shorter than 3 chars
//  4. Stem each remaining word
//  5. Look up in synonym map (canonicalise) — fall back to stemmed form
// =====================================================================
const NEGATION_WORDS = new Set(['not', 'no', 'never', 'without', "don't", "doesn't", "didn't", "isn't", "aren't", "wasn't", "weren't", "won't", "cannot", "can't"]);

export const conceptTokens = (text) => {
  if (!text) return new Set();
  let working = ' ' + text.toLowerCase() + ' ';
  // Replace known multi-word phrases first (longest first)
  const phrases = [...PHRASE_MAP.keys()].sort((a, b) => b.length - a.length);
  for (const phrase of phrases) {
    const hyph = PHRASE_MAP.get(phrase);
    working = working.replace(new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), hyph);
  }
  // Tokenise
  const cleaned = working
    .replace(/[^a-z0-9\-\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned.split(' ');

  const tokens = new Set();
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!w || w.length < 3) continue;
    if (STOPWORDS.has(w)) continue;
    // Skip token if preceded by a negation word in the previous 2 positions
    const prev1 = words[i - 1] || '';
    const prev2 = words[i - 2] || '';
    if (NEGATION_WORDS.has(prev1) || NEGATION_WORDS.has(prev2)) continue;

    const cleanedWord = w.replace(/^-+|-+$/g, '');
    const stemmedRaw  = stem(cleanedWord.replace(/-/g, ''));
    const canonical   = SYNONYM_MAP.get(stemmedRaw) || SYNONYM_MAP.get(cleanedWord) || stemmedRaw;
    if (canonical && canonical.length >= 3) tokens.add(canonical);
  }
  return tokens;
};

// =====================================================================
//  Semantic overlap between two strings — what fraction of the model
//  answer's concepts appear in the student answer (with synonym/stem
//  matching applied to both sides).
// =====================================================================
export const semanticCoverage = (studentText, modelText) => {
  const studentTokens = conceptTokens(studentText);
  const modelTokens   = conceptTokens(modelText);
  if (modelTokens.size === 0) return { coverage: 0, hits: [], missing: [] };
  const hits = [];
  const missing = [];
  for (const t of modelTokens) {
    if (studentTokens.has(t)) hits.push(t);
    else missing.push(t);
  }
  return {
    coverage: hits.length / modelTokens.size,
    hits,
    missing,
    studentTokens,
    modelTokens
  };
};

// =====================================================================
//  IDENTIFY-question scoring.
//
//  Splits the model answer into discrete candidate items, then for each
//  student segment checks whether it semantically matches ANY model item.
//  Score = matched / requiredCount.
// =====================================================================
const ITEM_SPLITTERS = /\s*(?:[,;•·]|\s\/\s|\s\-\s|\n|\.\s+(?=[A-Z])|\bor\b|\band\b)\s*/i;

export const extractCandidateItems = (modelText) => {
  if (!modelText) return [];
  // Strip mark-scheme boilerplate that often precedes the actual items
  let s = modelText
    .replace(/Award\s+\d+\s+marks?\s+[^\.]*\./gi, '')
    .replace(/Award\s+one\s+mark[^\.]*\./gi, '')
    .replace(/\(max\s+\d+\)/gi, '')
    .replace(/answers?\s+might\s+include\s*:?/gi, '')
    .replace(/justification\s+might\s+include\s*:?/gi, '')
    .replace(/possible\s+answers?\s*:?/gi, '')
    .replace(/\s+•\s*/g, ' • ')
    .trim();
  // Split on common separators
  const parts = s.split(ITEM_SPLITTERS)
    .map(p => p.replace(/[()]/g, '').replace(/^[-•*\s]+|[-•*\s]+$/g, '').trim())
    .filter(p => p.length >= 3 && p.length <= 80);
  // Dedupe by canonical-token signature
  const seen = new Set();
  const unique = [];
  for (const p of parts) {
    const sig = [...conceptTokens(p)].sort().join('|');
    if (!sig || seen.has(sig)) continue;
    seen.add(sig);
    unique.push(p);
  }
  return unique;
};

const studentItems = (studentText) => {
  if (!studentText) return [];
  // Split on the strict separators plus natural connectors like "and"/"or"/"+"
  // so "skim pricing and penetration" → ["skim pricing", "penetration"].
  return studentText
    .split(/[.\n\/;,]+|\s+\band\b\s+|\s+\bor\b\s+|\s*\+\s*|\s+&\s+/i)
    .map(s => s
      .replace(/^\s*[\(\[]?\s*\d+\s*[\)\]\.\:]\s*/, '')
      .replace(/^\s*[\(\[]?\s*[a-h]\s*[\)\]\.\:]\s*/i, '')
      .replace(/^[-•*\s]+/, '')
      .trim()
    )
    .filter(s => s.length >= 2);
};

// Candidate items that are obviously mark-scheme boilerplate rather than
// real answer items. If most candidates match these, the model answer
// was unparseable and we should fall back to overall semantic coverage.
const JUNK_CANDIDATE_RE = /^(?:to\s+use|the\s+(?:reference|following)|make\s+sense|do\s+not\s+accept|allow\s+only|application|indicative|award|possible|justification|other\s+appropriate|candidates?)\b/i;

export const markIdentifyAnswer = (studentText, modelText, requiredCount) => {
  const candidates = extractCandidateItems(modelText);
  // If we couldn't parse any items, or the items are all boilerplate,
  // fall back to overall semantic overlap. This protects students whose
  // past-paper question has a garbled model_answer.
  const junkCount = candidates.filter(c => JUNK_CANDIDATE_RE.test(c)).length;
  const allJunk   = candidates.length > 0 && junkCount / candidates.length >= 0.6;
  if (candidates.length === 0 || allJunk) {
    const c = semanticCoverage(studentText, modelText);
    return { ...c, matchedItems: [], candidateItems: [], fellBack: true };
  }
  // Strip junk candidates from the working list so they don't pollute matching
  const cleanCandidates = candidates.filter(c => !JUNK_CANDIDATE_RE.test(c));
  const workingCandidates = cleanCandidates.length > 0 ? cleanCandidates : candidates;
  // Build per-candidate token sets, then identify "common" tokens that appear
  // in 50%+ of candidates — these are the category word ("pricing", "method")
  // rather than discriminating words. Exclude them from match comparison
  // so "Cost-plus pricing" only matches "Cost-plus pricing", not every other
  // pricing entry that shares "pricing".
  const candidateTokens = workingCandidates.map(c => ({ text: c, tokens: conceptTokens(c) }));
  const tokenFreq = new Map();
  for (const c of candidateTokens) {
    for (const t of c.tokens) tokenFreq.set(t, (tokenFreq.get(t) || 0) + 1);
  }
  const totalCands = candidateTokens.length;
  const commonTokens = new Set();
  for (const [tok, n] of tokenFreq) {
    if (totalCands >= 2 && n / totalCands >= 0.5) commonTokens.add(tok);
  }
  // Drop common tokens from each candidate's discriminating set
  for (const c of candidateTokens) {
    c.discriminating = new Set([...c.tokens].filter(t => !commonTokens.has(t)));
    // If a candidate is left with no discriminating tokens (e.g. only had
    // common ones), fall back to its full token set.
    if (c.discriminating.size === 0) c.discriminating = c.tokens;
  }

  const segs = studentItems(studentText);
  const matchedItems = [];
  const matchedSet = new Set();
  for (const seg of segs) {
    const segTokens = conceptTokens(seg);
    let best = null, bestOverlap = 0;
    for (const cand of candidateTokens) {
      if (matchedSet.has(cand.text)) continue;
      let overlap = 0;
      for (const t of segTokens) if (cand.discriminating.has(t)) overlap++;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = cand;
      }
    }
    if (best && bestOverlap >= 1) {
      matchedItems.push({ student: seg, model: best.text });
      matchedSet.add(best.text);
    }
  }
  const required = Math.max(1, requiredCount || 1);
  const coverage = Math.min(1, matchedItems.length / required);
  const missing = workingCandidates.filter(c => !matchedSet.has(c));
  return {
    coverage,
    matchedItems,
    candidateItems: candidates,
    hits: matchedItems.map(m => m.model),
    missing
  };
};

// =====================================================================
//  DEFINE-question scoring.
//
//  Cambridge gives full marks for either:
//   (a) a clear paraphrase of the textbook definition, OR
//   (b) a concrete example that demonstrates the concept.
//
//  We compute semantic coverage of the model answer's concept tokens,
//  then boost it if the student includes an example AND touches the
//  topic. The topic is the term being defined.
// =====================================================================
const hasExampleMarkers = (answer) => {
  if (!answer) return false;
  if (/\b(for\s+example|for\s+instance|e\.?\s*g\.?|such\s+as|like|including|imagine|suppose|when|where|if)\b/i.test(answer)) return true;
  if (/\$\s*\d|\d+\s*%|\d+\s*(dollar|pound|euro|cent|year|employee|customer|unit|item|product|hour|day|month|kg|g|kilo)/i.test(answer)) return true;
  if (/\d+\s*(=|\+|-|–|—|to|×|\*|x)\s*\d+/.test(answer)) return true;
  return false;
};

export const markDefineAnswer = (studentText, modelText, topic) => {
  const c = semanticCoverage(studentText, modelText);
  const studentTokens = c.studentTokens || conceptTokens(studentText);
  let coverage = c.coverage;

  // Did the student touch the topic concept? Topic synonyms count
  // ("dismissal" canonicalises to "fire", so saying "fired" or "sacked"
  // both prove they're talking about the right concept.)
  const topicTokens = conceptTokens(topic || '');
  let topicTouched = false;
  for (const t of topicTokens) {
    if (studentTokens.has(t)) { topicTouched = true; break; }
  }

  // Define questions are graded on whether the student conveys the meaning,
  // not whether they parrot every model-answer word. So we credit by levels:
  //
  //  • If the student writes a real answer that touches the topic concept
  //    AND hits at least 1 model concept (or gives a worked example)
  //    → full credit. That's how Cambridge marks them.
  //
  //  • Topic touched + decent length but no model hits → partial.
  //
  //  • Multiple model hits (even without topic phrase) → full credit,
  //    because the student has clearly explained the concept.

  if (topicTouched && hasExampleMarkers(studentText)) {
    coverage = Math.max(coverage, 0.7);
  }
  // Cambridge mark-scheme rule: an illustrative worked example earns full
  // credit even if the student didn't recite the textbook definition.
  // Don't require literal topic mention — students often describe the
  // concept ("when a business grows, cost per item falls") without saying
  // the name ("economies of scale").
  if (hasExampleMarkers(studentText) && c.hits.length >= 1) {
    coverage = Math.max(coverage, 0.6);
  }
  if (topicTouched && c.hits.length >= 1) {
    coverage = Math.max(coverage, 0.55);
  }
  if (c.hits.length >= 2) {
    coverage = Math.max(coverage, 0.55);
  }
  if (c.hits.length >= 3) {
    coverage = Math.max(coverage, 0.7);
  }
  // Just mentioning the topic with a substantial answer earns partial,
  // since the student is clearly engaging with the right concept.
  if (topicTouched && studentTokens.size >= 4 && coverage < 0.25) {
    coverage = 0.25;
  }

  return { ...c, coverage, topicTouched };
};

// =====================================================================
//  Examiner-style heuristics — picks up the things a Cambridge marker
//  looks for beyond raw concept overlap.
// =====================================================================

// AO3 Analysis — cause-and-effect chains. Cambridge wants "because… so…"
// development, not just identification.
const ANALYSIS_CONNECTORS = [
  /\bbecause\b/i, /\bso\s+that\b/i,
  /\btherefore\b/i, /\bthus\b/i, /\bhence\b/i, /\bconsequently\b/i,
  /\bwhich\s+(means|leads?|will|causes?|results?|allows?|gives?|makes?)\b/i,
  /\bleading\s+to\b/i, /\blead\s+to\b/i,
  /\bresults?\s+in\b/i, /\bresult(ing)?\s+in\b/i,
  /\bdue\s+to\b/i, /\bas\s+a\s+result\b/i, /\bsince\b/i,
  /\bthis\s+(means|will|leads|causes|results|allows|gives|makes)\b/i,
  /\bwhich\s+is\s+why\b/i, /\bas\s+such\b/i,
  /\bso\s+(more|fewer|less|higher|lower|the|customers|sales|profit|revenue|costs)\b/i,
  /,\s*so\s+/i  // "raised price, so sales fell"
];
export const countAnalysisLinks = (text) => {
  if (!text) return 0;
  let n = 0;
  for (const re of ANALYSIS_CONNECTORS) if (re.test(text)) n++;
  return n;
};

// AO4 Evaluation — contrast markers + final judgement.
const CONTRAST_MARKERS = [
  /\bhowever\b/i, /\balthough\b/i, /\bthough\b/i,
  /\bdespite\b/i, /\bin\s+spite\s+of\b/i,
  /\bon\s+the\s+other\s+hand\b/i, /\bin\s+contrast\b/i,
  /\bwhereas\b/i, /\bwhile\b(?!st\b)/i,
  /\balternatively\b/i, /\bnevertheless\b/i, /\bconversely\b/i,
  /\bon\s+the\s+contrary\b/i, /\bbut\s+(also|some|many|the|it|this)\b/i
];
export const countContrastMarkers = (text) => {
  if (!text) return 0;
  let n = 0;
  for (const re of CONTRAST_MARKERS) if (re.test(text)) n++;
  return n;
};

const JUDGEMENT_MARKERS = [
  /\boverall\b/i, /\bin\s+conclusion\b/i, /\bto\s+conclude\b/i,
  /\bin\s+my\s+(view|opinion)\b/i, /\bi\s+(think|believe|feel)\b/i,
  /\bmy\s+view\b/i, /\bultimately\b/i, /\bon\s+balance\b/i,
  /\bthe\s+best\s+(option|choice|way|approach|method)\b/i,
  /\bmore\s+(important|effective|valuable)\s+than\b/i,
  /\bbetter\s+than\b/i, /\bworse\s+than\b/i,
  /\bwould\s+be\s+(best|better|wise|sensible)\b/i,
  /\bshould\s+(choose|pick|prefer|go\s+with|opt|focus)\b/i,
];
export const hasJudgement = (text) => {
  if (!text) return false;
  return JUDGEMENT_MARKERS.some(re => re.test(text));
};

// Specificity — Cambridge rewards specifics (numbers, % signs, real-world
// examples, references to the question stem details).
const REAL_COMPANY_RE = /\b(mcdonald|apple|tesco|coca[-\s]?cola|amazon|google|microsoft|samsung|nike|adidas|starbucks|toyota|ford|ferrari|unilever|nestlé|nestle|walmart|ikea|primark|asda|sainsbury|aldi|lidl|netflix|spotify|tesla|disney)\b/i;
export const specificityScore = (text) => {
  if (!text) return 0;
  let s = 0;
  if (/\d/.test(text)) s++;                                                  // any number
  if (/\d+\s*%|\d+\s*percent/.test(text)) s++;                               // percentage
  if (/[$£€¥]\s*\d|\d+\s*(dollar|pound|euro|cent|p\b)/i.test(text)) s++;     // currency
  if (REAL_COMPANY_RE.test(text)) s++;                                       // real firm
  if (/\b(for\s+example|for\s+instance|e\.?\s*g\.?|such\s+as)\b/i.test(text)) s++;
  return s;
};

// Length appropriateness — a 6-mark Explain needs more depth than a 2-mark
// Define. Returns the fraction of "expected content" the student actually
// wrote (capped at 1).
export const lengthAdequacy = (studentText, marks) => {
  if (!studentText) return 0;
  const tokens = conceptTokens(studentText);
  // Rough rule: ~3 content tokens per mark gives a full-credit answer
  // (matches Cambridge's "well-developed point" expectation of ~6 words
  // / ~3 content tokens per AO mark).
  const expected = Math.max(3, (marks || 4) * 3);
  return Math.min(1, tokens.size / expected);
};

// Circular definition detector — "Profit is when you make profit".
// Triggered when the student's content tokens are almost entirely the
// topic word(s) repeated.
export const isCircularDefinition = (studentText, topic) => {
  const studentTokens = conceptTokens(studentText);
  const topicTokens   = conceptTokens(topic);
  if (studentTokens.size === 0 || topicTokens.size === 0) return false;
  let overlap = 0;
  for (const t of studentTokens) if (topicTokens.has(t)) overlap++;
  // Very short answer + most tokens are the topic → circular
  if (studentTokens.size <= 3 && overlap / studentTokens.size >= 0.66) return true;
  // Longer answer but still 80%+ topic-only words
  if (studentTokens.size <= 5 && overlap / studentTokens.size >= 0.8) return true;
  return false;
};

// =====================================================================
//  Master entry point. Inspects the question type and delegates.
// =====================================================================
const COUNT_WORDS = { two: 2, three: 3, four: 4, five: 5, six: 6 };
const detectRequiredCount = (questionText) => {
  if (!questionText) return 1;
  const m = questionText.toLowerCase().match(/\b(two|three|four|five|six|2|3|4|5|6)\b/);
  if (!m) return 1;
  return COUNT_WORDS[m[1]] || parseInt(m[1], 10) || 1;
};

export const markAnswer = (studentText, question) => {
  const required = detectRequiredCount(question.questionText);
  const cmd = question.commandWord || '';
  const model = question.modelAnswer || '';

  // Identify — strict per-item matching, no fallback (a 2-item list answer
  // must actually contain 2 items).
  if (cmd === 'Identify') {
    const r = markIdentifyAnswer(studentText, model, required);
    return { ...r, mode: 'identify', requiredCount: required };
  }
  // Outline — try per-item matching first, but if the model-answer is
  // garbled and yields a poor candidate list, fall back to overall
  // semantic coverage. This protects students who wrote a great paragraph
  // when the past-paper mark-scheme PDF was unparseable.
  if (cmd === 'Outline' && required >= 2) {
    const itemR = markIdentifyAnswer(studentText, model, required);
    const semR  = semanticCoverage(studentText, model);
    if (semR.coverage > itemR.coverage) {
      return { ...semR, mode: 'explain', requiredCount: required };
    }
    return { ...itemR, mode: 'identify', requiredCount: required };
  }

  // Define — paraphrase / example detection.
  if (cmd === 'Define') {
    const r = markDefineAnswer(studentText, model, question.topic);
    return { ...r, mode: 'define', requiredCount: 1 };
  }

  // Explain / Justify and everything else — overall semantic coverage with
  // a multi-item bonus if the question asks for two/three points.
  const c = semanticCoverage(studentText, model);
  if (required >= 2) {
    // Reward students who wrote distinct items even if their wording differs
    const segs = studentItems(studentText);
    if (segs.length > 0) {
      const itemHitFraction = Math.min(1,
        segs.filter(s => {
          const t = conceptTokens(s);
          for (const tok of t) if (c.modelTokens?.has?.(tok)) return true;
          return false;
        }).length / required
      );
      c.coverage = Math.max(c.coverage, itemHitFraction);
    }
  }
  return { ...c, mode: 'explain', requiredCount: required };
};
