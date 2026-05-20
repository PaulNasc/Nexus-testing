// Utilitários para exportação de dados

export interface ExportData {
  headers: string[];
  rows: (string | number | boolean | null)[][];
  title?: string;
}

// Exportar para CSV
export const exportToCSV = (data: ExportData, filename: string = 'export') => {
  const csvContent = [
    data.headers.join(','),
    ...data.rows.map(row => 
      row.map(cell => {
        // Escapar aspas duplas e envolver em aspas se necessário
        const stringCell = String(cell || '');
        if (stringCell.includes(',') || stringCell.includes('"') || stringCell.includes('\n')) {
          return `"${stringCell.replace(/"/g, '""')}"`;
        }
        return stringCell;
      }).join(',')
    )
  ].join('\n');

  downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
};

// Exportar para JSON
export const exportToJSON = (data: any, filename: string = 'export') => {
  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, `${filename}.json`, 'application/json;charset=utf-8;');
};

// Exportar para Excel (formato básico CSV que o Excel pode abrir)
export const exportToExcel = (data: ExportData, filename: string = 'export') => {
  // Gerar CSV UTF-8 com delimitador ';' (compatível com Excel em PT-BR)
  const delimiter = ';';
  const csvContent = [
    '\uFEFF' + data.headers.join(delimiter), // BOM para UTF-8 no Excel
    ...data.rows.map(row => 
      row.map((cell, index) => {
        let stringCell = String(cell ?? '');
        
        // Verificar se é uma data brasileira e formatar adequadamente para o Excel
        if (stringCell.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
          // Converter data brasileira (DD/MM/YYYY) para formato Excel (DD/MM/YYYY)
          // Manter o formato brasileiro mas garantir que o Excel interprete corretamente
          const [day, month, year] = stringCell.split('/');
          stringCell = `${day}/${month}/${year}`;
        }
        
        // Escapar aspas e envolver se contiver delimitadores ou quebras de linha
        if (stringCell.includes(delimiter) || stringCell.includes('"') || stringCell.includes('\n')) {
          return '"' + stringCell.replace(/"/g, '""') + '"';
        }
        return stringCell;
      }).join(delimiter)
    )
  ].join('\n');

  // Salvar como .csv para o Excel abrir corretamente
  downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
};

// Exportar para PDF básico (usando print)
export const exportToPDF = (title: string = 'Relatório') => {
  // Criar uma nova janela com conteúdo formatado para impressão
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Não foi possível abrir janela para impressão. Verifique se pop-ups estão bloqueados.');
  }

  // Obter o conteúdo atual da página
  const currentContent = document.querySelector('[data-export-content]')?.innerHTML || 
                         document.querySelector('main')?.innerHTML || 
                         'Conteúdo não encontrado';

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>
        @page { size: A4; margin: 14mm; }
        html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body {
          font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          margin: 0; font-size: 12px; color: #111; line-height: 1.5;
        }
        .container { max-width: 100%; }
        header { margin-bottom: 12px; }
        h1 { font-size: 18px; margin: 0 0 4px 0; color: #111; }
        .meta { color: #666; font-size: 11px; }
        hr { border: 0; border-top: 1px solid #eee; margin: 10px 0 14px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0 16px; table-layout: auto; }
        th, td { padding: 6px 8px; text-align: left; vertical-align: top; border-bottom: 1px solid #f0f0f0; }
        th { background: #fafafa; font-weight: 600; color: #222; }
        tr:nth-child(even) td { background: #fcfcfc; }
        .section { margin-bottom: 18px; }
        .muted { color: #888; }
        img { max-width: 100%; }
        .chart-container, .recharts-wrapper { display: none !important; }
        .no-print, nav, aside, .toolbar, .filters, .controls, .actions { display: none !important; }
        button, input, select, textarea { display: none !important; }
        a[href]:after { content: "" !important; }
        tr { page-break-inside: avoid; }
        @media print { html, body { height: auto; } }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <h1>${title}</h1>
          <div class="meta">Gerado em: ${new Date().toLocaleString('pt-BR')}</div>
        </header>
        <hr />
        ${currentContent}
      </div>
    </body>
    </html>
  `);

  printWindow.document.close();
  
  // Aguardar carregamento e imprimir
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };
};

// Função auxiliar para download de arquivo
const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Limpar URL após uso
  setTimeout(() => URL.revokeObjectURL(url), 100);
};

// Converter dados de tabela HTML para formato de exportação
export const tableToExportData = (tableElement: HTMLTableElement): ExportData => {
  const headers: string[] = [];
  const rows: (string | number | boolean | null)[][] = [];

  // Extrair cabeçalhos
  const headerRow = tableElement.querySelector('thead tr') || tableElement.querySelector('tr');
  if (headerRow) {
    headerRow.querySelectorAll('th, td').forEach(cell => {
      headers.push(cell.textContent?.trim() || '');
    });
  }

  // Extrair linhas de dados
  const bodyRows = tableElement.querySelectorAll('tbody tr') || 
                   (headerRow ? Array.from(tableElement.querySelectorAll('tr')).slice(1) : tableElement.querySelectorAll('tr'));
  
  bodyRows.forEach(row => {
    const rowData: (string | number | boolean | null)[] = [];
    row.querySelectorAll('td, th').forEach(cell => {
      const text = cell.textContent?.trim() || '';
      // Tentar converter números
      const num = parseFloat(text);
      if (!isNaN(num) && text === num.toString()) {
        rowData.push(num);
      } else {
        rowData.push(text);
      }
    });
    if (rowData.length > 0) {
      rows.push(rowData);
    }
  });

  return { headers, rows };
};

// Exportar dados do Supabase diretamente
export const exportSupabaseData = async (
  tableName: string, 
  data: any[], 
  format: 'csv' | 'json' | 'excel', 
  filename?: string
) => {
  if (!data || data.length === 0) {
    throw new Error('Nenhum dado para exportar');
  }

  const baseFilename = filename || `${tableName}_${new Date().toISOString().split('T')[0]}`;

  if (format === 'json') {
    exportToJSON(data, baseFilename);
    return;
  }

  // Para CSV e Excel, converter para formato tabular
  const headers = Object.keys(data[0]);
  const rows = data.map(item => headers.map(header => item[header]));

  const exportData: ExportData = {
    headers,
    rows,
    title: `Dados de ${tableName}`
  };

  if (format === 'csv') {
    exportToCSV(exportData, baseFilename);
  } else if (format === 'excel') {
    exportToExcel(exportData, baseFilename);
  }
};

// Exportar dados de tabela pré-formatados
export const exportTableData = async (
  data: Record<string, any>[], 
  format: 'csv' | 'json' | 'excel', 
  filename: string
) => {
  if (!data || data.length === 0) {
    throw new Error('Nenhum dado para exportar');
  }

  if (format === 'json') {
    exportToJSON(data, filename);
    return;
  }

  // Para CSV e Excel, converter para formato tabular
  const headers = Object.keys(data[0]);
  const rows = data.map(item => headers.map(header => item[header]));

  const exportData: ExportData = {
    headers,
    rows,
    title: 'Dados Exportados'
  };

  if (format === 'csv') {
    exportToCSV(exportData, filename);
  } else if (format === 'excel') {
    exportToExcel(exportData, filename);
  }
};

// Copiar conteúdo para clipboard
export const copyToClipboard = async (content: string, format: 'txt' | 'md' = 'txt') => {
  try {
    await navigator.clipboard.writeText(content);
    return true;
  } catch (error) {
    // Fallback para navegadores que não suportam clipboard API
    const textArea = document.createElement('textarea');
    textArea.value = content;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      document.body.removeChild(textArea);
      throw new Error('Não foi possível copiar o conteúdo. Clipboard API não disponível.');
    }
  }
};

// Converter dados para formato Markdown
export const dataToMarkdown = (data: ExportData, title?: string): string => {
  let markdown = '';
  
  if (title) {
    markdown += `# ${title}\n\n`;
    markdown += `*Gerado em: ${new Date().toLocaleString('pt-BR')}*\n\n`;
  }
  
  // Cabeçalhos da tabela
  markdown += `| ${data.headers.join(' | ')} |\n`;
  markdown += `| ${data.headers.map(() => '---').join(' | ')} |\n`;
  
  // Linhas de dados
  data.rows.forEach(row => {
    const formattedRow = row.map(cell => String(cell || '').replace(/\|/g, '\\|'));
    markdown += `| ${formattedRow.join(' | ')} |\n`;
  });
  
  return markdown;
};

// Converter dados para formato de texto simples
export const dataToText = (data: ExportData, title?: string): string => {
  let text = '';
  
  if (title) {
    text += `${title}\n`;
    text += '='.repeat(title.length) + '\n\n';
    text += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n\n`;
  }
  
  // Determinar largura das colunas
  const columnWidths = data.headers.map((header, index) => {
    const headerWidth = header.length;
    const maxDataWidth = Math.max(...data.rows.map(row => String(row[index] || '').length));
    return Math.max(headerWidth, maxDataWidth, 3);
  });
  
  // Cabeçalhos
  const headerLine = data.headers.map((header, index) => 
    header.padEnd(columnWidths[index])
  ).join(' | ');
  
  const separatorLine = columnWidths.map(width => '-'.repeat(width)).join('-|-');
  
  text += headerLine + '\n';
  text += separatorLine + '\n';
  
  // Dados
  data.rows.forEach(row => {
    const dataLine = row.map((cell, index) => 
      String(cell || '').padEnd(columnWidths[index])
    ).join(' | ');
    text += dataLine + '\n';
  });
  
  return text;
};

// Copiar dados da tabela
export const copyTableData = async (data: ExportData, format: 'txt' | 'md', title?: string) => {
  const content = format === 'md' 
    ? dataToMarkdown(data, title) 
    : dataToText(data, title);
    
  return await copyToClipboard(content, format);
};

// Copiar relatório formatado
export const copyReportData = async (
  reportType: string,
  reportData: any,
  format: 'txt' | 'md',
  additionalData?: any
) => {
  const reportTitle = `Relatório - ${reportType}`;
  
  try {
    let content = '';
    
    if (format === 'md') {
      content = `# ${reportTitle}\n\n`;
      content += `**Gerado em:** ${new Date().toLocaleString('pt-BR')}\n\n`;
      content += `## Dados\n\n`;
      content += '```json\n';
      content += JSON.stringify({
        tipo: reportType,
        dados: reportData,
        ...additionalData
      }, null, 2);
      content += '\n```\n';
    } else {
      content = `${reportTitle}\n`;
      content += '='.repeat(reportTitle.length) + '\n\n';
      content += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n\n`;
      content += 'DADOS:\n';
      content += JSON.stringify({
        tipo: reportType,
        dados: reportData,
        ...additionalData
      }, null, 2);
    }
    
    return await copyToClipboard(content, format);
  } catch (error) {
    console.error('Erro ao copiar relatório:', error);
    throw error;
  }
};

// Exportar relatórios formatados
export const exportReportData = (
  reportType: string,
  reportData: any,
  format: 'pdf' | 'csv' | 'excel' | 'json',
  additionalData?: any
) => {
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `relatorio_${reportType}_${timestamp}`;

  try {
    switch (format) {
      case 'pdf':
        exportToPDF(`Relatório - ${reportType}`);
        break;
      case 'json':
        exportToJSON({
          tipo: reportType,
          geradoEm: new Date().toISOString(),
          dados: reportData,
          ...additionalData
        }, filename);
        break;
      case 'csv':
      case 'excel':
        // Converter dados do relatório para formato tabular
        if (Array.isArray(reportData)) {
          exportSupabaseData(reportType, reportData, format, filename);
        } else {
          // Para dados não tabulares, converter para formato chave-valor
          const headers = ['Propriedade', 'Valor'];
          const rows = Object.entries(reportData).map(([key, value]) => [key, String(value)]);
          const exportData: ExportData = { headers, rows, title: `Relatório - ${reportType}` };
          
          if (format === 'csv') {
            exportToCSV(exportData, filename);
          } else {
            exportToExcel(exportData, filename);
          }
        }
        break;
      default:
        throw new Error(`Formato não suportado: ${format}`);
    }
  } catch (error) {
    console.error('Erro na exportação:', error);
    throw error;
  }
}; 
