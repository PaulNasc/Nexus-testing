import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { updateProject, deleteProjectCascade, getProjectById } from '@/services/projectService';
import { Project } from '@/types';
import { Settings, Trash2, Pause, Play, AlertTriangle, Archive, XCircle, FolderKanban, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { StandardButton } from '@/components/StandardButton';

interface ProjectManagerProps {
  project: Project;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({ project, open, onOpenChange }) => {
  const { user } = useAuth();
  const { refreshProjects, setCurrentProject, currentProject, refreshArchivedProjects } = useProject();
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: project.name,
    color: project.color,
    status: project.status
  });
  const { isMaster, hasPermission } = usePermissions();

  const persistInline = async (updates: Partial<Project>) => {
    if (!user) return;
    try {
      setEditing(true);
      await updateProject(project.id, updates as any);
      const fresh = await getProjectById(project.id);
      if (fresh) {
        setFormData((s) => ({ ...s, name: fresh.name, color: fresh.color, status: fresh.status }));
        if (currentProject?.id === project.id) {
          setCurrentProject(fresh);
        }
      }
      await refreshProjects();
      toast({ title: 'Projeto atualizado', description: `Alterações salvas.` });
    } catch (error) {
      console.error('Erro ao atualizar projeto:', error);
      toast({ title: 'Erro', description: (error as any)?.message || 'Falha ao salvar alterações.', variant: 'destructive' });
    } finally {
      setEditing(false);
    }
  };

  const handleCancelProject = async () => {
    if (!hasPermission('can_manage_projects')) {
      toast({ title: 'Sem permissão', description: 'Você não pode cancelar projetos.', variant: 'destructive' });
      return;
    }
    try {
      await updateProject(project.id, { status: 'canceled' });
      const fresh = await getProjectById(project.id);
      setFormData((s) => ({ ...s, status: 'canceled' }));
      if (fresh && currentProject?.id === project.id) setCurrentProject(fresh);
      await refreshProjects();
      try { await refreshArchivedProjects(); } catch { /* ignore */ }
      toast({ title: 'Projeto cancelado', description: `O projeto "${project.name}" foi marcado como cancelado.` });
    } catch (error) {
      console.error('Erro ao cancelar projeto:', error);
      toast({ title: 'Erro', description: (error as any)?.message || 'Não foi possível cancelar o projeto.', variant: 'destructive' });
    }
  };

  const handleDeleteProject = async () => {
    try {
      setDeleting(true);
      await deleteProjectCascade(project.id);
      await refreshProjects();
      try { await refreshArchivedProjects(); } catch { /* ignore */ }
      setCurrentProject(null);

      toast({
        title: 'Projeto excluído',
        description: `O projeto "${project.name}" foi excluído com sucesso.`
      });
    } catch (error) {
      console.error('Erro ao excluir projeto:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o projeto. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setDeleting(false);
    }
  };

  const handlePauseProject = async () => {
    if (!hasPermission('can_manage_projects')) {
      toast({ title: 'Sem permissão', description: 'Você não pode pausar projetos.', variant: 'destructive' });
      return;
    }
    try {
      await updateProject(project.id, { status: 'paused' });
      const fresh = await getProjectById(project.id);
      setFormData((s) => ({ ...s, status: 'paused' }));
      if (fresh && currentProject?.id === project.id) setCurrentProject(fresh);
      await refreshProjects();
      toast({ title: 'Projeto pausado', description: `O projeto "${project.name}" está em modo somente leitura.` });
    } catch (error) {
      console.error('Erro ao pausar projeto:', error);
      toast({ title: 'Erro', description: (error as any)?.message || 'Não foi possível pausar o projeto.', variant: 'destructive' });
    }
  };

  const handleResumeProject = async () => {
    if (!hasPermission('can_manage_projects')) {
      toast({ title: 'Sem permissão', description: 'Você não pode retomar projetos.', variant: 'destructive' });
      return;
    }
    try {
      await updateProject(project.id, { status: 'active' });
      const fresh = await getProjectById(project.id);
      setFormData((s) => ({ ...s, status: 'active' }));
      if (fresh && currentProject?.id === project.id) setCurrentProject(fresh);
      await refreshProjects();
      try { await refreshArchivedProjects(); } catch { /* ignore */ }
      toast({ title: 'Projeto retomado', description: `O projeto "${project.name}" voltou ao modo ativo.` });
    } catch (error) {
      console.error('Erro ao retomar projeto:', error);
      toast({ title: 'Erro', description: (error as any)?.message || 'Não foi possível retomar o projeto.', variant: 'destructive' });
    }
  };

  const handleArchiveProject = async () => {
    if (!hasPermission('can_manage_projects')) {
      toast({ title: 'Sem permissão', description: 'Você não pode arquivar projetos.', variant: 'destructive' });
      return;
    }
    try {
      await updateProject(project.id, { status: 'archived' });
      const fresh = await getProjectById(project.id);
      setFormData((s) => ({ ...s, status: 'archived' }));
      if (fresh && currentProject?.id === project.id) setCurrentProject(fresh);
      await refreshProjects();
      try { await refreshArchivedProjects(); } catch { /* ignore */ }
      toast({ title: 'Projeto arquivado', description: `O projeto "${project.name}" foi arquivado.` });
    } catch (error) {
      console.error('Erro ao arquivar projeto:', error);
      toast({ title: 'Erro', description: (error as any)?.message || 'Não foi possível arquivar o projeto.', variant: 'destructive' });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs font-semibold py-0.5">Ativo</Badge>;
      case 'paused':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs font-semibold py-0.5">Pausado</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs font-semibold py-0.5">Concluído</Badge>;
      case 'archived':
        return <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-xs font-semibold py-0.5">Arquivado</Badge>;
      case 'canceled':
        return <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 text-xs font-semibold py-0.5">Cancelado</Badge>;
      default:
        return <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-xs font-semibold py-0.5">{status}</Badge>;
    }
  };

  const controlled = typeof open === 'boolean' && typeof onOpenChange === 'function';

  return (
    <>
      <Dialog open={controlled ? open : showEditForm} onOpenChange={controlled ? onOpenChange! : setShowEditForm}>
        {!controlled && (
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        )}
        <DialogContent className="sm:max-w-[500px] rounded-xl border border-border/80 bg-card shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <span className="inline-block w-4 h-4 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: formData.color || '#00c2a8' }} />
              Gerenciar Projeto
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Edite as configurações, altere o status ou gerencie o ciclo de vida do projeto.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="project-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nome do Projeto</Label>
              <Input
                id="project-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                onBlur={() => formData.name !== project.name ? persistInline({ name: formData.name.trim() }) : undefined}
                className="bg-muted/20 border-border/70 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="project-color" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cor de Identificação</Label>
              <div className="flex items-center gap-3 p-2 bg-muted/20 border border-border/60 rounded-lg">
                <input
                  id="project-color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  onBlur={() => formData.color !== project.color ? persistInline({ color: formData.color }) : undefined}
                  className="w-10 h-8 rounded border cursor-pointer bg-transparent"
                />
                <span className="text-xs font-mono font-bold text-foreground">{formData.color}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status Atual</Label>
              <div className="flex items-center gap-2 mt-1">
                {getStatusBadge(formData.status)}
              </div>
            </div>

            <div className="pt-3 border-t border-border/40 space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ações do Ciclo de Vida</Label>
              <div className="grid grid-cols-2 gap-2">
                {formData.status === 'active' ? (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowPauseDialog(true)} 
                    className="h-9 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
                  >
                    <Pause className="h-3.5 w-3.5 mr-1.5" /> Pausar Projeto
                  </Button>
                ) : formData.status === 'archived' ? (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleResumeProject} 
                    className="h-9 text-xs border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                  >
                    <Play className="h-3.5 w-3.5 mr-1.5" /> Reativar Projeto
                  </Button>
                ) : (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleResumeProject} 
                    className="h-9 text-xs border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                  >
                    <Play className="h-3.5 w-3.5 mr-1.5" /> Retomar Projeto
                  </Button>
                )}

                {formData.status !== 'archived' && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowArchiveDialog(true)} 
                    className="h-9 text-xs border-border/70 text-muted-foreground hover:bg-muted/30"
                  >
                    <Archive className="h-3.5 w-3.5 mr-1.5" /> Arquivar
                  </Button>
                )}

                {formData.status !== 'canceled' && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowCancelDialog(true)} 
                    className="h-9 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1.5" /> Cancelar
                  </Button>
                )}

                {(isMaster() || hasPermission('can_delete_projects')) && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowDeleteDialog(true)} 
                    className="h-9 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir Projeto
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação de Exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="rounded-xl border border-border/80 bg-card shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Excluir Projeto Permanentemente
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground space-y-2">
              <p>Esta ação é irreversível. Todos os dados vinculados ao projeto serão removidos em cascata (Planos, Casos, Execuções, Defeitos e Vínculos).</p>
              <p>Para confirmar, digite exatamente o nome do projeto abaixo: <strong className="text-foreground">{project.name}</strong></p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-2">
            <Input 
              placeholder={project.name} 
              value={confirmText} 
              onChange={(e) => setConfirmText(e.target.value)} 
              className="bg-muted/20 border-border/70 text-xs font-semibold"
            />
          </div>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              disabled={deleting || confirmText !== project.name || !isMaster()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Excluindo...' : 'Confirmar Exclusão'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de Pausa */}
      <AlertDialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
        <AlertDialogContent className="rounded-xl border border-border/80 bg-card shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Pausar projeto?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Ao pausar, o projeto entra em modo somente leitura. A criação de novos Planos, Casos e Execuções ficará desabilitada até a retomada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handlePauseProject}>
              Confirmar Pausa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de Arquivamento */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent className="rounded-xl border border-border/80 bg-card shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar projeto?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              O projeto será movido para a aba de arquivados. Todos os dados permanecem salvos e podem ser reativados a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-muted text-foreground hover:bg-muted/80" onClick={handleArchiveProject}>
              Confirmar Arquivamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de Cancelamento */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent className="rounded-xl border border-border/80 bg-card shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar projeto?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              O projeto será marcado como cancelado. Seus registros continuarão preservados para auditoria histórica.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleCancelProject}>
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ProjectManager;
