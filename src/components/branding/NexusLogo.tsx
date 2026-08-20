import React from 'react';

type NexusLogoProps = {
  size?: number;
  className?: string;
  variant?: 'icon' | 'badge' | 'full';
  title?: string;
};

/**
 * Ícone Oficial Nexus Testing (SVG transparente vetorial)
 */
export const NexusIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = '',
}) => {
  return (
    <img
      src="/img/Print_Transparent.svg"
      alt="Nexus Testing"
      width={size}
      height={size}
      className={`object-contain select-none shrink-0 ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      loading="eager"
      onError={(e) => {
        // Fallback para /nexus-logo.svg se necessário
        (e.target as HTMLImageElement).src = '/nexus-logo.svg';
      }}
    />
  );
};

/**
 * Logotipo Completo Oficial Nexus Testing (PNG Transparente sem buffer)
 */
export const NexusFullLogo: React.FC<{ height?: number; className?: string }> = ({
  height = 32,
  className = '',
}) => {
  return (
    <img
      src="/img/FullLogo_Transparent_NoBuffer.png"
      alt="Nexus Testing"
      height={height}
      className={`object-contain select-none max-h-full ${className}`}
      style={{ height: `${height}px` }}
      loading="eager"
      onError={(e) => {
        (e.target as HTMLImageElement).src = '/img/Print_Transparent.svg';
      }}
    />
  );
};

/**
 * Componente Geral de Logo do Nexus Testing
 */
export const NexusLogo: React.FC<NexusLogoProps> = ({
  size = 28,
  className = '',
  variant = 'icon',
  title = 'Nexus Testing',
}) => {
  if (variant === 'full') {
    return <NexusFullLogo height={size} className={className} />;
  }

  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center gap-2.5 ${className}`}>
        <div className="h-9 w-9 rounded-lg bg-card/80 border border-border/70 p-1 flex items-center justify-center shrink-0 shadow-xs">
          <NexusIcon size={22} />
        </div>
        <div className="flex flex-col text-left">
          <span className="text-sm font-bold text-foreground tracking-tight leading-tight">Nexus Testing</span>
          <span className="text-[10px] text-muted-foreground font-semibold tracking-wider uppercase leading-tight">TCMS Platform</span>
        </div>
      </div>
    );
  }

  return <NexusIcon size={size} className={className} />;
};

export default NexusLogo;

