export const validIdea = {
  id: 'gen-test-idea-id',
  title: 'Campus Ride Share',
  description: 'A platform for students to share rides.',
  problem: 'Students waste money on transport',
  features: ['Live map', 'Cost split'],
  stack: ['React Native', 'NestJS'],
  techStack: ['React Native', 'NestJS'],
  roadmap: ['Week 1: design', 'Week 2: MVP'],
  difficulty: 'INTERMEDIATE',
  domain: 'AI',
};

export const llmMock = {
  calls: 0,
  mode: 'ok' as 'ok' | 'error' | 'badjson' | 'missing' | 'fenced',
  reset() {
    this.calls = 0;
    this.mode = 'ok';
  },
  async complete(_prompt: string): Promise<string> {
    this.calls++;
    switch (this.mode) {
      case 'error':
        throw new Error('LLM down');
      case 'badjson':
        return 'this is not json';
      case 'missing':
        return JSON.stringify({ title: 'Only title' });
      case 'fenced':
        return '```json\n' + JSON.stringify(validIdea) + '\n```';
      default:
        return JSON.stringify(validIdea);
    }
  },
  async generateIdea(dto: any) {
    this.calls++;
    switch (this.mode) {
      case 'error':
        throw new Error('LLM down');
      case 'badjson':
        return { title: 'bad' };
      case 'missing':
        return { title: 'Only title' };
      case 'fenced':
      default:
        return { ...validIdea, ...dto };
    }
  },
};
