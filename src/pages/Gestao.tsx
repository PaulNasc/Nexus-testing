import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Requirements } from '@/pages/Requirements';
import { TraceabilityMatrix } from '@/pages/TraceabilityMatrix';
import { Defects } from '@/pages/Defects';
import { Coverage } from '@/pages/Coverage';
import { useSearchParams } from 'react-router-dom';
import { ViewModeToggle } from '@/components/ViewModeToggle';
import { StandardButton } from '@/components/StandardButton';
import { Plus, ShieldCheck, FileCode2, Network, Bug, Layers } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useProject } from '@/contexts/ProjectContext';

export const Gestao = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = usePermissions();
  const { currentProject } = useProject();
  const isProjectInactive = !!currentProject && currentProject.status !== 'active';
  const [tab, setTab] = useState<'requirements' | 'traceability' | 'defects' | 'coverage'>(() => {
    const t = (searchParams.get('tab') || 'requirements') as any;
    if (t === 'traceability' || t === 'defects' || t === 'requirements' || t === 'coverage') return t;
    return 'requirements';
  });
  const [tabView, setTabView] = useState<{requirements: 'cards'|'list'; traceability: 'cards'|'list'; defects: 'cards'|'list' }>({
    requirements: 'list',
    traceability: 'list',
    defects: 'list',
  });

  // Sincroniza a aba com a URL
  useEffect(() => {
    const t = searchParams.get('tab');
    if (!t) return; 
    if (t === 'requirements' || t === 'traceability' || t === 'defects' || t === 'coverage') {
      setTab(t);
    }
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    const next = (value as any) as 'requirements' | 'traceability' | 'defects' | 'coverage';
    setTab(next);
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params);
  };

  const handleCreate = () => {
    const params = new URLSearchParams(searchParams);
    if (tab === 'requirements') {
      params.set('openCreate', '1');
      setSearchParams(params);
      return;
    }
    if (tab === 'defects') {
      params.set('openCreate', '1');
      setSearchParams(params);
      return;
    }
    if (tab === 'traceability') {
      params.set('tab', 'requirements');
      params.set('openCreate', '1');
      setSearchParams(params);
      return;
    }
  };

  return (
    <div className="flex-1 space-y-6 p-6 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <ShieldCheck className="h-6 w-6 text-brand" />
            Gestão da Qualidade
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organize requisitos de software, matriz de rastreabilidade, cobertura e defeitos.
          </p>
        </div>
        {tab !== 'coverage' && (((tab === 'requirements' || tab === 'traceability') && hasPermission('can_manage_cases')) || (tab === 'defects' && hasPermission('can_manage_executions'))) ? (
          <StandardButton
            variant="brand"
            onClick={handleCreate}
            disabled={!currentProject || isProjectInactive}
            title={!currentProject ? 'Selecione um projeto ativo para criar' : (isProjectInactive ? 'Projeto não ativo — criação desabilitada' : undefined)}
          >
            <Plus className="h-4 w-4 mr-2" />
            {tab === 'requirements' || tab === 'traceability' ? 'Novo Requisito' : 'Novo Defeito'}
          </StandardButton>
        ) : null}
      </div>

      <div className="mt-2">
        <Tabs value={tab} onValueChange={handleTabChange}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
            <TabsList className="bg-muted/30 p-1 rounded-xl border border-border/60 h-auto flex flex-wrap gap-1">
              <TabsTrigger 
                value="requirements" 
                className="rounded-lg px-3.5 py-1.5 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-brand data-[state=active]:shadow-xs transition-all flex items-center gap-2"
              >
                <FileCode2 className="h-3.5 w-3.5" />
                Requisitos
              </TabsTrigger>
              <TabsTrigger 
                value="traceability" 
                className="rounded-lg px-3.5 py-1.5 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-brand data-[state=active]:shadow-xs transition-all flex items-center gap-2"
              >
                <Network className="h-3.5 w-3.5" />
                Matriz de Rastreabilidade
              </TabsTrigger>
              <TabsTrigger 
                value="defects" 
                className="rounded-lg px-3.5 py-1.5 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-brand data-[state=active]:shadow-xs transition-all flex items-center gap-2"
              >
                <Bug className="h-3.5 w-3.5" />
                Defeitos
              </TabsTrigger>
              <TabsTrigger 
                value="coverage" 
                className="rounded-lg px-3.5 py-1.5 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-brand data-[state=active]:shadow-xs transition-all flex items-center gap-2"
              >
                <Layers className="h-3.5 w-3.5" />
                Cobertura
              </TabsTrigger>
            </TabsList>

            {tab !== 'coverage' && (
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <ViewModeToggle
                  viewMode={tabView[tab as keyof typeof tabView] ?? 'list'}
                  onViewModeChange={(mode) => setTabView(v => ({ ...v, [tab]: mode }))}
                />
              </div>
            )}
          </div>

          <TabsContent value="requirements" className="mt-4">
            <Requirements 
              embedded 
              preferredViewMode={tabView.requirements}
              onPreferredViewModeChange={(mode) => setTabView(v => ({ ...v, requirements: mode }))}
            />
          </TabsContent>

          <TabsContent value="traceability" className="mt-4">
            <TraceabilityMatrix 
              embedded 
              preferredViewMode={tabView.traceability}
              onPreferredViewModeChange={(mode) => setTabView(v => ({ ...v, traceability: mode }))}
            />
          </TabsContent>

          <TabsContent value="defects" className="mt-4">
            <Defects 
              embedded 
              preferredViewMode={tabView.defects}
              onPreferredViewModeChange={(mode) => setTabView(v => ({ ...v, defects: mode }))}
            />
          </TabsContent>

          <TabsContent value="coverage" className="mt-4">
            <Coverage embedded />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Gestao;
