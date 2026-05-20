export async function ollamaGenerateText(prompt: string, model: string, baseUrl = 'http://localhost:11434'): Promise<string> {
  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama error: ${res.status} ${err}`);
  }
  const data = await res.json();
  const content = data?.response;
  if (!content) throw new Error('Ollama: resposta vazia');
  return content as string;
}
