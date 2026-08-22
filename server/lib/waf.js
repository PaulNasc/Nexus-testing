/**
 * Nexus Web Application Firewall (WAF) & Bot Mitigation Engine
 * Proteção em camadas: SQLi, XSS, Path Traversal, Prototype Pollution, Malicious Bots & Rate Limiting.
 */

import { logger } from './logger.js';

// Heurísticas de scanners e bots maliciosos
const SUSPICIOUS_USER_AGENTS = [
  /sqlmap/i,
  /nikto/i,
  /masscan/i,
  /acunetix/i,
  /nmap/i,
  /havij/i,
  /wpscan/i,
  /dirbuster/i,
  /gobuster/i,
  /zgrab/i,
  /censys/i,
  /shodan/i,
];

// Padrões de Injeção de SQL
const SQL_INJECTION_PATTERNS = [
  /(\b(UNION(\s+ALL)?|SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b\s+.*\b(FROM|INTO|TABLE|DATABASE|WHERE)\b)/i,
  /(\bOR\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+)/i,
  /(\bAND\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+)/i,
  /(;\s*DROP\s+TABLE)/i,
  /(BENCHMARK\s*\(|SLEEP\s*\(|WAITFOR\s+DELAY)/i,
  /(\bINFORMATION_SCHEMA\b)/i,
];

// Padrões de Cross-Site Scripting (XSS)
const XSS_PATTERNS = [
  /<script\b[^>]*>([\s\S]*?)<\/script>/i,
  /javascript:[^"']*/i,
  /\bon\w+\s*=\s*["'][^"']*["']/i,
  /<iframe\b[^>]*>/i,
  /<object\b[^>]*>/i,
  /<embed\b[^>]*>/i,
  /eval\s*\(/i,
];

// Padrões de Path Traversal & Remote File Inclusion
const PATH_TRAVERSAL_PATTERNS = [
  /(\.\.\/|\.\.\\)/,
  /(\/etc\/passwd|\/etc\/shadow|\/proc\/self)/i,
  /(c:\\windows|c:\\winnt)/i,
];

// Padrões de Prototype Pollution
const PROTOTYPE_POLLUTION_PATTERNS = [
  /__proto__/,
  /prototype\./,
  /constructor\s*\[\s*['"]prototype['"]\s*\]/,
];

function containsPattern(value, patterns) {
  if (typeof value === 'string') {
    for (const pattern of patterns) {
      if (pattern.test(value)) return true;
    }
  } else if (typeof value === 'object' && value !== null) {
    for (const key of Object.keys(value)) {
      if (containsPattern(key, patterns)) return true;
      if (containsPattern(value[key], patterns)) return true;
    }
  }
  return false;
}

/**
 * Middleware principal de WAF & Defesa Anti-Bot
 */
export function wafMiddleware(req, res, next) {
  const userAgent = req.headers['user-agent'] || '';
  const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';

  // 1. Bot Fight Mode / Block Suspicious Scanners
  for (const botRegex of SUSPICIOUS_USER_AGENTS) {
    if (botRegex.test(userAgent)) {
      logger.warn(`[WAF] Bloqueio de scanner/bot malicioso: ${userAgent} | IP: ${clientIp}`);
      return res.status(403).json({
        error: {
          code: 'WAF_BOT_BLOCKED',
          message: 'Acesso bloqueado por diretiva de segurança contra bots maliciosos.',
        },
      });
    }
  }

  // 2. Análise de Prototype Pollution em query, body e params
  if (
    containsPattern(req.query, PROTOTYPE_POLLUTION_PATTERNS) ||
    containsPattern(req.body, PROTOTYPE_POLLUTION_PATTERNS) ||
    containsPattern(req.params, PROTOTYPE_POLLUTION_PATTERNS)
  ) {
    logger.warn(`[WAF] Tentativa de Prototype Pollution detectada de IP: ${clientIp}`);
    return res.status(400).json({
      error: {
        code: 'WAF_POLLUTION_BLOCKED',
        message: 'Payload inválido rejeitado pelo firewall de aplicação.',
      },
    });
  }

  // 3. Análise de Path Traversal
  if (
    containsPattern(req.url, PATH_TRAVERSAL_PATTERNS) ||
    containsPattern(req.query, PATH_TRAVERSAL_PATTERNS)
  ) {
    logger.warn(`[WAF] Tentativa de Path Traversal detectada de IP: ${clientIp} | URL: ${req.url}`);
    return res.status(400).json({
      error: {
        code: 'WAF_PATH_TRAVERSAL_BLOCKED',
        message: 'Caminho de arquivo inválido detectado pelo WAF.',
      },
    });
  }

  // 4. Análise de Injeção de SQL em query strings e rotas não-JSON
  if (containsPattern(req.query, SQL_INJECTION_PATTERNS)) {
    logger.warn(`[WAF] Tentativa de SQL Injection em Query Params detectada de IP: ${clientIp}`);
    return res.status(400).json({
      error: {
        code: 'WAF_SQLI_BLOCKED',
        message: 'Parâmetro de consulta malicioso rejeitado pelo WAF.',
      },
    });
  }

  // 5. Análise de XSS agressivo na URL / Query
  if (containsPattern(req.query, XSS_PATTERNS)) {
    logger.warn(`[WAF] Tentativa de XSS em Query Params detectada de IP: ${clientIp}`);
    return res.status(400).json({
      error: {
        code: 'WAF_XSS_BLOCKED',
        message: 'Conteúdo malicioso rejeitado pelo WAF.',
      },
    });
  }

  next();
}

/**
 * Limitador de taxa em memória configurável por rota
 */
export function createRateLimiter({ limit = 60, windowMs = 60 * 1000, name = 'default' }) {
  const store = new Map();

  return function rateLimiter(req, res, next) {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    const key = `${name}:${ip}`;
    const entry = store.get(key);

    if (!entry || entry.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      logger.warn(`[RateLimit:${name}] Limite de taxa excedido por IP ${ip}. Bloqueado por ${retryAfter}s.`);
      return res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Muitas requisições para este serviço. Tente novamente em ${retryAfter}s.`,
        },
      });
    }

    next();
  };
}
