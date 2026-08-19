import React from 'react';

type NexusLogoProps = {
  size?: number;
  className?: string;
  variant?: 'icon' | 'badge' | 'full';
  title?: string;
};

/**
 * Identidade Visual Proprietária do Nexus Testing (TCMS)
 * Representa nós de teste interconectados e convergência de qualidade no formato 'N'
 */
export const NexusIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = '',
}) => {
  const gradientId = React.useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${gradientId}-grad`} x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="50%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#991b1b" />
        </linearGradient>
        <linearGradient id={`${gradientId}-glow`} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f87171" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#b91c1c" stopOpacity="0.2" />
        </linearGradient>
      </defs>

      {/* Fundo sutil com borda arredondada */}
      <rect x="2" y="2" width="28" height="28" rx="7" fill={`url(#${gradientId}-grad)`} fillOpacity="0.14" stroke={`url(#${gradientId}-glow)`} strokeWidth="1.2" />

      {/* Linhas de conexão e fluxo de testes */}
      <path
        d="M9 23V9L23 23V9"
        stroke={`url(#${gradientId}-grad)`}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Nós interconectados (Nódulos de Testes / Verificação) */}
      <circle cx="9" cy="9" r="2.2" fill="#ffffff" stroke={`url(#${gradientId}-grad)`} strokeWidth="1.5" />
      <circle cx="23" cy="9" r="2.2" fill="#ffffff" stroke={`url(#${gradientId}-grad)`} strokeWidth="1.5" />
      <circle cx="9" cy="23" r="2.2" fill="#ffffff" stroke={`url(#${gradientId}-grad)`} strokeWidth="1.5" />
      <circle cx="23" cy="23" r="2.2" fill="#ffffff" stroke={`url(#${gradientId}-grad)`} strokeWidth="1.5" />

      {/* Ponto focal de convergência central */}
      <circle cx="16" cy="16" r="1.8" fill="#ffffff" />
    </svg>
  );
};

export const NexusLogo: React.FC<NexusLogoProps> = ({
  size = 28,
  className = '',
  variant = 'icon',
  title = 'Nexus Testing',
}) => {
  if (variant === 'icon') {
    return <NexusIcon size={size} className={className} />;
  }

  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center gap-2.5 ${className}`}>
        <div className="h-9 w-9 rounded-lg bg-brand/10 border border-brand/25 flex items-center justify-center shrink-0 shadow-xs">
          <NexusIcon size={20} />
        </div>
        <div className="flex flex-col text-left">
          <span className="text-sm font-bold text-foreground tracking-tight leading-tight">Nexus Testing</span>
          <span className="text-[10px] text-muted-foreground font-semibold tracking-wider uppercase leading-tight">TCMS Platform</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`} aria-label={title}>
      <NexusIcon size={size} />
      <div className="flex flex-col text-left">
        <span className="text-base font-bold text-foreground tracking-tight leading-tight">Nexus Testing</span>
        <span className="text-[11px] text-muted-foreground font-medium">Test Case Management</span>
      </div>
    </div>
  );
};

export default NexusLogo;
