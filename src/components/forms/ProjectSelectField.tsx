import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useProject } from '@/contexts/ProjectContext';

interface ProjectSelectFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  includeAllOption?: boolean;
  allLabel?: string;
}

export const ProjectSelectField: React.FC<ProjectSelectFieldProps> = ({
  value,
  onValueChange,
  placeholder = "Selecione um projeto",
  includeAllOption = false,
  allLabel = "Todos os projetos",
}) => {
  const { projects } = useProject();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-50 text-green-700 border-green-200';
      case 'completed': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'archived': return 'bg-gray-50 text-gray-700 border-gray-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'completed': return 'Concluído';
      case 'archived': return 'Arquivado';
      default: return status;
    }
  };

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="focus:border-brand/50 focus:ring-brand/20">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {includeAllOption && (
          <SelectItem value="all">
            <div className="flex items-center gap-2">
              <span className="truncate">{allLabel}</span>
              <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Todos</Badge>
            </div>
          </SelectItem>
        )}
        {projects.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground text-center">
            Nenhum projeto disponível
          </div>
        ) : (
          projects
            .filter(project => project.status === 'active')
            .map((project) => (
              <SelectItem key={project.id} value={project.id}>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="truncate">{project.name}</span>
                  <Badge variant="outline" className={getStatusColor(project.status)}>
                    {getStatusLabel(project.status)}
                  </Badge>
                </div>
              </SelectItem>
            ))
        )}
      </SelectContent>
    </Select>
  );
}
;
