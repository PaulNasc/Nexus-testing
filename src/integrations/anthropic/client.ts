export async function anthropicGenerateText(prompt: string, model: string, apiKey?: string): Promise<string> {
  if (!apiKey) throw new Error('Anthropic: API key não configurada');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic error: ${res.status} ${err}`);
  }
  const data = await res.json();
  const content = data?.content?.[0]?.text || data?.output_text;
  if (!content) throw new Error('Anthropic: resposta vazia');
  return content as string;
}
