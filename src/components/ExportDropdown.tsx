import { useState } from 'react';
import { 
  Download, Copy, FileText, Table, 
  FileSpreadsheet, FileCode2, FileCheck2, Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TestPlan, TestCase, TestExecution, Requirement, Defect } from '@/types';
import { exportItem, copyToClipboard, ExportFormat } from '@/utils/exportUtils';
import { toast } from '@/components/ui/use-toast';

interface ExportDropdownProps {
  item: TestPlan | TestCase | TestExecution | Requirement | Defect;
  type: 'plan' | 'case' | 'execution' | 'requirement' | 'defect';
}

export const ExportDropdown = ({ item, type }: ExportDropdownProps) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true);
    try {
      await exportItem(item, type, format);
      toast({
        title: "Exportação concluída",
        description: `Item exportado com sucesso em formato ${format.toUpperCase()}!`
      });
    } catch (error: any) {
      toast({
        title: "Erro na exportação",
        description: error.message || "Não foi possível exportar o item.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopy = async (format: ExportFormat) => {
    try {
      await copyToClipboard(item, type, format);
      toast({
        title: "Copiado!",
        description: `Conteúdo copiado em formato ${format.toUpperCase()}!`
      });
    } catch (error: any) {
      toast({
        title: "Erro ao copiar",
        description: error.message || "Não foi possível copiar o conteúdo.",
        variant: "destructive"
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={isExporting}
          className="h-8.5 text-xs rounded-lg border-border/70 bg-card/60 hover:bg-muted/60 font-semibold gap-1.5 shadow-2xs"
        >
          {isExporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span>Exportar</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 text-xs rounded-xl border-border/70 shadow-lg p-1.5 space-y-0.5">
        <DropdownMenuItem onClick={() => handleExport('pdf')} className="flex items-center gap-2.5 cursor-pointer py-1.5 px-2.5 rounded-lg">
          <FileText className="h-4 w-4 text-rose-400 shrink-0" />
          <span className="font-medium text-foreground">Documento PDF (.pdf)</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => handleExport('word')} className="flex items-center gap-2.5 cursor-pointer py-1.5 px-2.5 rounded-lg">
          <FileSpreadsheet className="h-4 w-4 text-blue-400 shrink-0" />
          <span className="font-medium text-foreground">Documento Word (.doc)</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => handleExport('txt')} className="flex items-center gap-2.5 cursor-pointer py-1.5 px-2.5 rounded-lg">
          <Table className="h-4 w-4 text-cyan-400 shrink-0" />
          <span className="font-medium text-foreground">Texto Puro (.txt)</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => handleExport('md')} className="flex items-center gap-2.5 cursor-pointer py-1.5 px-2.5 rounded-lg">
          <FileCode2 className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="font-medium text-foreground">Markdown (.md)</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator className="my-1 border-border/40" />
        
        <DropdownMenuItem onClick={() => handleCopy('txt')} className="flex items-center gap-2.5 cursor-pointer py-1.5 px-2.5 rounded-lg">
          <Copy className="h-4 w-4 text-brand shrink-0" />
          <span className="font-medium text-foreground">Copiar em Texto</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => handleCopy('md')} className="flex items-center gap-2.5 cursor-pointer py-1.5 px-2.5 rounded-lg">
          <FileCheck2 className="h-4 w-4 text-indigo-400 shrink-0" />
          <span className="font-medium text-foreground">Copiar em Markdown</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
