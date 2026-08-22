import React, { useEffect, useMemo, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useProject } from '@/contexts/ProjectContext';
import { Project } from '@/types';
import { ProjectManager } from '@/experimental/ProjectManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, FolderKanban, Search, Layers, PlayCircle, PauseCircle, Archive, XCircle, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createProject, generateSlug, checkSlugExists } from '@/services/projectService';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StandardButton } from '@/components/StandardButton';

export const ProjectAdmin: React.FC = () => {
  const { role, isMaster } = usePermissions();
  const { user } = useAuth();
  const { projects, archivedProjects, refreshProjects, refreshArchivedProjects } = useProject();
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [search, setSearch] = useState('');

  const canAccess = isMaster() || role === 'admin';
  const [selected, setSelected] = useState<Project | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', color: '#00c2a8' });

  useEffect(() => {
    if (tab === 'archived') {
      refreshArchivedProjects().catch(() => {});
    }
  }, [tab, refreshArchivedProjects]);

  const stats = useMemo(() => {
    const all = [...projects, ...archivedProjects];
    const active = projects.filter(p => p.status === 'active').length;
    const paused = projects.filter(p => p.status === 'paused').length;
    const completed = projects.filter(p => p.status === 'completed').length;
    const archived = archivedProjects.length;

    return { total: all.length, active, paused, completed, archived };
  }, [projects, archivedProjects]);

  const orderedActive = useMemo(() => {
    let list = [...projects].sort((a, b) => a.name.localeCompare(b.name));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.slug && p.slug.toLowerCase().includes(q)) || (p.description && p.description.toLowerCase().includes(q)));
    }
    return list;
  }, [projects, search]);

  const orderedArchived = useMemo(() => {
    let list = [...archivedProjects].sort((a, b) => a.name.localeCompare(b.name));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.slug && p.slug.toLowerCase().includes(q)) || (p.description && p.description.toLowerCase().includes(q)));
    }
    return list;
  }, [archivedProjects, search]);

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

  const createNew = async () => {
    if (!user || !form.name.trim()) return;
    try {
      setCreating(true);
      let slug = generateSlug(form.name);
      let counter = 1;
      while (await checkSlugExists(slug)) {
        slug = `${generateSlug(form.name)}-${counter++}`;
      }
      const proj = await createProject({
        name: form.name.trim(),
        slug,
        description: form.description.trim() || undefined,
        color: form.color,
        created_by: user.id,
      });
      await refreshProjects();
      toast({ title: 'Projeto criado', description: `"${proj.name}" criado com sucesso.` });
      setShowCreate(false);
      setForm({ name: '', description: '', color: '#00c2a8' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro', description: 'Não foi possível criar o projeto.', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  if (!canAccess) {
    return (
      <div className="flex-1 space-y-6 p-6">
        <h1 className="text-2xl font-bold text-foreground">Acesso restrito</h1>
        <p className="text-muted-foreground text-sm">Apenas Master e Administradores podem gerenciar projetos.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <FolderKanban className="h-6 w-6 text-brand" />
            Administração de Projetos
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie o ciclo de vida, configurações, status e permissões dos projetos.
          </p>
        </div>

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <StandardButton variant="brand">
              <Plus className="h-4 w-4 mr-2" /> Novo Projeto
            </StandardButton>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px] rounded-xl border border-border/80 bg-card shadow-2xl p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <FolderKanban className="h-5 w-5 text-brand" />
                Criar Novo Projeto
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Informe o nome, descrição e cor de identificação do novo projeto.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="pname" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nome do Projeto *</Label>
                <Input 
                  id="pname" 
                  value={form.name} 
                  onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                  placeholder="Ex: Nexus Core Platform" 
                  className="bg-muted/20 border-border/70 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pdesc" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Descrição</Label>
                <Textarea 
                  id="pdesc" 
                  rows={3} 
                  value={form.description} 
                  onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} 
                  placeholder="Objetivos do projeto, escopo de testes e contexto..."
                  className="bg-muted/20 border-border/70 text-xs resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pcolor" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cor de Identificação</Label>
                <div className="flex items-center gap-3 p-2 bg-muted/20 border border-border/60 rounded-lg">
                  <input 
                    id="pcolor" 
                    type="color" 
                    className="w-10 h-8 rounded border cursor-pointer bg-transparent" 
                    value={form.color} 
                    onChange={(e) => setForm((s) => ({ ...s, color: e.target.value }))} 
                  />
                  <span className="text-xs font-mono font-bold text-foreground">{form.color}</span>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 pt-2 border-t border-border/40">
              <StandardButton variant="outline" onClick={() => setShowCreate(false)} disabled={creating}>
                Cancelar
              </StandardButton>
              <StandardButton variant="brand" onClick={createNew} disabled={creating || !form.name.trim()}>
                {creating ? 'Criando...' : 'Criar Projeto'}
              </StandardButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Total de Projetos</span>
            <Layers className="h-4 w-4 text-brand/70" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">{stats.total}</div>
        </div>

        <div className="p-3.5 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Ativos</span>
            <PlayCircle className="h-4 w-4 text-emerald-500/70" />
          </div>
          <div className="text-2xl font-bold text-emerald-500 mt-1">{stats.active}</div>
        </div>

        <div className="p-3.5 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Pausados</span>
            <PauseCircle className="h-4 w-4 text-amber-500/70" />
          </div>
          <div className="text-2xl font-bold text-amber-500 mt-1">{stats.paused}</div>
        </div>

        <div className="p-3.5 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Concluídos</span>
            <span className="h-2 w-2 rounded-full bg-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-500 mt-1">{stats.completed}</div>
        </div>

        <div className="p-3.5 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Arquivados</span>
            <Archive className="h-4 w-4 text-muted-foreground/70" />
          </div>
          <div className="text-2xl font-bold text-muted-foreground mt-1">{stats.archived}</div>
        </div>
      </div>

      {/* Tabs & Search Toolbar */}
      <Tabs value={tab} onValueChange={(v: 'active' | 'archived') => setTab(v)} className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <TabsList className="bg-muted/30 p-1 rounded-xl border border-border/60 h-auto flex gap-1">
            <TabsTrigger 
              value="active" 
              className="rounded-lg px-3.5 py-1.5 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-brand data-[state=active]:shadow-xs transition-all flex items-center gap-2"
            >
              <PlayCircle className="h-3.5 w-3.5" />
              Projetos Ativos ({projects.length})
            </TabsTrigger>
            <TabsTrigger 
              value="archived" 
              className="rounded-lg px-3.5 py-1.5 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-brand data-[state=active]:shadow-xs transition-all flex items-center gap-2"
            >
              <Archive className="h-3.5 w-3.5" />
              Arquivados / Cancelados ({archivedProjects.length})
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar projetos..."
              className="pl-8 h-8 text-xs bg-muted/20 border-border/60"
            />
          </div>
        </div>

        <TabsContent value="active" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orderedActive.map((p) => (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                aria-label={`Gerenciar projeto ${p.name}`}
                onClick={() => setSelected(p)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(p); } }}
                className="rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm p-4 cursor-pointer card-hover flex flex-col justify-between transition-all hover:border-brand/40 shadow-xs group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-block w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: p.color || '#00c2a8' }} />
                      <h3 className="text-sm font-bold text-foreground truncate group-hover:text-brand transition-colors">
                        {p.name}
                      </h3>
                    </div>
                    {getStatusBadge(p.status)}
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px] mb-3">
                    {p.description || 'Sem descrição informada.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono text-[11px] bg-muted/40 px-2 py-0.5 rounded border border-border/60">
                    slug: {p.slug}
                  </span>
                  <span className="flex items-center gap-1 text-brand font-medium text-xs group-hover:translate-x-0.5 transition-transform">
                    Gerenciar <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            ))}
            {orderedActive.length === 0 && (
              <div className="col-span-full border border-border/60 rounded-xl p-12 text-center text-muted-foreground bg-card/30">
                Nenhum projeto ativo encontrado.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="archived" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orderedArchived.map((p) => (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                aria-label={`Gerenciar projeto ${p.name}`}
                onClick={() => setSelected(p)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(p); } }}
                className="rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm p-4 cursor-pointer card-hover flex flex-col justify-between transition-all hover:border-brand/40 shadow-xs group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-block w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs opacity-60" style={{ backgroundColor: p.color || '#00c2a8' }} />
                      <h3 className="text-sm font-bold text-foreground truncate group-hover:text-brand transition-colors">
                        {p.name}
                      </h3>
                    </div>
                    {getStatusBadge(p.status)}
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px] mb-3">
                    {p.description || 'Sem descrição informada.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono text-[11px] bg-muted/40 px-2 py-0.5 rounded border border-border/60">
                    slug: {p.slug}
                  </span>
                  <span className="flex items-center gap-1 text-brand font-medium text-xs group-hover:translate-x-0.5 transition-transform">
                    Gerenciar <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            ))}
            {orderedArchived.length === 0 && (
              <div className="col-span-full border border-border/60 rounded-xl p-12 text-center text-muted-foreground bg-card/30">
                Nenhum projeto arquivado ou cancelado encontrado.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal Gerenciador por Projeto */}
      {selected && (
        <ProjectManager 
          project={selected} 
          open={Boolean(selected)} 
          onOpenChange={(open) => (!open ? setSelected(null) : null)} 
        />
      )}
    </div>
  );
};

export default ProjectAdmin;
