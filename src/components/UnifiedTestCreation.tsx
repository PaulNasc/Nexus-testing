
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Sparkles, CheckCircle2, ChevronRight, ChevronLeft, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { saveUnifiedPlan } from '@/services/apiClientService';
import * as ModelControlService from '@/services/modelControlService';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface UnifiedTestCreationProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const UnifiedTestCreation = ({ onSuccess, onCancel }: UnifiedTestCreationProps) => {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [planData, setPlanData] = useState({
    title: '',
    description: '',
    objective: '',
    scope: '',
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
        appDescription: planData.description,
        additionalContext: planData.objective,
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
      toast({ title: 'IA Finalizada', description: `${newCases.length} casos sugeridos com sucesso.` });
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
        plan: { ...planData, project_id: currentProject.id, user_id: user.id },
        cases: cases.map(c => ({ ...c, project_id: currentProject.id, user_id: user.id }))
      });
      toast({ title: 'Sucesso!', description: 'Plano e casos criados em conjunto.' });
      onSuccess?.();
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-1">
      {/* Stepper Header */}
      <div className="flex items-center justify-between px-4 mb-8">
        {[1, 2, 3].map((num) => (
          <div key={num} className="flex items-center flex-1 last:flex-none">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors",
              step === num ? "border-brand bg-brand/10 text-brand" : 
              step > num ? "border-success bg-success/10 text-success" : "border-muted text-muted-foreground"
            )}>
              {step > num ? <CheckCircle2 className="w-5 h-5" /> : num}
            </div>
            <div className={cn("hidden sm:block ml-3 text-xs font-medium uppercase tracking-wider", step === num ? "text-foreground" : "text-muted-foreground")}>
              {num === 1 ? 'Definição' : num === 2 ? 'Casos de Teste' : 'Revisão'}
            </div>
            {num < 3 && <div className="flex-1 h-px bg-border mx-4" />}
          </div>
        ))}
      </div>

      {/* Step 1: Plan Info */}
      {step === 1 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Título do Plano</Label>
              <Input 
                placeholder="Ex: Testes de Regressão - Sprint 42" 
                value={planData.title}
                onChange={e => setPlanData({...planData, title: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição / Contexto</Label>
              <Textarea 
                placeholder="O que será testado? Quais as principais funcionalidades?"
                rows={4}
                value={planData.description}
                onChange={e => setPlanData({...planData, description: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Objetivo Principal</Label>
              <Input 
                placeholder="Ex: Garantir estabilidade do módulo de pagamentos"
                value={planData.objective}
                onChange={e => setPlanData({...planData, objective: e.target.value})}
              />
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={onCancel} className="mr-2">Cancelar</Button>
            <Button onClick={handleNext} disabled={!planData.title || !planData.description}>
              Próximo <ChevronRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Cases */}
      {step === 2 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase">Casos de Teste ({cases.length})</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={generateWithAI} disabled={isGenerating} className="border-brand/30 hover:bg-brand/5">
                {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2 text-brand" />}
                Sugerir com IA
              </Button>
              <Button variant="outline" size="sm" onClick={handleAddManualCase}>
                <Plus className="w-4 h-4 mr-2" /> Adicionar Manual
              </Button>
            </div>
          </div>

          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
            {cases.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed border-border rounded-xl opacity-50">
                <p className="text-sm">Nenhum caso adicionado ainda. Use a IA ou adicione manualmente.</p>
              </div>
            )}
            {cases.map((c, idx) => (
              <Card key={c.id} className="p-4 relative group hover:border-brand/40 transition-colors">
                <button 
                  onClick={() => handleRemoveCase(c.id)}
                  className="absolute top-2 right-2 p-1.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="grid gap-3">
                  <Input 
                    value={c.title} 
                    onChange={e => handleUpdateCase(c.id, { title: e.target.value })}
                    className="font-semibold border-none bg-transparent p-0 h-auto focus-visible:ring-0 text-base"
                  />
                  <Textarea 
                    value={c.description} 
                    onChange={e => handleUpdateCase(c.id, { description: e.target.value })}
                    placeholder="Descrição do cenário..."
                    className="text-xs min-h-[60px]"
                  />
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Resultado Esperado</Label>
                      <Input 
                        value={c.expected_result} 
                        onChange={e => handleUpdateCase(c.id, { expected_result: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="w-32 space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Prioridade</Label>
                      <select 
                        value={c.priority}
                        onChange={e => handleUpdateCase(c.id, { priority: e.target.value })}
                        className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none dark:bg-card dark:text-foreground"
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
            ))}
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handleBack}><ChevronLeft className="mr-2 w-4 h-4" /> Voltar</Button>
            <Button onClick={handleNext} disabled={cases.length === 0}>
              Revisar <ChevronRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Save */}
      {step === 3 && (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 text-center py-4">
          <div className="w-20 h-20 rounded-full bg-brand/10 flex items-center justify-center mx-auto mb-4">
            <Save className="w-10 h-10 text-brand" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Tudo pronto para salvar?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Você está criando o plano <span className="font-semibold text-foreground">"{planData.title}"</span> com <span className="font-semibold text-foreground">{cases.length} casos de teste</span> associados.
            </p>
          </div>
          
          <div className="max-w-md mx-auto bg-muted/30 rounded-xl p-4 text-left border border-border/50">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Resumo</span>
              <Badge variant="outline" className="bg-brand/5 border-brand/20 text-brand">Projeto: {currentProject?.name}</Badge>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between"><span>Plano de Teste</span> <span className="font-medium">Criando...</span></li>
              <li className="flex justify-between"><span>Casos de Teste</span> <span className="font-medium">{cases.length} itens</span></li>
              <li className="flex justify-between"><span>Vínculo Automático</span> <span className="font-medium">Sim</span></li>
            </ul>
          </div>

          <div className="flex justify-center gap-3 pt-6">
            <Button variant="outline" onClick={handleBack} disabled={loading}>Ajustar</Button>
            <Button onClick={handleSaveAll} disabled={loading} className="px-8 bg-brand hover:bg-brand/90">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Confirmar e Criar Tudo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
