/**
 * Debate topic suggestions to help users get started
 * Supports debates on any topic including movies, music, AI, technology, products, and general topics
 * Per Requirement 1.4: THE Debate_Platform SHALL support debates on any topic
 */
export const DEBATE_TEMPLATES = [
  {
    category: 'Technology',
    icon: '💻',
    topics: [
      'AI will create more jobs than it destroys in the next decade',
      'Social media does more harm than good for society',
      'Remote work is more productive than office work for most roles',
      'Cryptocurrency will replace traditional banking within 20 years',
    ],
  },
  {
    category: 'Society',
    icon: '🏛️',
    topics: [
      'Universal basic income should be implemented in developed countries',
      'College education is overvalued in today\'s job market',
      'Voting should be mandatory for all eligible citizens',
      'The 4-day work week should become the standard',
    ],
  },
  {
    category: 'Ethics',
    icon: '⚖️',
    topics: [
      'It is ethical to use AI-generated art commercially',
      'Companies should be required to disclose their carbon footprint',
      'Privacy is more important than security in the digital age',
      'Genetic engineering of humans should be allowed for disease prevention',
    ],
  },
  {
    category: 'Science',
    icon: '🔬',
    topics: [
      'Space exploration funding should be prioritized over ocean exploration',
      'Nuclear energy is essential for combating climate change',
      'Lab-grown meat will replace traditional farming within 30 years',
      'Human colonization of Mars is achievable by 2050',
    ],
  },
  {
    category: 'Entertainment',
    icon: '🎬',
    topics: [
      'Streaming services have improved the quality of TV shows',
      'Video games are a legitimate art form',
      'Movie remakes are rarely better than the originals',
      'Live concerts are worth the premium price over recorded music',
    ],
  },
  {
    category: 'Products',
    icon: '📱',
    topics: [
      'Electric vehicles are ready to replace gas cars for most consumers',
      'Subscription models are better than one-time purchases for software',
      'Smart home devices improve quality of life more than they invade privacy',
      'Open source software is more reliable than proprietary alternatives',
    ],
  },
];

export type DebateCategory = typeof DEBATE_TEMPLATES[number]['category'];

/**
 * Get all available categories
 */
export function getCategories(): { category: string; icon: string }[] {
  return DEBATE_TEMPLATES.map(({ category, icon }) => ({ category, icon }));
}

/**
 * Get a random topic from all categories
 */
export function getRandomTopic(): string {
  const allTopics = DEBATE_TEMPLATES.flatMap(cat => cat.topics);
  return allTopics[Math.floor(Math.random() * allTopics.length)];
}

/**
 * Get a random topic from a specific category
 */
export function getRandomTopicFromCategory(category: string): string | null {
  const cat = DEBATE_TEMPLATES.find(c => c.category === category);
  if (!cat || cat.topics.length === 0) return null;
  return cat.topics[Math.floor(Math.random() * cat.topics.length)];
}

/**
 * Get topics by category
 */
export function getTopicsByCategory(category: string): string[] {
  const cat = DEBATE_TEMPLATES.find(c => c.category === category);
  return cat?.topics ?? [];
}

/**
 * Get all topics flattened
 */
export function getAllTopics(): string[] {
  return DEBATE_TEMPLATES.flatMap(cat => cat.topics);
}
