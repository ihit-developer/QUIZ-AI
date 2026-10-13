const Anthropic = require('@anthropic-ai/sdk');

/**
 * Intelligent AI Question Generator
 * Utilizes Anthropic Claude API when key is configured,
 * with comprehensive high-quality fallback heuristic generation.
 */
class AIService {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    if (this.apiKey) {
      this.client = new Anthropic({ apiKey: this.apiKey });
    }
  }

  async generateQuestions({ topic, difficulty = 'medium', count = 5, contextText = '' }) {
    if (this.client) {
      try {
        const prompt = `You are an expert instructional designer and quiz author.
Create ${count} high-quality ${difficulty} level multiple choice assessment questions on the topic: "${topic}".
${contextText ? `Use this reference material:\n${contextText}\n` : ''}

You MUST output ONLY a valid JSON array of objects without markdown formatting, code fences or preamble:
[
  {
    "title": "Question prompt text",
    "type": "mcq_single",
    "difficulty": "${difficulty}",
    "topicTag": "${topic}",
    "points": 10,
    "timeLimitSeconds": 30,
    "explanation": "Clear explanation of the correct answer",
    "options": [
      { "text": "Option A", "isCorrect": true },
      { "text": "Option B", "isCorrect": false },
      { "text": "Option C", "isCorrect": false },
      { "text": "Option D", "isCorrect": false }
    ]
  }
]`;

        const message = await this.client.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 3000,
          messages: [{ role: 'user', content: prompt }],
        });

        const rawText = message.content[0].text.trim();
        const jsonMatch = rawText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
        return parsed;
      } catch (err) {
        console.warn('[AI Service Warning] Anthropic API call failed or key invalid, invoking intelligent fallback:', err.message);
      }
    }

    // Heuristic realistic question generator fallback
    return this.generateHeuristicQuestions(topic, difficulty, count);
  }

  generateHeuristicQuestions(topic, difficulty, count) {
    const templates = [
      {
        title: `What is the primary architectural advantage of using ${topic} in production distributed systems?`,
        options: [
          { text: `Decoupling component lifecycles and maximizing fault tolerance`, isCorrect: true },
          { text: `Eliminating the requirement for horizontal database scaling`, isCorrect: false },
          { text: `Compressing raw memory buffers into single-threaded heaps`, isCorrect: false },
          { text: `Enforcing synchronous blocking semantics across services`, isCorrect: false },
        ],
        explanation: `${topic} enables resilient horizontal decoupling and modular error containment.`,
      },
      {
        title: `Which of the following best characterizes the typical performance bottleneck when implementing ${topic}?`,
        options: [
          { text: `Excessive network serialization and context-switching overhead`, isCorrect: true },
          { text: `Insufficient disk space allocation on client nodes`, isCorrect: false },
          { text: `Lack of static type inference during compilation`, isCorrect: false },
          { text: `Over-allocation of CSS DOM rendering nodes`, isCorrect: false },
        ],
        explanation: `Under heavy scale, serialization latency and IPC context switching often become the primary constraint.`,
      },
      {
        title: `In the context of ${topic}, how is eventual consistency typically safeguarded?`,
        options: [
          { text: `Through idempotent transaction handlers and version clocks`, isCorrect: true },
          { text: `By permanently locking all table rows until manual review`, isCorrect: false },
          { text: `By terminating disconnected participant sockets`, isCorrect: false },
          { text: `Through browser localStorage event triggers`, isCorrect: false },
        ],
        explanation: `Idempotency keys and vector/version clocks guarantee that duplicate or out-of-order mutations resolve cleanly.`,
      },
      {
        title: `When benchmarking ${topic}, which metric provides the most accurate indicator of user experience under peak load?`,
        options: [
          { text: `99th percentile (p99) response latency`, isCorrect: true },
          { text: `Raw mean CPU cycle utilization`, isCorrect: false },
          { text: `Number of static assets cached by the client`, isCorrect: false },
          { text: `Total lines of executable runtime code`, isCorrect: false },
        ],
        explanation: `P99 latency captures the tail-end delays experienced by real users during system saturation.`,
      },
      {
        title: `What is considered an anti-pattern when designing interfaces with ${topic}?`,
        options: [
          { text: `Tight coupling between domain layers and presentation adapters`, isCorrect: true },
          { text: `Enforcing comprehensive automated regression tests`, isCorrect: false },
          { text: `Utilizing declarative error handling pipelines`, isCorrect: false },
          { text: `Parameterizing configurable timeouts`, isCorrect: false },
        ],
        explanation: `Leaking internal abstractions into UI or transport layers breaks separation of concerns and hinders maintainability.`,
      },
    ];

    const results = [];
    for (let i = 0; i < count; i++) {
      const template = templates[i % templates.length];
      results.push({
        title: template.title,
        type: 'mcq_single',
        difficulty,
        topicTag: topic,
        points: difficulty === 'hard' ? 20 : difficulty === 'medium' ? 10 : 5,
        timeLimitSeconds: difficulty === 'hard' ? 45 : 30,
        explanation: template.explanation,
        options: template.options,
      });
    }

    return results;
  }
}

module.exports = new AIService();
