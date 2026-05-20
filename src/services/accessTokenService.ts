
// DEPRECATED: Este serviço foi descontinuado. As tabelas access_tokens/access_logs foram removidas do DB.
// Stub seguro mantido apenas para compatibilidade de importações.
// Não realiza chamadas ao banco e retorna valores neutros.
export type AccessToken = unknown;
export type AccessLog = unknown;
export type CreateAccessTokenData = unknown;
export type UpdateAccessTokenData = unknown;

export interface TokenValidationResult {
  success: boolean;
  organization_id?: string;
  error?: string;
  code?: string;
  expired_at?: string;
  uses_remaining?: number;
}

export interface AccessLogWithDetails {
  [key: string]: unknown;
}

export class AccessTokenService {
  // Criar novo token de acesso (stub)
  static async createAccessToken(
    organizationId: string,
    description?: string,
    durationSeconds: number = 40,
    maxUses: number = 1
  ): Promise<string | null> {
    console.warn('AccessTokenService.createAccessToken: serviço descontinuado.');
    return null;
  }

  // Validar e usar token (stub)
  static async validateAndUseToken(
    token: string,
    userEmail?: string,
    userIp?: string,
    userAgent?: string
  ): Promise<TokenValidationResult> {
    return { success: false, error: 'Sistema de tokens foi descontinuado', code: 'TOKENS_DEPRECATED' };
  }

  // Buscar tokens ativos (stub)
  static async getActiveTokens(organizationId: string): Promise<AccessToken[]> {
    return [];
  }

  // Registrar log de acesso (stub/no-op)
  private static async logAccess(
    organizationId: string | null,
    token: string,
    userEmail?: string,
    userIp?: string,
    userAgent?: string,
    action: string = 'token_used',
    status: string = 'success'
  ): Promise<void> {
    // no-op
  }

  // Buscar logs (stub)
  static async getAccessLogs(
    organizationId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<AccessLogWithDetails[]> {
    return [];
  }

  // Estatísticas de logs (stub)
  static async getLogStatistics(organizationId: string): Promise<{
    total_attempts: number;
    successful_access: number;
    failed_access: number;
    expired_tokens: number;
    invalid_tokens: number;
    recent_activity: AccessLogWithDetails[];
  }> {
    return {
      total_attempts: 0,
      successful_access: 0,
      failed_access: 0,
      expired_tokens: 0,
      invalid_tokens: 0,
      recent_activity: []
    };
  }

  // Desativar token (stub)
  static async deactivateToken(tokenId: string): Promise<boolean> {
    return true;
  }

  // Limpar tokens expirados (stub)
  static async cleanupExpiredTokens(): Promise<number> {
    return 0;
  }

  // Tentativas por email (stub)
  static async getAccessAttemptsByEmail(email: string): Promise<AccessLogWithDetails[]> {
    return [];
  }

  // Utilitários mantidos
  static isTokenExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date();
  }

  static getTokenTimeRemaining(expiresAt: string): number {
    const now = new Date();
    const expires = new Date(expiresAt);
    return Math.max(0, Math.floor((expires.getTime() - now.getTime()) / 1000));
  }

  static formatTimeRemaining(seconds: number): string {
    if (seconds <= 0) return 'Expirado';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  }

  static async generateTestToken(organizationId: string): Promise<string | null> {
    return null;
  }

  static async canManageTokens(organizationId: string, userId: string): Promise<boolean> {
    return false;
  }
}
