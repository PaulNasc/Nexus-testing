import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';
import { ReactNode, forwardRef, ButtonHTMLAttributes } from 'react';

interface StandardButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  variant?: 'default' | 'brand' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  /** Quando true, renderiza o botão apenas com ícone, ocultando o label visual. */
  iconOnly?: boolean;
  /** Rótulo acessível para leitores de tela e tooltips externos. */
  ariaLabel?: string;
  /** Quando true, reduz a altura mínima para um botão mais compacto (lista). */
  compact?: boolean;
}

export const StandardButton = forwardRef<HTMLButtonElement, StandardButtonProps>(({ 
  children, 
  onClick, 
  variant = 'default', 
  size = 'default',
  icon: Icon,
  disabled = false,
  loading = false,
  type = 'button',
  className = '',
  iconOnly = false,
  ariaLabel,
  compact = false,
  ...rest
}, ref) => {
  const resolvedSize = iconOnly ? 'icon' : size;
  const showLabel = !iconOnly;
  const computedAriaLabel = ariaLabel || (typeof children === 'string' ? children : undefined);
  const baseAnim = 'transition-all duration-200 ease-out hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.99]';
  const brandClasses = variant === 'brand'
    ? 'bg-gradient-to-r from-[hsl(var(--brand))] to-[hsl(var(--brand-hover))] hover:from-[hsl(var(--brand-hover))] hover:to-[hsl(var(--brand))] text-[hsl(var(--brand-foreground))] border-0 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]'
    : '';
  const iconSizing = iconOnly ? 'h-8 w-8 p-0' : '';

  return (
    <Button
      ref={ref}
      onClick={onClick}
      variant={variant}
      size={resolvedSize}
      disabled={disabled || loading}
      type={type}
      aria-label={computedAriaLabel}
      className={`font-medium ${baseAnim} ${brandClasses} ${iconSizing} ${className}`}
      {...rest}
    >
      {loading ? (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
      ) : Icon ? (
        <Icon className={`h-4 w-4 ${showLabel && children ? 'mr-2' : ''}`} />
      ) : null}
      {showLabel ? children : null}
    </Button>
  );
});

StandardButton.displayName = 'StandardButton';
