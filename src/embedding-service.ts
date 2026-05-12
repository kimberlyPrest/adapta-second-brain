import { requestUrl } from 'obsidian';
import { PluginSettings } from './types';

export class EmbeddingService {
  private apiKey: string;
  private model: string;

  constructor(settings: PluginSettings) {
    this.apiKey = settings.openaiApiKey;
    this.model = settings.embeddingModel || 'text-embedding-3-small';
  }

  async embed(texts: string[]): Promise<number[][]> {
    const { embeddings } = await this.embedBatch(texts);
    return embeddings;
  }

  async embedBatch(texts: string[]): Promise<{ embeddings: number[][]; tokens: number; cost: number }> {
    if (texts.length === 0) return { embeddings: [], tokens: 0, cost: 0 };

    const batchSize = 100;
    const allEmbeddings: number[][] = [];
    let totalTokens = 0;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      try {
        const response = await requestUrl({
          url: 'https://api.openai.com/v1/embeddings',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            input: batch,
          }),
        });

        if (response.status !== 200) {
          throw new Error(`OpenAI API error: ${response.status} - ${response.text}`);
        }

        const json = response.json as {
          data: Array<{ embedding: number[] }>;
          usage: { total_tokens: number };
        };

        allEmbeddings.push(...json.data.map((d) => d.embedding));
        totalTokens += json.usage.total_tokens;
      } catch (error) {
        console.error('Embedding error:', error);
        throw error;
      }
    }

    const pricePerMillion = this.model === 'text-embedding-3-small' ? 0.02 : 0.13;
    const totalCost = (totalTokens / 1_000_000) * pricePerMillion;

    return { embeddings: allEmbeddings, tokens: totalTokens, cost: totalCost };
  }
}


