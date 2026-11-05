// Map engine-specific kinds onto two Grammarly-style buckets:
//   correctness (red underline): spelling, grammar, punctuation, word choice
//   clarity     (blue underline): style, readability, redundancy, formatting

const HARPER_CLARITY = new Set([
  'Readability',
  'Redundancy',
  'Style',
  'Enhancement',
  'Formatting',
]);

const HARPER_LABELS = {
  Spelling: 'Spelling',
  Typo: 'Spelling',
  Grammar: 'Grammar',
  Agreement: 'Agreement',
  WordChoice: 'Word choice',
  Malapropism: 'Word choice',
  Eggcorn: 'Word choice',
  Usage: 'Usage',
  BoundaryError: 'Spacing',
  Nonstandard: 'Usage',
  WordOrder: 'Word order',
  Repetition: 'Repeated word',
  Capitalization: 'Capitalisation',
  Punctuation: 'Punctuation',
  Regionalism: 'British spelling',
  Readability: 'Readability',
  Redundancy: 'Redundancy',
  Style: 'Style',
  Enhancement: 'Enhancement',
  Formatting: 'Formatting',
  Miscellaneous: 'Grammar',
};

export function harperCategory(kind) {
  return HARPER_CLARITY.has(kind) ? 'clarity' : 'correctness';
}

export function harperLabel(kind) {
  return HARPER_LABELS[kind] || kind;
}

const LT_CLARITY_CATEGORIES = new Set([
  'STYLE',
  'REDUNDANCY',
  'PLAIN_ENGLISH',
  'TYPOGRAPHY',
  'COLLOQUIALISMS',
  'REPETITIONS_STYLE',
  'WIKIPEDIA',
  'SEMANTICS',
]);

const LT_LABELS = {
  TYPOS: 'Spelling',
  GRAMMAR: 'Grammar',
  PUNCTUATION: 'Punctuation',
  CASING: 'Capitalisation',
  CONFUSED_WORDS: 'Word choice',
  COMPOUNDING: 'Hyphenation',
  COLLOCATIONS: 'Word choice',
  MISC: 'Suggestion',
  NONSTANDARD_PHRASES: 'Usage',
  BRITISH_ENGLISH: 'British spelling',
  AMERICAN_ENGLISH: 'Regional spelling',
  STYLE: 'Style',
  REDUNDANCY: 'Redundancy',
  PLAIN_ENGLISH: 'Plain English',
  TYPOGRAPHY: 'Typography',
  COLLOQUIALISMS: 'Tone',
  REPETITIONS_STYLE: 'Repetition',
  SEMANTICS: 'Logic',
};

export function ltCategory(match) {
  const cat = match.rule?.category?.id || '';
  const issue = match.rule?.issueType || '';
  if (LT_CLARITY_CATEGORIES.has(cat) || issue === 'style' || issue === 'register') return 'clarity';
  return 'correctness';
}

export function ltLabel(match) {
  const cat = match.rule?.category?.id || '';
  return LT_LABELS[cat] || match.rule?.category?.name || 'Suggestion';
}

export function isSpellingIssue(issue) {
  return issue.label === 'Spelling';
}
