export async function groqGenerateText(prompt: string, model: string, apiKey?: string): Promise<string> {
  if (!apiKey) throw new Error('Groq: API key não configurada');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    let raw = '';
    try { raw = await res.text(); } catch { /* ignore */ }
    // Tente parsear JSON de erro
    try {
      const data = raw ? JSON.parse(raw) : undefined;
      const message = data?.error?.message || data?.message || raw || 'Erro desconhecido';
      // Ajuda específica para 404 de modelo não encontrado
      if (res.status === 404 && /model/i.test(message)) {
        throw new Error(`Groq: modelo não encontrado ("${model}"). Verifique o slug correto no campo settings.apiModel (ex: "llama-3.1-70b-versatile"). Detalhes: ${message}`);
      }
      throw new Error(`Groq error: ${res.status} ${message}`);
    } catch {
      throw new Error(`Groq error: ${res.status} ${raw || 'Resposta inválida'}`);
    }
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq: resposta vazia');
  return content as string;
}
