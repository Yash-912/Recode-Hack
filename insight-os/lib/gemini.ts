// ─── AI API Helper ───────────────────────────────────────
// Centralised AI client for Signal Cards, Narratives, and Heatmap AI
// Switched from native Gemini to OpenRouter to bypass quota limitations

const apiKey = process.env.OPENROUTER_API_KEY || '';

// Simple in-memory cache to avoid burning API quota on repeated calls
const responseCache = new Map<string, { result: string; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function askGemini(prompt: string): Promise<string> {
  if (!apiKey) {
    return 'OpenRouter API key not configured. Set OPENROUTER_API_KEY in .env';
  }

  // Check cache first
  const cacheKey = prompt.substring(0, 200);
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.result;
  }

  const maxRetries = 2;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:3000', // OpenRouter requires these headers
          'X-Title': 'Insight-OS',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Switched to an OpenAI model as requested!
          model: 'openai/gpt-4o-mini', 
          messages: [
            { role: 'user', content: prompt }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`OpenRouter Error ${response.status}: ${errorData}`);
      }

      const data = await response.json();
      const text = data.choices[0]?.message?.content || '';
      
      responseCache.set(cacheKey, { result: text, ts: Date.now() });
      return text;

    } catch (error: any) {
      const isRateLimit = error?.message?.includes('429') || error?.message?.includes('quota');
      
      if (isRateLimit && attempt < maxRetries - 1) {
        await sleep(Math.pow(2, attempt + 1) * 2000);
        continue;
      }
      
      console.error('[OpenRouter] API Error:', error?.message || error);
      return `AI temporarily unavailable. Try again in a few minutes.`;
    }
  }

  return 'AI temporarily unavailable (quota limit). Try again in a few minutes.';
}
