/**
 * Debate topic suggestions to help users get started
 */
export const DEBATE_TEMPLATES = [
  {
    category: 'Technology',
    topics: [
      'AI will create more jobs than it destroys in the next decade',
      'Social media does more harm than good for society',
      'Remote work is more productive than office work for most roles',
      'Cryptocurrency will replace traditional banking within 20 years',
    ],
  },
  {
    category: 'Society',
    topics: [
      'Universal basic income should be implemented in developed countries',
      'College education is overvalued in today\'s job market',
      'Voting should be mandatory for all eligible citizens',
      'The 4-day work week should become the standard',
    ],
  },
  {
    category: 'Ethics',
    topics: [
      'It is ethical to use AI-generated art commercially',
      'Companies should be required to disclose their carbon footprint',
      'Privacy is more important than security in the digital age',
      'Genetic engineering of humans should be allowed for disease prevention',
    ],
  },
  {
    category: 'Science',
    topics: [
      'Space exploration funding should be prioritized over ocean exploration',
      'Nuclear energy is essential for combating climate change',
      'Lab-grown meat will replace traditional farming within 30 years',
      'Human colonization of Mars is achievable by 2050',
    ],
  },
];

/**
 * Get a random topic from all categories
 */
export function getRandomTopic(): string {
  const allTopics = DEBATE_TEMPLATES.flatMap(cat => cat.topics);
  return allTopics[Math.floor(Math.random() * allTopics.length)];
}

/**
 * Get topics by category
 */
export function getTopicsByCategory(category: string): string[] {
  const cat = DEBATE_TEMPLATES.find(c => c.category === category);
  return cat?.topics ?? [];
}

export default DEBATE_TEMPLATES;
