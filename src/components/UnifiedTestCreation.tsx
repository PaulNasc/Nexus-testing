import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { 
  Sparkles, CheckCircle2, ChevronRight, ChevronLeft, 
  Plus, Trash2, Save, Loader2, FileText, Layers, 
  Target, ShieldAlert, Clock, Laptop, Compass, Check
} from 'lucide-react';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { saveUnifiedPlan } from '@/services/apiClientService';
import * as ModelControlService from '@/services/modelControlService';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useProjectUsers } from '@/hooks/useProjectUsers';

interface UnifiedTestCreationProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const UnifiedTestCreation = ({ onSuccess, onCancel }: UnifiedTestCreationProps) => {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const { users } = useProjectUsers();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Dados completos do Plano de Teste (campos essenciais + ricos não-obrigatórios)
  const [planData, setPlanData] = useState({
    title: '',
    description: '',
    objective: '',
    scope: '',
    approach: '',
    criteria: '',
    resources: '',
    schedule: '',
    risks: '',
    status: 'draft',
    assigned_to: user?.id || '',
  });

  const [cases, setCases] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);

  const handleAddManualCase = () => {
    setCases([...cases, { 
      id: crypto.randomUUID(),
      title: 'Novo Caso de Teste', 
      description: '', 
      priority: 'medium', 
      type: 'functional',
      steps: [],
      expected_result: ''
    }]);
  };

  const handleRemoveCase = (id: string) => {
    setCases(cases.filter(c => c.id !== id));
  };

  const handleUpdateCase = (id: string, updates: any) => {
    setCases(cases.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const generateWithAI = async () => {
    if (!currentProject?.id) return;
    setIsGenerating(true);
    try {
      const result = await ModelControlService.executeTask('test-case-generation', {
        appDescription: planData.description || planData.title,
        additionalContext: planData.objective || planData.scope,
        numCases: 5
      });
      
      const payload = (typeof result === 'object' && result !== null) ? (result as any) : {};
      const source = Array.isArray(payload) ? payload : (Array.isArray(payload?.cases) ? payload.cases : [payload]);
      
      const newCases = source.map((s: any) => ({
        id: crypto.randomUUID(),
        title: s.title || 'Caso Sugerido',
        description: s.description || '',
        priority: s.priority || 'medium',
        type: s.type || 'functional',
        steps: s.steps || [],
        expected_result: s.expected_result || '',
        generated_by_ai: true
      }));

      setCases([...cases, ...newCases]);
      toast({ title: 'IA Finalizada', description: `${newCases.length} casos de teste adicionados.` });
    } catch (error) {
      console.error('AI Error:', error);
      toast({ title: 'Erro na IA', description: 'Não foi possível gerar casos automaticamente.', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveAll = async () => {
    if (!currentProject?.id || !user?.id) return;
    setLoading(true);
    try {
      await saveUnifiedPlan({
        plan: {
          ...planData,
          project_id: currentProject.id,
          user_id: user.id
        },
        cases: cases.map(c => ({
          ...c,
          project_id: currentProject.id,
          user_id: user.id
        }))
      });

      toast({
        title: 'Plano Criado com Sucesso',
        description: cases.length > 0
          ? `Plano e ${cases.length} caso(s) de teste vinculados.`
          : 'Plano de teste criado com sucesso (pronto para receber casos).'
      });
      onSuccess?.();
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message || 'Falha ao criar plano.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-1">
      {/* ── Stepper Header ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/40">
        {[
          { num: 1, label: '1. Definição do Plano' },
          { num: 2, label: '2. Casos de Teste (Opcional)' },
          { num: 3, label: '3. Revisão & Conclusão' },
        ].map((item, idx) => (
          <div key={item.num} className="flex items-center flex-1 last:flex-none">
            <div className={cn(
              "w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold border transition-colors",
              step === item.num ? "border-brand bg-brand/10 text-brand" : 
              step > item.num ? "border-emerald-500 bg-emerald-500/10 text-emerald-500" : "border-border text-muted-foreground"
            )}>
              {step > item.num ? <Check className="w-4 h-4" /> : item.num}
            </div>
            <div className={cn(
              "hidden sm:block ml-2.5 text-xs font-semibold uppercase tracking-wider",
              step === item.num ? "text-foreground" : "text-muted-foreground/70"
            )}>
              {item.label}
            </div>
            {idx < 2 && <div className="flex-1 h-px bg-border/50 mx-3" />}
          </div>
        ))}
      </div>

      {/* ── ETAPA 1: Definição Completa do Plano ── */}
      {step === 1 && (
        <div className="space-y-4 animate-page-enter">
          <div className="space-y-4">
            {/* Título Principal */}
            <div className="space-y-1.5 text-left">
              <div className="flex items-center justify-between">
                <Label htmlFor="plan-title" className="text-xs font-semibold text-foreground">
                  Título do Plano de Teste <span className="text-brand">*</span>
                </Label>
                <span className="text-[10px] text-muted-foreground">Obrigatório</span>
              </div>
              <Input 
                id="plan-title"
                placeholder="Ex: Testes de Regressão e Homologação — Sprint 42" 
                value={planData.title}
                onChange={e => setPlanData({ ...planData, title: e.target.value })}
                className="h-10 text-xs bg-background/60 border-border/70 rounded-md font-medium"
                autoFocus
              />
            </div>

            {/* Descrição / Contexto */}
            <div className="space-y-1.5 text-left">
              <Label htmlFor="plan-desc" className="text-xs font-semibold text-foreground">
                Descrição & Contexto Geral
              </Label>
              <Textarea 
                id="plan-desc"
                placeholder="Descreva o propósito deste plano, as funcionalidades cobertas e o cenário de testes..."
                rows={3}
                value={planData.description}
                onChange={e => setPlanData({ ...planData, description: e.target.value })}
                className="text-xs bg-background/60 border-border/70 rounded-md"
              />
            </div>

            {/* Grid 2 Colunas: Objetivo & Escopo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              <div className="space-y-1.5">
                <Label htmlFor="plan-obj" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-muted-foreground" /> Objetivo Principal
                </Label>
                <Input 
                  id="plan-obj"
                  placeholder="Ex: Validar fluxo crítico de pagamentos e checkout"
                  value={planData.objective}
                  onChange={e => setPlanData({ ...planData, objective: e.target.value })}
                  className="h-9 text-xs bg-background/60 border-border/70 rounded-md"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="plan-scope" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" /> Escopo / Módulos Afetados
                </Label>
                <Input 
                  id="plan-scope"
                  placeholder="Ex: Módulos de Autenticação, Gateway PIX e Notificações"
                  value={planData.scope}
                  onChange={e => setPlanData({ ...planData, scope: e.target.value })}
                  className="h-9 text-xs bg-background/60 border-border/70 rounded-md"
                />
              </div>
            </div>

            {/* Seção Expansível: Informações Técnicas & Governança (Não Obrigatórias) */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-brand hover:underline font-semibold flex items-center gap-1.5 py-1"
              >
                <Compass className="h-3.5 w-3.5" />
                {showAdvanced ? 'Ocultar detalhes de governança e cronograma' : '+ Adicionar critérios, ambientes, riscos e cronograma (Opcional)'}
              </button>

              {showAdvanced && (
                <div className="mt-3 p-4 rounded-xl border border-border/60 bg-card/60 space-y-4 animate-page-enter text-left">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Laptop className="h-3.5 w-3.5 text-muted-foreground" /> Ambientes & Recursos
                      </Label>
                      <Input 
                        placeholder="Ex: Homologação, Staging QA, Web Chrome/Safari"
                        value={planData.resources}
                        onChange={e => setPlanData({ ...planData, resources: e.target.value })}
                        className="h-8.5 text-xs bg-background/60 border-border/70 rounded-md"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Cronograma / Sprint Alvo
                      </Label>
                      <Input 
                        placeholder="Ex: Sprint 42 • Release v1.4.0"
                        value={planData.schedule}
                        onChange={e => setPlanData({ ...planData, schedule: e.target.value })}
                        className="h-8.5 text-xs bg-background/60 border-border/70 rounded-md"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" /> Critérios de Aceite & Conclusão
                      </Label>
                      <Textarea 
                        placeholder="Ex: 100% dos testes críticos aprovados sem bloqueadores abertos."
                        rows={2}
                        value={planData.criteria}
                        onChange={e => setPlanData({ ...planData, criteria: e.target.value })}
                        className="text-xs bg-background/60 border-border/70 rounded-md"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" /> Riscos & Contingências
                      </Label>
                      <Textarea 
                        placeholder="Ex: Instabilidade na API de pagamentos de terceiros..."
                        rows={2}
                        value={planData.risks}
                        onChange={e => setPlanData({ ...planData, risks: e.target.value })}
                        className="text-xs bg-background/60 border-border/70 rounded-md"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">Status Inicial</Label>
                      <select
                        value={planData.status}
                        onChange={e => setPlanData({ ...planData, status: e.target.value })}
                        className="w-full h-8.5 text-xs rounded-md border border-border/70 bg-background/60 px-2.5"
                      >
                        <option value="draft">Rascunho</option>
                        <option value="active">Ativo (Em Execução)</option>
                        <option value="archived">Arquivado</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">Responsável / Atribuído</Label>
                      <select
                        value={planData.assigned_to}
                        onChange={e => setPlanData({ ...planData, assigned_to: e.target.value })}
                        className="w-full h-8.5 text-xs rounded-md border border-border/70 bg-background/60 px-2.5"
                      >
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/40">
            <Button variant="outline" size="sm" onClick={onCancel} className="text-xs h-9 px-4 rounded-md">
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleNext}
              disabled={!planData.title.trim()}
              className="text-xs h-9 px-5 rounded-md bg-brand hover:bg-brand/90 text-white font-semibold flex items-center gap-1.5"
            >
              <span>Avançar para Casos de Teste</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── ETAPA 2: Casos de Teste (100% Opcional) ── */}
      {step === 2 && (
        <div className="space-y-4 animate-page-enter">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/40">
            <div>
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                Casos de Teste Vinculados ({cases.length})
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Adicione casos agora ou avance direto para criar o plano e adicionar casos depois.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={generateWithAI}
                disabled={isGenerating}
                className="text-xs h-8 rounded-md border-brand/40 bg-brand/5 hover:bg-brand/10 text-brand font-medium"
              >
                {isGenerating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                Sugerir com IA
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddManualCase}
                className="text-xs h-8 rounded-md bg-background/60 border-border/70 hover:bg-muted/60"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar Manual
              </Button>
            </div>
          </div>

          <div className="space-y-3 max-h-[50vh] overflow-y-auto scrollbar-auto-hide pr-1">
            {cases.length === 0 ? (
              <div className="text-center py-10 px-6 border-2 border-dashed border-border/70 rounded-xl bg-card/40 space-y-2">
                <FileText className="h-8 w-8 text-muted-foreground/50 mx-auto" />
                <p className="text-xs font-semibold text-foreground">Nenhum caso de teste adicionado neste momento</p>
                <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
                  Você pode gerar casos com IA, inserir casos manuais acima ou clicar em <strong>"Avançar para Revisão"</strong> para criar o plano de teste vazio e associar casos posteriormente.
                </p>
              </div>
            ) : (
              cases.map((c, idx) => (
                <Card key={c.id} className="p-4 relative group rounded-xl border border-border/70 bg-card/70 hover:border-brand/50 transition-colors text-left space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase px-2 py-0.5 rounded bg-muted/60">
                      Caso #{idx + 1} {c.generated_by_ai && '• Sugerido por IA'}
                    </span>
                    <button 
                      onClick={() => handleRemoveCase(c.id)}
                      className="p-1 rounded text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Remover caso"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <Input 
                      value={c.title} 
                      onChange={e => handleUpdateCase(c.id, { title: e.target.value })}
                      placeholder="Título do caso de teste..."
                      className="h-8 text-xs font-semibold bg-background/60 border-border/70 rounded-md"
                    />
                    <Textarea 
                      value={c.description} 
                      onChange={e => handleUpdateCase(c.id, { description: e.target.value })}
                      placeholder="Passo a passo ou descrição do teste..."
                      rows={2}
                      className="text-xs bg-background/60 border-border/70 rounded-md"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Resultado Esperado</Label>
                        <Input 
                          value={c.expected_result} 
                          onChange={e => handleUpdateCase(c.id, { expected_result: e.target.value })}
                          placeholder="Ex: Mensagem de sucesso e redirecionamento..."
                          className="h-7.5 text-xs bg-background/60 border-border/70 rounded-md"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Prioridade</Label>
                        <select 
                          value={c.priority}
                          onChange={e => handleUpdateCase(c.id, { priority: e.target.value })}
                          className="w-full h-7.5 rounded-md border border-border/70 bg-background/60 px-2 text-xs"
                        >
                          <option value="low">Baixa</option>
                          <option value="medium">Média</option>
                          <option value="high">Alta</option>
                          <option value="critical">Crítica</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border/40">
            <Button variant="outline" size="sm" onClick={handleBack} className="text-xs h-9 px-4 rounded-md">
              <ChevronLeft className="mr-1.5 w-4 h-4" /> Voltar
            </Button>

            <Button
              size="sm"
              onClick={handleNext}
              className="text-xs h-9 px-5 rounded-md bg-brand hover:bg-brand/90 text-white font-semibold flex items-center gap-1.5"
            >
              <span>{cases.length > 0 ? `Revisar com ${cases.length} caso(s)` : 'Avançar para Revisão (Sem Casos)'}</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── ETAPA 3: Revisão & Confirmação ── */}
      {step === 3 && (
        <div className="space-y-5 animate-page-enter py-2">
          <div className="text-center space-y-1">
            <h3 className="text-lg font-bold text-foreground">Revisão do Plano de Teste</h3>
            <p className="text-xs text-muted-foreground">
              Confira os dados antes de confirmar a gravação no projeto <strong>{currentProject?.name}</strong>
            </p>
          </div>

          {/* Card Resumo */}
          <div className="rounded-xl border border-border/70 bg-card/70 p-5 text-left space-y-4 shadow-2xs">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-border/40">
              <div className="space-y-0.5 min-w-0">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Título do Plano</span>
                <h4 className="text-sm font-bold text-foreground truncate">{planData.title}</h4>
              </div>
              <Badge variant="outline" className="bg-brand/10 border-brand/20 text-brand shrink-0">
                {planData.status === 'active' ? 'Ativo' : 'Rascunho'}
              </Badge>
            </div>

            {planData.description && (
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Descrição</span>
                <p className="text-xs text-foreground/90 leading-relaxed">{planData.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-border/40 text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground block font-semibold">Casos de Teste:</span>
                <span className="font-bold text-foreground">
                  {cases.length > 0 ? `${cases.length} caso(s) associado(s)` : '0 casos (adicionar depois)'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block font-semibold">Objetivo:</span>
                <span className="font-medium text-foreground truncate block">{planData.objective || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block font-semibold">Sprint / Cronograma:</span>
                <span className="font-medium text-foreground truncate block">{planData.schedule || '—'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-4">
            <Button variant="outline" size="sm" onClick={handleBack} disabled={loading} className="text-xs h-9 px-4 rounded-md">
              <ChevronLeft className="mr-1.5 w-4 h-4" /> Ajustar Dados
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAll}
              disabled={loading}
              className="text-xs h-9 px-7 rounded-md bg-brand hover:bg-brand/90 text-white font-semibold flex items-center gap-2 shadow-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Criando Plano...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{cases.length > 0 ? 'Salvar Plano e Casos' : 'Confirmar e Criar Plano'}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
