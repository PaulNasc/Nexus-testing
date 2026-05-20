
import { useState } from 'react';
import { Download, Copy, FileText, FileImage, File } from 'lucide-react';
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
        title: "Sucesso",
        description: `Item exportado como ${format.toUpperCase()}!`
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao exportar item",
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
        title: "Sucesso",
        description: `Conteúdo copiado como ${format.toUpperCase()}!`
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao copiar conteúdo",
        variant: "destructive"
      });
    }
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'pdf': return <FileImage className="h-4 w-4" />;
      case 'word': return <File className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isExporting}>
          <Download className="h-4 w-4 mr-1" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1 text-sm font-medium text-gray-700 dark:text-gray-300">
          Exportar como:
        </div>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          {getFormatIcon('pdf')}
          <span className="ml-2">PDF</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => handleExport('word')}>
          {getFormatIcon('word')}
          <span className="ml-2">Word</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => handleExport('txt')}>
          {getFormatIcon('txt')}
          <span className="ml-2">TXT</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => handleExport('md')}>
          {getFormatIcon('md')}
          <span className="ml-2">Markdown (.md)</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <div className="px-2 py-1 text-sm font-medium text-gray-700 dark:text-gray-300">
          Copiar como:
        </div>
        
        <DropdownMenuItem onClick={() => handleCopy('txt')}>
          <Copy className="h-4 w-4" />
          <span className="ml-2">Texto</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => handleCopy('md')}>
          <Copy className="h-4 w-4" />
          <span className="ml-2">Markdown</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
