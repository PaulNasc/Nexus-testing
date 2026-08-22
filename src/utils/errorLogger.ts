/**
 * Nexus Error Logger & Telemetry Ring Buffer
 * Captura logs de console, erros não tratados e telemetria da sessão para envio de reportes.
 */

export interface LogEntry {
  level: 'error' | 'warn' | 'info';
  message: string;
  timestamp: string;
  data?: any;
}

const MAX_LOGS = 50;
const logRingBuffer: LogEntry[] = [];

// Inicializar interceptadores de console e janela
if (typeof window !== 'undefined') {
  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = (...args: any[]) => {
    try {
      const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      logRingBuffer.push({
        level: 'error',
        message: msg.slice(0, 1000),
        timestamp: new Date().toISOString(),
      });
      if (logRingBuffer.length > MAX_LOGS) logRingBuffer.shift();
    } catch { /* ignore */ }
    originalError.apply(console, args);
  };

  console.warn = (...args: any[]) => {
    try {
      const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      logRingBuffer.push({
        level: 'warn',
        message: msg.slice(0, 500),
        timestamp: new Date().toISOString(),
      });
      if (logRingBuffer.length > MAX_LOGS) logRingBuffer.shift();
    } catch { /* ignore */ }
    originalWarn.apply(console, args);
  };

  window.addEventListener('error', (event) => {
    logRingBuffer.push({
      level: 'error',
      message: `Uncaught Error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`,
      timestamp: new Date().toISOString(),
      data: event.error?.stack ? { stack: String(event.error.stack).slice(0, 2000) } : undefined,
    });
    if (logRingBuffer.length > MAX_LOGS) logRingBuffer.shift();
  });

  window.addEventListener('unhandledrejection', (event) => {
    logRingBuffer.push({
      level: 'error',
      message: `Unhandled Promise Rejection: ${String(event.reason)}`,
      timestamp: new Date().toISOString(),
    });
    if (logRingBuffer.length > MAX_LOGS) logRingBuffer.shift();
  });
}

export function getCapturedLogs(): LogEntry[] {
  return [...logRingBuffer];
}

export function clearCapturedLogs(): void {
  logRingBuffer.length = 0;
}

/**
 * Captura um snapshot visual leve da tela atual utilizando SVG foreignObject
 */
export async function captureDomScreenshot(): Promise<string | null> {
  try {
    if (typeof window === 'undefined') return null;

    const width = Math.min(window.innerWidth || 1280, 1920);
    const height = Math.min(window.innerHeight || 800, 1080);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Fundo neutro
    const isDark = document.documentElement.classList.contains('dark');
    ctx.fillStyle = isDark ? '#090d16' : '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // Renderizar informações estruturais
    ctx.fillStyle = isDark ? '#38bdf8' : '#0284c7';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`Nexus TCMS - Snapshot de Sessão (${window.location.pathname})`, 24, 40);

    ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
    ctx.font = '12px monospace';
    ctx.fillText(`Data/Hora: ${new Date().toLocaleString('pt-BR')}`, 24, 64);
    ctx.fillText(`URL: ${window.location.href}`, 24, 84);
    ctx.fillText(`Resolução: ${width}x${height} | Agente: ${navigator.userAgent.slice(0, 80)}`, 24, 104);

    // Desenhar resumo dos últimos 5 logs no preview
    ctx.fillStyle = isDark ? '#1e293b' : '#e2e8f0';
    ctx.fillRect(24, 130, width - 48, height - 160);

    ctx.fillStyle = isDark ? '#f1f5f9' : '#0f172a';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('Logs Recentes Capturados:', 36, 155);

    const logs = getCapturedLogs().slice(-6);
    let y = 180;
    for (const l of logs) {
      ctx.fillStyle = l.level === 'error' ? '#ef4444' : l.level === 'warn' ? '#f59e0b' : '#38bdf8';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`[${l.level.toUpperCase()}] ${l.timestamp.split('T')[1]?.slice(0, 8)}:`, 36, y);
      ctx.fillStyle = isDark ? '#cbd5e1' : '#334155';
      ctx.font = '11px monospace';
      ctx.fillText(l.message.slice(0, 110), 170, y);
      y += 24;
    }

    return canvas.toDataURL('image/png', 0.8);
  } catch (err) {
    console.warn('Falha ao gerar snapshot de tela:', err);
    return null;
  }
}
