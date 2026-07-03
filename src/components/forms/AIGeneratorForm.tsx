import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { Sparkles, Loader2, Zap, FileText, FlaskConical, Play, Upload, AlertCircle, Bot } from 'lucide-react';
import { getTestPlans, getTestCases, createTestPlan, createTestCase, createTestExecution, createRequirement, linkCaseToRequirement, notifyStakeholders } from '@/services/apiClientService';
import { listTestRunsByProject } from '@/services/testRunsService';
import { TestPlan, TestCase, AIModelTask, AIModel, TestRun } from '@/types';
import { useProjectUsers } from '@/hooks/useProjectUsers';
import { apiClient as supabase } from '@/lib/api';
import { getCachedKeySync } from '@/services/apiKeysService';
import * as ModelControlService from '@/services/modelControlService';
import { cn } from '@/lib/utils';
import { useAISettings } from '@/hooks/useAISettings';
import { useProject } from '@/contexts/ProjectContext';
import { UserMultiSelectField } from '@/components/forms/UserMultiSelectField';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Image as ImageIcon, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';

interface AIGeneratorFormProps {
  onSuccess?: (data: any) => void;
  initialType?: 'plan' | 'case' | 'execution';
  hideTypeSelector?: boolean;
}

export const AIGeneratorForm = ({ onSuccess, initialType = 'plan', hideTypeSelector = false }: AIGeneratorFormProps) => {
  const { user } = useAuth();
  const { settings } = useAISettings();
  const { currentProject } = useProject();
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [plans, setPlans] = useState<TestPlan[]>([]);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
  const { users, labelFor } = useProjectUsers();
  const [formData, setFormData] = useState({
    type: initialType,
    description: '',
    context: '',
    requirements: '',
    planId: '',
    caseId: '',
    runId: '',
    // Auto-assign creator as responsible
    assignedTo: user?.id || '',
    selectedModel: 'auto',
    interestedUsers: [] as string[],
    planStatus: 'draft'
  });
  const [file, setFile] = useState<File | null>(null);
  const [images, setImages] = useState<{ name: string; dataUrl: string }[]>([]);
  const [isEvo, setIsEvo] = useState(true);
  const [isHybex, setIsHybex] = useState(false);

  const cleanTitle = (t: string): string => {
    if (!t) return '';
    return t
      // Remove slide references like [Slide 21], [Slides 4, 5], [slide 12], [Slide 4, Slide 5], etc.
      .replace(/\[\s*slide[s]?\s*\d+.*?\]/gi, '')
      // Remove slide references like Slide 21:, Slide 21 -, slide 12, etc. (when not in brackets) at the start
      .replace(/^slide[s]?\s*\d+.*?\b[-–—:]?\s*/i, '')
      // Remove prefix words like Plano de Teste, Caso de Teste, etc.
      .replace(/^(Plano de Teste[s]?|Caso[s]? de Teste[s]?|Execução|Execuções|Caso|Plano|Test Plan[s]?|Test Case[s]?|Test Execution[s]?)\s*[-–—:]\s*/i, '')
      .replace(/^(Plano de Teste[s]?|Caso[s]? de Teste[s]?|Execução|Execuções|Caso|Plano|Test Plan[s]?|Test Case[s]?|Test Execution[s]?)\s+/i, '')
      // Remove quotes from start and end
      .replace(/^["'“”‘’]+/g, '')
      .replace(/["'“”‘’]+$/g, '')
      .trim();
  };

  useEffect(() => {
    if (user) {
      loadPlans();
      loadAvailableModels();
      loadRuns();
    }
  }, [user, currentProject?.id]);

  useEffect(() => {
    if (formData.planId && formData.type === 'execution') {
      loadCases(formData.planId);
    }
  }, [formData.planId, formData.type]);

  const loadPlans = async () => {
    try {
      const data = await getTestPlans(user!.id, currentProject?.id);
      const sorted = [...data].sort((a: any, b: any) => 
        (b.sequence || 0) - (a.sequence || 0) || 
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      setPlans(sorted);
    } catch (error) {
      console.error('Erro ao carregar planos:', error);
    }
  };

  const loadRuns = async () => {
    if (!currentProject?.id) { setRuns([]); return; }
    try {
      const data = await listTestRunsByProject(currentProject.id);
      const filtered = data.filter(r => r.status === 'planned' || r.status === 'in_progress');
      const sorted = [...filtered].sort((a: any, b: any) => 
        (b.sequence || 0) - (a.sequence || 0) || 
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      setRuns(sorted);
    } catch { setRuns([]); }
  };

  const loadAvailableModels = () => {
    try {
      const config = ModelControlService.loadConfig();
      // Show active models; mark which ones have a key configured
      const activeModels = config.models.filter(model => model.active);
      setAvailableModels(activeModels);
    } catch (error) {
      console.error('Erro ao carregar modelos:', error);
    }
  };

  // Aplicar modelo preferido salvo nas configurações quando os modelos estiverem disponíveis
  useEffect(() => {
    const preferred = settings?.preferredModel || 'auto';
    setFormData(prev => {
      const exists = preferred === 'auto' || availableModels.some(m => m.id === preferred);
      if (!exists) return prev;
      if (prev.selectedModel === preferred) return prev;
      return { ...prev, selectedModel: preferred };
    });
  }, [availableModels, settings?.preferredModel]);

  const providerRequiresApiKey = (provider?: string) => {
    if (!provider) return false;
    return ['openai', 'anthropic', 'groq', 'gemini', 'openrouter'].includes(provider);
  };

  // Usa cache em memória do backend (populado no login via preloadAllKeys)
  const modelHasKey = (model: AIModel): boolean => {
    if (model.provider === 'ollama') return true;
    return (
      getCachedKeySync(model.provider, model.id) !== null ||
      getCachedKeySync(model.provider, '') !== null ||
      Boolean(model.apiKey)
    );
  };

  const selectedModelObj = (formData.selectedModel === 'auto' || formData.selectedModel === 'default')
    ? undefined
    : availableModels.find(m => m.id === formData.selectedModel);

  const extractDocumentViaServer = async (selectedFile: File) => {
    const token = localStorage.getItem('krg_local_auth_token');
    const form = new FormData();
    form.append('file', selectedFile);
    const res = await fetch('/api/documents/extract', {
      method: 'POST',
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error((await res.json()).error?.message || 'Erro ao extrair documento');
    return res.json() as Promise<{ text: string; images: { name: string; dataUrl: string }[]; filename: string; format: string }>;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setImages([]);
    const ext = selectedFile.name.toLowerCase().split('.').pop() || '';
    const isPlainText = selectedFile.type === 'text/plain' || ext === 'txt' || ext === 'md';
    // Arquivos de texto puro: ler diretamente no browser
    if (isPlainText) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = (event.target?.result as string) || '';
        setFormData(prev => ({ ...prev, requirements: content }));
        toast({ title: 'Documento carregado', description: `${selectedFile.name} carregado com sucesso.` });
      };
      reader.readAsText(selectedFile);
      return;
    }
    // Todos os demais formatos (PPTX, PDF, DOCX, DOC, etc.): enviar para o servidor
    try {
      const { text, images: extractedImages, format } = await extractDocumentViaServer(selectedFile);
      setFormData(prev => ({ ...prev, requirements: text }));
      if (extractedImages?.length > 0) {
        setImages(extractedImages);
        toast({
          title: 'Documento analisado',
          description: `${extractedImages.length} imagem(s) e texto extraídos de ${selectedFile.name}.`
        });
      } else {
        toast({ title: 'Documento carregado', description: `${selectedFile.name} (${format?.toUpperCase()}) analisado com sucesso.` });
      }
    } catch (err: any) {
      toast({ title: 'Erro ao processar', description: err?.message || 'Falha ao extrair conteúdo.', variant: 'destructive' });
    }
  };

  const loadCases = async (planId: string) => {
    try {
      const data = await getTestCases(user!.id, planId);
      const sorted = [...data].sort((a: any, b: any) => 
        (b.sequence || 0) - (a.sequence || 0) || 
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      setCases(sorted);
    } catch (error) {
      console.error('Erro ao carregar casos:', error);
    }
  };

  const generateWithAI = async () => {
    if (!user) return null;
    if (!currentProject?.id) throw new Error('Selecione um projeto antes de gerar.');

    const taskType: AIModelTask = 
      formData.type === 'plan' ? 'test-plan-generation' : 
      formData.type === 'case' ? 'test-case-generation' : 
      'test-execution-generation';

    // Mapear variáveis conforme templates padrão
    const variables: any = {
      // Para plano: o template usa appDescription/additionalContext
      appDescription: formData.description,
      additionalContext: formData.context,
      requirements: formData.requirements,
      // Incluir imagens extraídas do PPTX para análise visual pela IA
      images: images.length > 0 ? images.map(img => img.dataUrl) : undefined,
    };

    if (formData.type === 'execution') {
      // Buscar detalhes do caso e plano selecionados
      const selectedCase = cases.find(c => c.id === formData.caseId);
      const selectedPlan = plans.find(p => p.id === formData.planId);
      
      if (!selectedCase || !selectedPlan) {
        throw new Error('Caso ou plano de teste não encontrado');
      }
      
      variables.testCase = selectedCase;
      variables.testPlan = selectedPlan;
      // Enriquecer prompt com contexto explícito da execução
      variables.executionContext = formData.description;
      variables.additionalContext = formData.context;
    } else if (formData.type === 'case' && formData.planId) {
      const selectedPlan = plans.find(p => p.id === formData.planId);
      if (selectedPlan) {
        variables.testPlan = selectedPlan;
        // Template aceita numCases, mas por padrão geraremos 1
        variables.numCases = 1;
      }
    }

    try {
      // 'auto' → let executeTask use selectBestModelForTask internally
      const modelId = (formData.selectedModel && formData.selectedModel !== 'auto' && formData.selectedModel !== 'default')
        ? formData.selectedModel
        : 'auto';

      const effectiveTotal = 1; // gerar apenas 1 item por vez neste formulário
      const results: any[] = [];

      for (let i = 0; i < effectiveTotal; i++) {
        // Para evitar respostas agregadas, pedimos 1 item por iteração
        if (formData.type === 'case') {
          variables.numCases = 1;
        }

        // Usar ModelControlService para gerar o conteúdo com AI
        const result = await ModelControlService.executeTask(
          taskType,
          variables,
          modelId || undefined
        );
        const payload = (typeof result === 'object' && result !== null) ? (result as any) : {};

        if (formData.type === 'plan') {
          const formatPlanTitle = (): string => {
            const MONTH_NAMES_PT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
            const monthMap: Record<string, string> = {
              jan: '01', janeiro: '01',
              fev: '02', fevereiro: '02',
              mar: '03', marco: '03', março: '03',
              abr: '04', abril: '04',
              mai: '05', maio: '05',
              jun: '06', junho: '06',
              jul: '07', julho: '07',
              ago: '08', agosto: '08',
              set: '09', setembro: '09',
              out: '10', outubro: '10',
              nov: '11', novembro: '11',
              dez: '12', dezembro: '12'
            };

            const filename = file?.name || '';
            const src = [
              formData.requirements,
              formData.description,
              formData.context
            ].join(' ');

            // Match day followed by separator (including dots now)/space/de followed by month name/number, and optional year
            const dateRegex = /(\d{1,2})(?:[/_.-]|\s+(?:de\s+)?)(jan(?:eiro)?|fev(?:ereiro)?|mar(?:ço)?|abr(?:il)?|mai(?:o)?|jun(?:ho)?|jul(?:ho)?|ago(?:sto)?|set(?:embro)?|out(?:ubro)?|nov(?:embro)?|dez(?:embro)?|\d{1,2})(?:(?:[/_.-]|\s+)(\d{2,4}))?/i;
            // Prioritize matching from filename first!
            const match = filename.match(dateRegex) || src.match(dateRegex);

            const typeWord = isHybex ? 'Hybex' : 'Evo';

            if (match) {
              const dd = match[1].padStart(2, '0');
              const mmRaw = match[2].toLowerCase();
              let mm = '';
              if (monthMap[mmRaw]) {
                mm = monthMap[mmRaw];
              } else {
                mm = mmRaw.padStart(2, '0');
              }
              let yyyy = match[3] || new Date().getFullYear().toString();
              if (yyyy.length === 2) yyyy = '20' + yyyy;
              const title = `Sprint ${typeWord} ${dd}/${mm} ${yyyy}`;
              return title.replace(/^["'“”‘’]+/g, '').replace(/["'“”‘’]+$/g, '').trim();
            }

            // Fallback: usar data atual
            const now = new Date();
            const dd = String(now.getDate()).padStart(2, '0');
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const yyyy = now.getFullYear();
            const title = `Sprint ${typeWord} ${dd}/${mm} ${yyyy}`;
            return title.replace(/^["'“”‘’]+/g, '').replace(/["'“”‘’]+$/g, '').trim();
          };
          const newPlan = await createTestPlan({
            ...payload,
            title: formatPlanTitle(),
            user_id: user.id,
            project_id: currentProject.id,
            assigned_to: formData.assignedTo || user.id || null,
            status: formData.planStatus || 'draft',
            interested_users: formData.interestedUsers,
            generated_by_ai: true,
            images: images
          });
          results.push({ ...newPlan, type: 'plan' });
        } else if (formData.type === 'case') {
          // Alguns templates podem retornar um array ou um objeto com `cases`
          const source: any = Array.isArray(payload)
            ? (payload as any[])[0]
            : Array.isArray((payload as any)?.cases)
              ? (payload as any).cases[0]
              : payload;

          const extractSlideNumbers = (text: string): number[] => {
            const matches = text.match(/slide\s*(\d+)/gi);
            if (!matches) return [];
            const numbers: number[] = [];
            matches.forEach(m => {
              const num = parseInt(m.replace(/slide\s*/i, ''), 10);
              if (!isNaN(num) && !numbers.includes(num)) {
                numbers.push(num);
              }
            });
            return numbers;
          };

          const caseTitle = (source as any)?.title || '';
          const caseDesc = (source as any)?.description || '';
          const referencedSlides = [
            ...extractSlideNumbers(caseTitle),
            ...extractSlideNumbers(caseDesc)
          ];

          let caseImages: any[] = [];
          if (images && images.length > 0) {
            caseImages = images.filter((img: any) => {
              if (!img.slides || !Array.isArray(img.slides)) return false;
              return img.slides.some((sNum: number) => referencedSlides.includes(sNum));
            });
          }

          if (caseImages.length === 0 && formData.planId) {
            const selectedPlan = plans.find(p => p.id === formData.planId);
            const planImages = (selectedPlan as any)?.images || [];
            caseImages = planImages.filter((img: any) => {
              if (!img.slides || !Array.isArray(img.slides)) return false;
              return img.slides.some((sNum: number) => referencedSlides.includes(sNum));
            });
          }

          const rawCaseTitle = (source as any)?.title || '';
          let finalCaseTitle = cleanTitle(rawCaseTitle);
          if (formData.planId) {
            const selectedPlan = plans.find(p => p.id === formData.planId);
            if (selectedPlan) {
              const MONTH_NAMES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
              const planTitle = selectedPlan.title || '';
              let sprintLabel = '';
              
              if (planTitle.toLowerCase().startsWith('sprint')) {
                sprintLabel = planTitle;
              } else {
                const titleMatch = planTitle.match(/sprint[_-]?(\d{1,2})[_-]?(\d{1,2})(?:[_-]?(\d{4}))?/i);
                if (titleMatch) {
                  const dd = titleMatch[1].padStart(2, '0');
                  const mm = titleMatch[2].padStart(2, '0');
                  const yyyy = titleMatch[3] || new Date().getFullYear().toString();
                  const monthName = MONTH_NAMES_PT[parseInt(mm, 10) - 1] || mm;
                  sprintLabel = `Sprint_${dd}_${monthName}/${yyyy}`;
                } else {
                  const schedule = selectedPlan.schedule || selectedPlan.description || '';
                  const dates = Array.from(schedule.matchAll(/(\d{1,2})[/](\d{1,2})(?:[/](\d{4}))?/g));
                  if (dates.length > 0) {
                    const dd = (dates[0][1] as string).padStart(2, '0');
                    const mm = (dates[0][2] as string).padStart(2, '0');
                    const yyyy = (dates[0][3] as string | undefined) || new Date().getFullYear().toString();
                    const monthName = MONTH_NAMES_PT[parseInt(mm, 10) - 1] || mm;
                    sprintLabel = `Sprint_${dd}_${monthName}/${yyyy}`;
                  }
                }
              }
              
              if (sprintLabel) {
                const cleanedSprintLabel = sprintLabel.replace(/^["'“”‘’]+/g, '').replace(/["'“”‘’]+$/g, '').trim();
                finalCaseTitle = `${cleanedSprintLabel} - ${finalCaseTitle}`;
              }
            }
          }

          const newCase = await createTestCase({
            title: finalCaseTitle,
            description: (source as any)?.description,
            preconditions: (source as any)?.preconditions,
            expected_result: (source as any)?.expected_result,
            priority: (source as any)?.priority,
            type: (source as any)?.type,
            steps: (source as any)?.steps,
            plan_id: formData.planId || null,
            user_id: user.id,
            project_id: currentProject.id,
            assigned_to: formData.assignedTo || null,
            interested_users: formData.interestedUsers,
            generated_by_ai: true,
            images: caseImages
          } as any);
          const stakeholders = [...(formData.interestedUsers || [])];
          if (formData.assignedTo && formData.assignedTo !== 'none') stakeholders.push(formData.assignedTo);
          if (stakeholders.length > 0) {
            await notifyStakeholders({
              stakeholderIds: stakeholders,
              title: 'Novo caso de teste (IA) - você é interessado',
              body: `Caso gerado por IA: "${newCase.title}".`,
              link: `/cases?id=${newCase.id}`,
            });
          }
          // Auto-criar requisito + vínculo para o caso gerado
          try {
            const newReq = await createRequirement({
              user_id: user.id,
              project_id: currentProject.id,
              title: newCase.title,
              description: `Requisito gerado automaticamente a partir do caso: ${newCase.title}`,
              priority: (newCase.priority || 'medium') as any,
              status: 'open',
            } as any);
            await linkCaseToRequirement(user.id, newReq.id, newCase.id);
          } catch (err) {
            console.warn('[AI Case] falha ao criar requisito automatico:', err);
          }
          results.push({ ...newCase, type: 'case' });
        } else if (formData.type === 'execution') {
          const newExecution = await createTestExecution({
            status: (payload as any).status,
            actual_result: (payload as any).actual_result,
            notes: (payload as any).notes,
            plan_id: formData.planId,
            case_id: formData.caseId,
            run_id: formData.runId || null,
            assigned_to: formData.assignedTo || null,
            interested_users: formData.interestedUsers,
            user_id: user.id,
            executed_by: user.id
          } as any);
          const stakeholders = [...(formData.interestedUsers || [])];
          if (formData.assignedTo && formData.assignedTo !== 'none') stakeholders.push(formData.assignedTo);
          if (stakeholders.length > 0) {
            await notifyStakeholders({
              stakeholderIds: stakeholders,
              title: 'Nova execução (IA) - você é interessado',
              body: `Execução gerada por IA (status: ${(payload as any).status || 'n/a'}).`,
              link: `/executions?id=${newExecution.id}`,
            });
          }
          results.push({ ...newExecution, type: 'execution' });
        }
      }

      return results.length === 1 ? results[0] : results;
    } catch (error) {
      console.error('Erro ao gerar com IA:', error);
      throw error;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setLastError(null);

    // Toast de progresso persistente com o spinner animado (Loader2)
    const activeToast = toast({
      title: "Geração iniciada",
      description: (
        <div className="flex items-center gap-2 mt-1">
          <Loader2 className="h-4 w-4 animate-spin text-brand" />
          <span>A IA está processando sua solicitação em segundo plano...</span>
        </div>
      ),
      duration: 600000, // 10 minutos (infinito prático)
    } as any);

    // Notify parent to close the form/modal and redirect
    onSuccess?.(null);

    // Process in background
    generateWithAI()
      .then((result) => {
        activeToast.update({
          id: activeToast.id,
          title: "Sucesso",
          description: `${formData.type === 'plan' ? 'Plano' : formData.type === 'case' ? 'Caso' : 'Execução'} de teste gerado e salvo com IA!`,
          duration: 5000,
        } as any);

        // Dispara eventos customizados para atualizar as listagens
        if (formData.type === 'plan') {
          window.dispatchEvent(new CustomEvent('nexus:plans-changed'));
        } else if (formData.type === 'case') {
          window.dispatchEvent(new CustomEvent('nexus:cases-changed'));
        } else if (formData.type === 'execution') {
          window.dispatchEvent(new CustomEvent('nexus:executions-changed'));
        }
      })
      .catch((error: any) => {
        console.error('Erro ao gerar com IA:', error);
        const message: string = error?.message || 'Erro ao gerar conteúdo com IA. Verifique a chave da API e o schema de saída.';
        setLastError(message);
        activeToast.update({
          id: activeToast.id,
          title: "Erro na geração",
          description: `Falha ao gerar conteúdo: ${message.slice(0, 100)}`,
          variant: "destructive",
          duration: 7000,
        } as any);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (!loading && currentProject?.id && formData.description) {
        handleSubmit(e as any);
      }
    }
  };

  const TYPE_OPTIONS = [
    { value: 'plan' as const, label: 'Plano de Teste', icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/40' },
    { value: 'case' as const, label: 'Caso de Teste', icon: FlaskConical, color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/40' },
    { value: 'execution' as const, label: 'Execução', icon: Play, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/40' },
  ];

  const [showExtractedData, setShowExtractedData] = useState(false);

  return (
    <form 
      onSubmit={handleSubmit} 
      onKeyDown={handleKeyDown}
      className="space-y-6 overflow-x-hidden p-1" 
      aria-busy={loading}
    >
      {/* Top bar: project + file upload */}
      <div className="flex items-center justify-between pb-4 border-b border-border/40">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Projeto Ativo</span>
          {currentProject?.name ? (
            <Badge variant="outline" className="gap-1.5 py-1 px-2.5 bg-emerald-500/5 border-emerald-500/20 text-emerald-500 text-xs font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {currentProject.name}
            </Badge>
          ) : (
            <span className="text-xs text-amber-500 flex items-center gap-1 font-medium bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10">
              <AlertCircle className="h-3.5 w-3.5" />
              Selecione um projeto ativo
            </span>
          )}
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Documento de Referência</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-foreground transition-colors cursor-help">
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[250px] p-2 text-xs">
                  Imagens anexadas sumirão depois de 1 mês sendo necessário consultar os docs enviados por e-mail das apresentações.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <label className={cn(
            "flex items-center gap-2 cursor-pointer text-xs transition-all duration-200 border rounded-lg px-3 py-1.5",
            file 
              ? "bg-brand/5 border-brand/30 text-brand font-medium shadow-sm shadow-brand/10" 
              : "bg-muted/30 border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
          )} title="Aceita .txt, .md, .doc, .docx, .pdf, .xlsx, .xls, .pptx">
            <Upload className={cn("h-3.5 w-3.5", file && "animate-bounce")} />
            {file ? <span className="max-w-[140px] truncate">{file.name}</span> : 'Importar arquivo'}
            <input type="file" className="sr-only" accept=".txt,.md,.doc,.docx,.pdf,.xlsx,.xls,.pptx" onChange={handleFileChange} />
          </label>
        </div>
      </div>

      {/* Type selector pills */}
      {!hideTypeSelector && (
        <div className="flex gap-2 p-1 bg-muted/20 rounded-xl border border-border/40">
          {TYPE_OPTIONS.map(({ value, label, icon: Icon, color, bg }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleChange('type', value)}
              className={cn(
                'flex items-center gap-2 flex-1 justify-center py-2.5 px-3 rounded-lg text-xs font-semibold transition-all duration-300',
                formData.type === value 
                  ? `bg-background shadow-md shadow-black/10 border-border/80 ${color}` 
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50 border-transparent border'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Main Body Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Main Content Area */}
        <div className="md:col-span-8 space-y-5">
          <div className="group space-y-2">
            <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5 ml-1">
              <FileText className="h-3.5 w-3.5 text-brand" />
              {formData.type === 'execution' ? 'Contexto da Execução' : 'Descrição da Funcionalidade'}
              <span className="text-destructive">*</span>
            </Label>
            <div className="relative group/input">
              <Textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={formData.type === 'execution' ? 5 : 6}
                className="text-sm resize-none bg-muted/10 border-border/60 focus:bg-background transition-all duration-200 focus:shadow-sm focus:shadow-brand/5"
                placeholder={
                  formData.type === 'execution'
                    ? 'Descreva o ambiente, massa de dados ou contexto específico desta execução...'
                    : 'Descreva detalhadamente o que será testado. A IA usará isso como base principal.'
                }
                required
              />
              <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-focus-within/input:opacity-100 transition-opacity">
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border">CMD+ENTER para gerar</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5 ml-1">
              <Info className="h-3.5 w-3.5 text-amber-500" />
              Contexto Adicional
            </Label>
            <Textarea
              value={formData.context}
              onChange={(e) => handleChange('context', e.target.value)}
              rows={3}
              className="text-sm resize-none bg-muted/10 border-border/60 focus:bg-background transition-all duration-200"
              placeholder="Ex: Utilizar base de homologação, navegadores Chrome/Firefox, padrão de design system X..."
            />
          </div>

          {/* Collapsible Extracted Data Section */}
          {(formData.requirements || images.length > 0) && (
            <Collapsible
              open={showExtractedData}
              onOpenChange={setShowExtractedData}
              className="border border-border/40 rounded-xl bg-muted/5 overflow-hidden transition-all duration-200"
            >
              <CollapsibleTrigger asChild>
                <button type="button" className="w-full flex items-center justify-between p-3 text-xs font-medium text-muted-foreground hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5 text-brand" />
                    <span>Dados de Análise Técnica (Extraídos do Doc)</span>
                    <Badge variant="secondary" className="text-[10px] py-0 h-4 bg-brand/10 text-brand border-none">IA ONLY</Badge>
                  </div>
                  {showExtractedData ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="p-4 pt-0 space-y-4 animate-in slide-in-from-top-2 duration-200">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Texto Extraído</Label>
                    <span className="text-[10px] text-muted-foreground italic">Este texto será enviado à IA para extração de cenários</span>
                  </div>
                  <Textarea
                    value={formData.requirements}
                    onChange={(e) => handleChange('requirements', e.target.value)}
                    rows={4}
                    className="text-[11px] font-mono leading-relaxed bg-black/5 dark:bg-black/20 border-border/40 resize-none opacity-80"
                  />
                </div>

                {images.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border/20">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Imagens ({images.length})</Label>
                      <button
                        type="button"
                        onClick={() => setImages([])}
                        className="text-[10px] text-destructive hover:underline"
                      >
                        Remover da Análise
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-3 bg-black/5 dark:bg-black/20 rounded-lg border border-border/20">
                      {images.map((img, idx) => (
                        <div key={idx} className="relative group cursor-zoom-in">
                          <img
                            src={img.dataUrl}
                            alt={`Slide ${idx + 1}`}
                            className="h-20 w-20 object-cover rounded-md border border-border/40 shadow-sm transition-transform hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-md">
                            <ImageIcon className="h-4 w-4 text-white" />
                          </div>
                          <span className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-brand text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-md">
                            {idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        {/* Sidebar / Configuration */}
        <div className="md:col-span-4 space-y-5 flex flex-col">
          <div className="bg-muted/10 border border-border/40 rounded-2xl p-5 space-y-5 flex-1">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-amber-500" /> Configuração IA
            </h3>

            {/* Associative Fields */}
            <div className="space-y-4">
              {formData.type === 'execution' ? (
                <>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold flex items-center gap-1.5">
                      <FileText className="h-3 w-3" /> Plano de Origem
                    </Label>
                    <Select value={formData.planId} onValueChange={(v) => handleChange('planId', v)} required>
                      <SelectTrigger className="h-9 text-xs bg-background">
                        <SelectValue placeholder="Selecionar plano" />
                      </SelectTrigger>
                      <SelectContent>
                        {plans.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-xs">{p.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold flex items-center gap-1.5">
                      <FlaskConical className="h-3 w-3" /> Caso de Teste
                    </Label>
                    <Select value={formData.caseId} onValueChange={(v) => handleChange('caseId', v)} required disabled={!formData.planId}>
                      <SelectTrigger className="h-9 text-xs bg-background">
                        <SelectValue placeholder="Selecionar caso" />
                      </SelectTrigger>
                      <SelectContent>
                        {cases.map((c) => (
                          <SelectItem key={c.id} value={c.id} className="text-xs">{c.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold flex items-center gap-1.5">
                      <Play className="h-3 w-3" /> Ciclo de Execução
                    </Label>
                    <Select value={formData.runId || 'none'} onValueChange={(v) => handleChange('runId', v === 'none' ? '' : v)}>
                      <SelectTrigger className="h-9 text-xs bg-background">
                        <SelectValue placeholder="Sem ciclo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-xs">— sem ciclo —</SelectItem>
                        {runs.map((r) => (
                          <SelectItem key={r.id} value={r.id} className="text-xs">
                            {r.sequence ? `RUN-${String(r.sequence).padStart(3, '0')} • ` : ''}{r.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : formData.type === 'case' ? (
                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold flex items-center gap-1.5">
                    <FileText className="h-3 w-3" /> Vincular ao Plano
                  </Label>
                  <Select value={formData.planId} onValueChange={(v) => handleChange('planId', v)}>
                    <SelectTrigger className="h-9 text-xs bg-background">
                      <SelectValue placeholder="Sem plano associado" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">{p.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold flex items-center gap-1.5">
                    <Bot className="h-3 w-3" /> Responsável / Atribuído
                  </Label>
                  <Select value={formData.assignedTo} onValueChange={(v) => handleChange('assignedTo', v === 'none' ? '' : v)}>
                    <SelectTrigger className="h-10 bg-muted/20 border-border/40 focus:ring-0">
                      <SelectValue placeholder="Nenhum" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {users.map(u => (
                        <SelectItem key={u.id} value={u.id}>{labelFor(u)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-semibold flex items-center gap-1.5">
                  <Zap className="h-3 w-3" /> Equipe Interessada
                </Label>
                <UserMultiSelectField 
                  selectedIds={formData.interestedUsers}
                  onChange={(ids) => handleChange('interestedUsers', ids)}
                  placeholder="Notificar interessados..."
                />
              </div>

              {formData.type === 'plan' && (
                <div className="flex flex-col gap-2 pt-2 border-t border-border/10">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold flex items-center gap-1.5">
                      <FileText className="h-3 w-3" /> Status do Plano
                    </Label>
                    <Select value={formData.planStatus} onValueChange={(v) => handleChange('planStatus', v)}>
                      <SelectTrigger className="h-9 text-xs bg-background">
                        <SelectValue placeholder="Rascunho" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft" className="text-xs">Rascunho</SelectItem>
                        <SelectItem value="active" className="text-xs">Ativo</SelectItem>
                        <SelectItem value="review" className="text-xs">Em Revisão</SelectItem>
                        <SelectItem value="completed" className="text-xs">Concluído</SelectItem>
                        <SelectItem value="archived" className="text-xs">Arquivado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="evo-checkbox"
                      checked={isEvo}
                      onCheckedChange={(checked) => {
                        setIsEvo(!!checked);
                        if (checked) setIsHybex(false);
                      }}
                    />
                    <Label htmlFor="evo-checkbox" className="text-xs cursor-pointer font-medium text-foreground/80">
                      Usar padrão Evo (Sprint Evo)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hybex-checkbox"
                      checked={isHybex}
                      onCheckedChange={(checked) => {
                        setIsHybex(!!checked);
                        if (checked) setIsEvo(false);
                      }}
                    />
                    <Label htmlFor="hybex-checkbox" className="text-xs cursor-pointer font-medium text-foreground/80">
                      Usar padrão Hybex (Sprint Hybex)
                    </Label>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-border/20">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  Motor de Inteligência
                </Label>
                <Select value={formData.selectedModel} onValueChange={(v) => handleChange('selectedModel', v)}>
                  <SelectTrigger className="h-10 text-xs bg-background/50 border-brand/20 hover:border-brand/40 transition-colors shadow-inner">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto" className="text-xs">
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                        ✨ Seleção Inteligente
                      </span>
                    </SelectItem>
                    {availableModels.map((m) => {
                      const task = formData.type === 'plan' ? 'test-plan-generation' : formData.type === 'case' ? 'test-case-generation' : 'test-execution-generation';
                      const hasCap = m.capabilities?.includes(task);
                      const hasKey = modelHasKey(m);
                      return (
                        <SelectItem key={m.id} value={m.id} className="text-xs">
                          <div className="flex items-center justify-between w-full">
                            <span>{m.name}</span>
                            {hasCap && hasKey ? (
                              <Badge variant="secondary" className="h-4 py-0 px-1 text-[8px] bg-emerald-500/10 text-emerald-500 border-none">PRONTO</Badge>
                            ) : hasCap && !hasKey ? (
                              <Badge variant="secondary" className="h-4 py-0 px-1 text-[8px] bg-amber-500/10 text-amber-500 border-none">SEM CHAVE</Badge>
                            ) : null}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {selectedModelObj && providerRequiresApiKey(selectedModelObj.provider) && !modelHasKey(selectedModelObj) && (
                  <div className="flex items-start gap-1.5 mt-2 bg-amber-500/5 p-2 rounded border border-amber-500/20">
                    <AlertCircle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[9px] text-amber-600 font-medium">Configure a API Key no Painel de Modelos para utilizar este motor.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              type="submit"
              disabled={loading || !currentProject?.id || (formData.type === 'execution' && (!formData.planId || !formData.caseId))}
              className={cn(
                "w-full h-12 text-sm font-bold tracking-wide transition-all duration-300 relative overflow-hidden group",
                loading ? "opacity-90" : "bg-gradient-to-r from-brand via-brand/90 to-brand-secondary hover:shadow-lg hover:shadow-brand/20 active:scale-[0.98]"
              )}
              aria-busy={loading}
            >
              <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-[-20deg]" />
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Sintonizando IA...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2 group-hover:animate-pulse" />
                  GERAR COM INTELIGÊNCIA
                </>
              )}
            </Button>

            {lastError && (
              <div
                id="ai-error-details"
                role="alert"
                className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-[11px] text-destructive animate-in fade-in zoom-in duration-200"
              >
                <p className="font-bold flex items-center gap-1.5 mb-1 text-xs">
                  <AlertCircle className="h-3.5 w-3.5" /> Erro na Geração
                </p>
                <p className="opacity-80 leading-relaxed break-words">{lastError}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </form>
  );
};
