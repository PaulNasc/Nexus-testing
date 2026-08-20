import { LayoutGrid, LayoutList } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ViewModeToggleProps {
  viewMode: 'cards' | 'list';
  onViewModeChange: (mode: 'cards' | 'list') => void;
}

export const ViewModeToggle = ({ viewMode, onViewModeChange }: ViewModeToggleProps) => {
  return (
    <TooltipProvider>
      <div className="inline-flex p-0.5 rounded-lg bg-card/60 border border-border/70 shadow-2xs">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onViewModeChange('list')}
              className={cn(
                'h-7.5 px-2.5 flex items-center justify-center rounded-md text-xs font-medium transition-all gap-1.5',
                viewMode === 'list'
                  ? 'bg-muted/80 text-foreground shadow-2xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              )}
            >
              <LayoutList className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Lista</span>
            </button>
          </TooltipTrigger>
          <TooltipContent><p>Visualização em Tabela</p></TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onViewModeChange('cards')}
              className={cn(
                'h-7.5 px-2.5 flex items-center justify-center rounded-md text-xs font-medium transition-all gap-1.5',
                viewMode === 'cards'
                  ? 'bg-muted/80 text-foreground shadow-2xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Cards</span>
            </button>
          </TooltipTrigger>
          <TooltipContent><p>Visualização em Cards</p></TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};
