import { TestPlan, TestCase, TestExecution, Requirement, Defect } from '@/types';
import { priorityLabel, testCaseTypeLabel, executionStatusLabel } from '@/lib/labels';

export type ExportFormat = 'pdf' | 'word' | 'txt' | 'md';

// Função de tradução de status
const translateStatus = (status: string) => {
  const statusMap: { [key: string]: string } = {
    'open': 'Aberto',
    'closed': 'Fechado',
    'in_progress': 'Em andamento',
    'resolved': 'Resolvido',
    'pending': 'Pendente',
    'approved': 'Aprovado',
    'rejected': 'Rejeitado',
    'active': 'Ativo',
    'inactive': 'Inativo',
    'draft': 'Rascunho',
    'review': 'Em revisão',
    'passed': 'Aprovado',
    'failed': 'Reprovado',
    'blocked': 'Bloqueado',
    'not_tested': 'Não testado'
  };
  return statusMap[status] || status;
};

// Helpers de formatação para exportação
const normalizeText = (s?: string) => (s ?? '').toString().trim();

const hasListMarkers = (s: string) => {
  return /^(?:[-•\u00BA]|#\d+\s+)/m.test(s) || /\n\s*[-•\u00BA]/.test(s);
};

// Converte blocos em Markdown com listas quando apropriado
const toMarkdownListOrParagraph = (s: string): string => {
  const text = normalizeText(s);
  if (!text) return '';

  if (text.startsWith('Contexto consolidado por caso:')) {
    const [, ...lines] = text.split(/\r?\n/);
    const items = lines.filter(Boolean).map(l => l.replace(/^#\d+\s*/, '').trim());
    return ['Contexto consolidado por caso:', ...items.map((i, idx) => `${idx + 1}. ${i}`)].join('\n');
  }

  if (hasListMarkers(text)) {
    return text
      .split(/\r?\n/)
      .map(l => {
        const t = l.trim();
        if (!t) return '';
        if (/^[-•]/.test(t)) return `- ${t.replace(/^[-•]\s*/, '')}`;
        if (/^\u00BA/.test(t)) return `- ${t.replace(/^\u00BA\s*/, '')}`;
        if (/^#\d+\s+/.test(t)) return `- ${t.replace(/^#\d+\s+/, '')}`;
        return t;
      })
      .join('\n');
  }

  if (/branch/i.test(text) && text.includes(',')) {
    const parts = text.split(/[:,]/).map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      const [label, ...rest] = parts;
      const items = rest.map(r => r.replace(/^e\s+/i, '').trim()).filter(Boolean);
      if (items.length) {
        return `${label}:\n${items.map(i => `* ${i}`).join('\n')}`;
      }
    }
  }

  return text;
};

// Converte texto para HTML com listas quando apropriado, preservando quebras de linha
const toHTMLListOrParagraph = (s: string): string => {
  const text = normalizeText(s);
  if (!text) return '';

  const escape = (str: string) => str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const renderUL = (items: string[], bulletPrefix?: string) => {
    return `<ul>${items.map(i => `<li>${bulletPrefix ? `${bulletPrefix}` : ''}${escape(i)}</li>`).join('')}</ul>`;
  };

  if (text.startsWith('Contexto consolidado por caso:')) {
    const [label, ...lines] = text.split(/\r?\n/);
    const items = lines.filter(Boolean).map(l => l.replace(/^#\d+\s*/, '').trim());
    const renderOL = (it: string[]) => `<ol>${it.map(i => `<li>${escape(i)}</li>`).join('')}</ol>`;
    return `<p>${escape(label)}</p>${renderOL(items)}`;
  }

  if (hasListMarkers(text)) {
    const items = text
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => l.replace(/^[-•\u00BA]\s*/, '').replace(/^#\d+\s+/, ''));
    return renderUL(items);
  }

  if (/branch/i.test(text) && text.includes(',')) {
    const [label, rest] = text.split(/:/, 2);
    const items = (rest || '').split(',').map(p => p.replace(/^e\s+/i, '').trim()).filter(Boolean);
    if (items.length) {
      return `<p>${escape(label)}:</p><ul style="list-style:none; padding-left:0; margin:0 0 12px 0;">${items.map(i => `<li>• ${escape(i)}</li>`).join('')}</ul>`;
    }
  }

  return `<p>${escape(text).replace(/\r?\n/g, '<br/>')}</p>`;
};

export const exportItem = async (
  item: TestPlan | TestCase | TestExecution | Requirement | Defect,
  type: 'plan' | 'case' | 'execution' | 'requirement' | 'defect',
  format: ExportFormat
) => {
  const content = generateContent(item, type, format);
  const filename = getFilename(item, type, format);
  
  if (format === 'pdf') {
    await exportToPDF(content, filename);
  } else if (format === 'word') {
    downloadWordFile(content, filename);
  } else {
    downloadTextFile(content, filename, format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8');
  }
};

export const copyToClipboard = async (
  item: TestPlan | TestCase | TestExecution | Requirement | Defect,
  type: 'plan' | 'case' | 'execution' | 'requirement' | 'defect',
  format: ExportFormat
) => {
  const content = generateContent(item, type, format);
  await navigator.clipboard.writeText(content);
};

const generateContent = (
  item: TestPlan | TestCase | TestExecution | Requirement | Defect,
  type: 'plan' | 'case' | 'execution' | 'requirement' | 'defect',
  format: ExportFormat
): string => {
  const title = getItemTitle(item, type);
  const description = getItemDescription(item, type);
  
  switch (format) {
    case 'md':
      return generateMarkdownContent(item, type, title, description);
    case 'txt':
      return generateTextContent(item, type, title, description);
    default:
      return generateHTMLContent(item, type, title, description);
  }
};

const generateMarkdownContent = (
  item: TestPlan | TestCase | TestExecution | Requirement | Defect,
  type: 'plan' | 'case' | 'execution' | 'requirement' | 'defect',
  title: string,
  description: string
): string => {
  let content = `# ${title}\n\n`;
  if (description) {
    content += `## Descrição\n${toMarkdownListOrParagraph(description)}\n\n`;
  }
  
  if (type === 'plan' && 'objective' in item) {
    if ((item as any).objective) content += `## Objetivo\n${toMarkdownListOrParagraph((item as any).objective || '')}\n\n`;
    if ((item as any).scope) content += `## Escopo\n${toMarkdownListOrParagraph((item as any).scope || '')}\n\n`;
    if ((item as any).approach) content += `## Abordagem\n${toMarkdownListOrParagraph((item as any).approach || '')}\n\n`;
    if ((item as any).criteria) content += `## Critérios\n${toMarkdownListOrParagraph((item as any).criteria || '')}\n\n`;
    if ((item as any).resources) content += `## Recursos\n${toMarkdownListOrParagraph((item as any).resources || '')}\n\n`;
    if ((item as any).schedule) content += `## Cronograma\n${toMarkdownListOrParagraph((item as any).schedule || '')}\n\n`;
    if ((item as any).risks) content += `## Riscos\n${toMarkdownListOrParagraph((item as any).risks || '')}\n\n`;
    if ((item as any).status) content += `**Status:** ${translateStatus((item as any).status)}\n\n`;
  }
  
  if (type === 'case' && 'steps' in item) {
    if (item.preconditions) {
      content += `## Pré-condições\n${item.preconditions}\n\n`;
    }
    
    if (Array.isArray(item.steps) && item.steps.length > 0) {
      content += `## Passos de Teste\n\n`;
      content += `| Passo | Ação | Resultado Esperado |\n`;
      content += `|-------|------|--------------------|\n`;
      item.steps.forEach((step: any, index: number) => {
        content += `| ${step.order || index + 1} | ${step.action || ''} | ${step.expected_result || ''} |\n`;
      });
      content += '\n';
    }
    
    if (item.expected_result) {
      content += `## Resultado Final Esperado\n${item.expected_result}\n\n`;
    }
    
    if (item.priority) {
      content += `**Prioridade:** ${priorityLabel((item as any).priority)}\n\n`;
    }
    
    if (item.type) {
      content += `**Tipo:** ${testCaseTypeLabel((item as any).type)}\n\n`;
    }
  }
  
  if (type === 'execution') {
    const execution = item as TestExecution;
    content += `**Status:** ${executionStatusLabel(execution.status as any)}\n\n`;
    if (execution.executed_by) content += `**Executor:** ${execution.executed_by}\n\n`;
    if (execution.executed_at) content += `**Data da Execução:** ${new Date(execution.executed_at).toLocaleString('pt-BR')}\n\n`;
    if (execution.actual_result) content += `## Resultado Obtido\n${execution.actual_result}\n\n`;
    if (execution.notes) content += `## Notas\n${execution.notes}\n\n`;
  }

  if (type === 'defect') {
    const defect = item as Defect;
    content += `**Status:** ${translateStatus(defect.status)}\n\n`;
    content += `**Severidade:** ${priorityLabel(defect.severity as any)}\n\n`;
    if (defect.description) content += `## Descrição\n${defect.description}\n\n`;
  }
  
  return content;
};

const generateTextContent = (
  item: TestPlan | TestCase | TestExecution | Requirement | Defect,
  type: 'plan' | 'case' | 'execution' | 'requirement' | 'defect',
  title: string,
  description: string
): string => {
  let content = `${title}\n${'='.repeat(title.length)}\n\n`;
  if (description) {
    content += `DESCRIÇÃO:\n${toMarkdownListOrParagraph(description)}\n\n`;
  }
  
  if (type === 'plan' && 'objective' in item) {
    if ((item as any).objective) content += `OBJETIVO:\n${(item as any).objective}\n\n`;
    if ((item as any).scope) content += `ESCOPO:\n${(item as any).scope}\n\n`;
    if ((item as any).approach) content += `ABORDAGEM:\n${(item as any).approach}\n\n`;
    if ((item as any).criteria) content += `CRITÉRIOS:\n${(item as any).criteria}\n\n`;
    if ((item as any).status) content += `STATUS: ${translateStatus((item as any).status)}\n\n`;
  }
  
  if (type === 'case' && 'steps' in item) {
    if (item.preconditions) {
      content += `PRÉ-CONDIÇÕES:\n${item.preconditions}\n\n`;
    }
    
    if (Array.isArray(item.steps) && item.steps.length > 0) {
      content += `PASSOS DE TESTE:\n`;
      item.steps.forEach((step: any, index: number) => {
        content += `${step.order || index + 1}. Ação: ${step.action}\n`;
        content += `   Resultado: ${step.expected_result}\n\n`;
      });
    }
    
    if (item.expected_result) {
      content += `RESULTADO FINAL ESPERADO:\n${item.expected_result}\n\n`;
    }
    
    if (item.priority) {
      content += `PRIORIDADE: ${priorityLabel((item as any).priority)}\n`;
    }
    
    if (item.type) {
      content += `TIPO: ${testCaseTypeLabel((item as any).type)}\n`;
    }
  }
  
  if (type === 'execution') {
    const execution = item as TestExecution;
    content += `STATUS: ${executionStatusLabel(execution.status as any)}\n`;
    if (execution.executed_by) content += `EXECUTOR: ${execution.executed_by}\n`;
    if (execution.executed_at) content += `DATA: ${new Date(execution.executed_at).toLocaleString('pt-BR')}\n`;
    if (execution.actual_result) content += `\nRESULTADO OBTIDO:\n${execution.actual_result}\n`;
    if (execution.notes) content += `\nNOTAS:\n${execution.notes}\n`;
  }
  
  return content;
};

const generateHTMLContent = (
  item: TestPlan | TestCase | TestExecution | Requirement | Defect,
  type: 'plan' | 'case' | 'execution' | 'requirement' | 'defect',
  title: string,
  description: string
): string => {
  let html = `<h1>${title}</h1>`;
  if (description) {
    html += `<h2>Descrição</h2>${toHTMLListOrParagraph(description)}`;
  }
  
  if (type === 'plan' && 'objective' in item) {
    if ((item as any).objective) html += `<h2>Objetivo</h2>${toHTMLListOrParagraph((item as any).objective || '')}`;
    if ((item as any).scope) html += `<h2>Escopo</h2>${toHTMLListOrParagraph((item as any).scope || '')}`;
    if ((item as any).approach) html += `<h2>Abordagem</h2>${toHTMLListOrParagraph((item as any).approach || '')}`;
    if ((item as any).criteria) html += `<h2>Critérios</h2>${toHTMLListOrParagraph((item as any).criteria || '')}`;
    if ((item as any).resources) html += `<h2>Recursos</h2>${toHTMLListOrParagraph((item as any).resources || '')}`;
    if ((item as any).schedule) html += `<h2>Cronograma</h2>${toHTMLListOrParagraph((item as any).schedule || '')}`;
    if ((item as any).risks) html += `<h2>Riscos</h2>${toHTMLListOrParagraph((item as any).risks || '')}`;
    if ((item as any).status) html += `<p><strong>Status:</strong> ${translateStatus((item as any).status)}</p>`;
  }
  
  if (type === 'case' && 'steps' in item) {
    if (item.preconditions) {
      html += `<h2>Pré-condições</h2>${toHTMLListOrParagraph(item.preconditions)}`;
    }
    
    if (Array.isArray(item.steps) && item.steps.length > 0) {
      html += `<h2>Passos de Teste</h2>`;
      html += `<table>`;
      html += `<tr><th>Passo</th><th>Ação</th><th>Resultado Esperado</th></tr>`;
      
      item.steps.forEach((step: any, index: number) => {
        html += `<tr>`;
        html += `<td>${step.order || index + 1}</td>`;
        html += `<td>${step.action || ''}</td>`;
        html += `<td>${step.expected_result || ''}</td>`;
        html += `</tr>`;
      });
      
      html += `</table>`;
    }
    
    if (item.expected_result) {
      html += `<h2>Resultado Final Esperado</h2>${toHTMLListOrParagraph(item.expected_result)}`;
    }
    
    if (item.priority) {
      html += `<p><strong>Prioridade:</strong> ${priorityLabel((item as any).priority)}</p>`;
    }
    
    if (item.type) {
      html += `<p><strong>Tipo:</strong> ${testCaseTypeLabel((item as any).type)}</p>`;
    }
  }
  
  if (type === 'execution') {
    const execution = item as TestExecution;
    html += `<p><strong>Status:</strong> ${executionStatusLabel(execution.status as any)}</p>`;
    if (execution.executed_by) html += `<p><strong>Executor:</strong> ${execution.executed_by}</p>`;
    if (execution.executed_at) html += `<p><strong>Data da Execução:</strong> ${new Date(execution.executed_at).toLocaleString('pt-BR')}</p>`;
    if (execution.actual_result) html += `<h2>Resultado Obtido</h2>${toHTMLListOrParagraph(execution.actual_result)}`;
    if (execution.notes) html += `<h2>Notas</h2>${toHTMLListOrParagraph(execution.notes)}`;
  }

  if (type === 'defect') {
    const defect = item as Defect;
    html += `<p><strong>Status:</strong> ${translateStatus(defect.status)}</p>`;
    html += `<p><strong>Severidade:</strong> ${priorityLabel(defect.severity as any)}</p>`;
    if (defect.description) html += `<h2>Descrição</h2>${toHTMLListOrParagraph(defect.description)}`;
  }
  
  return html;
};

const TYPE_PREFIX: Record<string, string> = {
  plan: 'PT',
  case: 'CT',
  execution: 'EXE',
  requirement: 'REQ',
  defect: 'DEF',
};

const getItemTitle = (item: TestPlan | TestCase | TestExecution | Requirement | Defect, type: 'plan' | 'case' | 'execution' | 'requirement' | 'defect'): string => {
  const prefix = TYPE_PREFIX[type] ?? type.toUpperCase();
  const seq = 'sequence' in item && (item as any).sequence
    ? String((item as any).sequence).padStart(3, '0')
    : item.id.slice(0, 6).toUpperCase();
  const id = `${prefix}-${seq}`;

  if (type === 'execution') return `${id} — Execução de Teste`;
  return `${id} — ${(item as TestPlan | TestCase | Requirement | Defect).title}`;
};

const getItemDescription = (item: TestPlan | TestCase | TestExecution | Requirement | Defect, type: 'plan' | 'case' | 'execution' | 'requirement' | 'defect'): string => {
  if (type === 'execution') {
    return (item as TestExecution).notes || '';
  }
  return (item as TestPlan | TestCase | Requirement | Defect).description || '';
};

const getFilename = (item: TestPlan | TestCase | TestExecution | Requirement | Defect, type: 'plan' | 'case' | 'execution' | 'requirement' | 'defect', format: ExportFormat): string => {
  const title = getItemTitle(item, type);
  const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
  const ext = format === 'word' ? 'doc' : format;
  return `${sanitizedTitle}.${ext}`;
};

const exportToPDF = async (content: string, filename: string) => {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${filename}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; font-size: 13px; color: #1a1a1a; line-height: 1.5; }
            h1 { color: #00c2a8; margin: 0 0 16px 0; font-size: 22px; border-bottom: 2px solid #00c2a8; padding-bottom: 8px; }
            h2 { color: #333; margin: 20px 0 10px 0; font-size: 15px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
            table { border-collapse: collapse; width: 100%; margin: 14px 0 20px 0; table-layout: auto; }
            th, td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; vertical-align: top; }
            th { background-color: #f9fafb; font-weight: 600; color: #374151; }
            tr:nth-child(even) { background-color: #f9fafb; }
            p { margin: 0 0 8px 0; }
            ul, ol { margin: 0 0 14px 20px; padding: 0; }
            li { margin: 4px 0; }
            strong { color: #111; }
          </style>
        </head>
        <body>
          <p style="font-size:11px;color:#777;margin:0 0 12px 0">Exportado via Nexus TCMS • ${new Date().toLocaleString('pt-BR')}</p>
          ${content}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    };
  }
};

const downloadWordFile = (content: string, filename: string) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>${filename}</title>
        <style>
          body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.4; color: #333; }
          h1 { color: #008080; font-size: 18pt; border-bottom: 2px solid #008080; padding-bottom: 4px; }
          h2 { color: #2E4053; font-size: 13pt; margin-top: 14pt; border-bottom: 1px solid #ddd; }
          p { margin: 6pt 0; }
          ul, ol { margin: 6pt 0 6pt 20pt; }
          table { border-collapse: collapse; width: 100%; margin: 10pt 0; }
          th, td { border: 1px solid #ccc; padding: 6pt 8pt; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
        </style>
      </head>
      <body>
        <p style="font-size:9pt;color:#888;">Nexus TCMS • Exportação de Item • ${new Date().toLocaleString('pt-BR')}</p>
        ${content}
      </body>
    </html>
  `;
  const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const downloadTextFile = (content: string, filename: string, mimeType = 'text/plain;charset=utf-8') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
