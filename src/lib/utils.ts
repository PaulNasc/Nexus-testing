import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formata data para exibição no timezone local (Brasil UTC-3).
 * Converte strings ISO (UTC) do backend para hora local correta.
 */
export function formatLocalDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo'
  }).format(d);
}

/**
 * Formata data e hora para exibição no timezone local (Brasil UTC-3).
 */
export function formatLocalDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo'
  }).format(d);
}

/**
 * Normaliza e consolida todas as menções de slides de um texto em uma única tag [Slide X, Y, Z]
 * no final do texto, removendo referências textuais avulsas ou redundantes do corpo.
 */
export function normalizeAndConsolidateSlides(text: string): string {
  if (!text) return '';
  
  const slides = new Set<number>();
  
  // 1. Extrair intervalos como "slides 15-18" ou "slides 15 a 18" ou "slides 15, 16, 17 e 18"
  const rangeRegex = /\bslides?\s+(\d+)\s*(?:[-\u2013\u2014]|\s+(?:a|e)\s+)\s*(\d+)\b/gi;
  let match;
  while ((match = rangeRegex.exec(text)) !== null) {
    const start = parseInt(match[1], 10);
    const end = parseInt(match[2], 10);
    if (!isNaN(start) && !isNaN(end) && start <= end && end - start < 50) {
      for (let i = start; i <= end; i++) {
        slides.add(i);
      }
    }
  }
  
  // 2. Extrair menções a tags existentes do tipo [Slide 15, 16] ou [Slide 15-18]
  const tagRegex = /\[\s*slides?\s*([\d,\s\-\u2013\u2014eao&]+)\]/gi;
  while ((match = tagRegex.exec(text)) !== null) {
    const content = match[1];
    // Checa se há range dentro da tag
    const rangeMatch = content.match(/(\d+)\s*(?:[-\u2013\u2014]|\s+(?:a|e)\s+)\s*(\d+)/i);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (!isNaN(start) && !isNaN(end) && start <= end && end - start < 50) {
        for (let i = start; i <= end; i++) {
          slides.add(i);
        }
      }
    }
    const parts = content.split(/[\s,;&e\-\u2013\u2014a-zÀ-ú]+/i).filter(Boolean);
    parts.forEach(p => {
      const num = parseInt(p, 10);
      if (!isNaN(num)) slides.add(num);
    });
  }
  
  // 3. Extrair menções avulsas como "slide 15" ou "slides 15, 16"
  const singleRegex = /\bslides?\s*([\d,\s&e]+)\b/gi;
  while ((match = singleRegex.exec(text)) !== null) {
    const parts = match[1].split(/[\s,;&e]+/i).filter(Boolean);
    parts.forEach(p => {
      const num = parseInt(p, 10);
      if (!isNaN(num)) slides.add(num);
    });
  }

  // 4. Limpar do texto todas as citações textuais de slide
  let cleanedText = text
    // Remove tags [Slide ...]
    .replace(/\[\s*slides?\s*[\d,\s\-\u2013\u2014eao&]+\]/gi, '')
    // Remove expressões de citação comuns
    .replace(/(?:conforme|ver|segundo|conforme\s+os?|de\s+acordo\s+com\s+os?|nos?)\s+slides?\s*[\d,\s\-\u2013\u2014eao&]+/gi, '')
    // Remove qualquer ocorrência avulsa de "slide X" ou "slides X, Y"
    .replace(/\bslides?\s*[\d,\s\-\u2013\u2014eao&]+\b/gi, '')
    // Limpar espaços duplicados e pontuações soltas
    .replace(/\s+/g, ' ')
    .replace(/\s+\./g, '.')
    .replace(/\s+,/g, ',')
    .trim();

  // 5. Se houver slides mapeados, adicionar a tag consolidada unificada
  if (slides.size > 0) {
    const sortedSlides = Array.from(slides).sort((a, b) => a - b);
    const slideTag = `[Slide ${sortedSlides.join(', ')}]`;
    
    cleanedText = cleanedText ? `${cleanedText} ${slideTag}` : slideTag;
  }

  return cleanedText;
}
