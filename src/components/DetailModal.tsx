import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Calendar, Sparkles, Loader2, ClipboardList, Link2, Bug as BugIcon, ChevronDown, ChevronLeft, ChevronRight, Download, Info, Image as ImageIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TestPlan, TestCase, TestExecution, Requirement, Defect } from '@/types';
import { ExportDropdown } from './ExportDropdown';
import { UserProfileModal } from './UserProfileModal';
import { TeamAvatars } from './TeamAvatars';
import { toast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api';
import { formatLocalDateTime, cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const userRoleLabel: Record<string, string> = {
  master: 'Master',
  admin: 'Administrador',
  manager: 'Gerência',
  tester: 'Testador',
  viewer: 'Visualizador',
};
import * as ModelControlService from '@/services/modelControlService';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  priorityLabel,
  priorityBadgeClass,
  executionStatusLabel,
  executionStatusBadgeClass,
  requirementStatusLabel,
  requirementStatusBadgeClass,
  defectStatusLabel,
  defectStatusBadgeClass,
  testCaseTypeLabel,
  testCaseTypeBadgeClass,
} from '@/lib/labels';
import type { ExecutionStatus, TestCaseType } from '@/lib/labels';
import { useProject } from '@/contexts/ProjectContext';

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: TestPlan | TestCase | TestExecution | Requirement | Defect | null;
  type: 'plan' | 'case' | 'execution' | 'requirement' | 'defect';
  onEdit?: (item: any) => void;
  onDelete?: (id: string) => void;
}

export const DetailModal = ({ isOpen, onClose, item, type, onEdit, onDelete }: DetailModalProps) => {
  const SINGLE_TENANT = String((import.meta as any).env?.VITE_SINGLE_TENANT ?? 'true') === 'true';
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [additionalContext, setAdditionalContext] = useState('');
  const [selectedModelId, setSelectedModelId] = useState<string>('default');
  const [author, setAuthor] = useState<{ id: string; email?: string; display_name?: string; avatar_url?: string; github_url?: string; google_url?: string; website_url?: string; tags?: any[]; role?: string } | null>(null);
  const [assignedUser, setAssignedUser] = useState<{ id: string; email?: string; display_name?: string; avatar_url?: string; role?: string } | null>(null);
  const [executor, setExecutor] = useState<{ id: string; email?: string; display_name?: string } | null>(null);
  const [showAuthorModal, setShowAuthorModal] = useState(false);
  const [showAssignedModal, setShowAssignedModal] = useState(false);
  const [showExecutorModal, setShowExecutorModal] = useState(false);
  const [authorTags, setAuthorTags] = useState<Array<{ label: string; icon?: string }>>([]);
  const [interestedProfiles, setInterestedProfiles] = useState<any[]>([]);
  const [linkedPlan, setLinkedPlan] = useState<{ id: string; sequence?: number | null; title?: string } | null>(null);
  const [linkedCase, setLinkedCase] = useState<{ id: string; sequence?: number | null; title?: string } | null>(null);
  const [loadingBranch, setLoadingBranch] = useState(false);
  const [defectCount, setDefectCount] = useState(0);
  const [linkedReqs, setLinkedReqs] = useState<Array<{ id: string; title: string; sequence?: number | null }>>([]);
  const [linkedCases, setLinkedCases] = useState<Array<{ id: string; title: string; sequence?: number | null }>>([]);
  const { currentProject } = useProject();
  const isProjectInactive = !!currentProject && currentProject.status !== 'active';

  const [carouselOpen, setCarouselOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [hasMoreScroll, setHasMoreScroll] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    setHasMoreScroll(el.scrollHeight > el.clientHeight + 24 && !atBottom);
    setHasScrolled(el.scrollTop > 60);
  }, []);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  // Reset confirmDelete when modal is closed or item changes
  useEffect(() => {
    if (!isOpen) {
      setConfirmDelete(false);
      setLinkedPlan(null);
      setLinkedCase(null);
      setDefectCount(0);
      setLinkedReqs([]);
      setLinkedCases([]);
      setInterestedProfiles([]);
      setCarouselOpen(false);
      setCurrentImageIndex(0);
      setZoomOpen(false);
      setHasMoreScroll(false);
      setHasScrolled(false);
    } else {
      // Delay to let content render before checking scroll
      setTimeout(checkScroll, 150);
    }
  }, [isOpen, item, checkScroll]);

  // Keep scroll indicator in sync as content changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => ro.disconnect();
  }, [checkScroll]);

  // Buscar casos vinculados ao requisito
  useEffect(() => {
    if (!isOpen || !item || type !== 'requirement') return;
    const reqId = (item as any).id;
    if (!reqId) return;
    apiClient
      .from('requirement_cases')
      .select('case_id, test_cases(id, title, sequence)')
      .eq('requirement_id', reqId)
      .then(({ data }) => {
        if (!data) return;
        const cases = data
          .map((row: any) => row.test_cases)
          .filter(Boolean)
          .map((c: any) => ({ id: c.id, title: c.title, sequence: c.sequence ?? null }));
        setLinkedCases(cases);
      });
  }, [isOpen, item, type]);

  // Buscar requisitos vinculados ao caso de teste
  useEffect(() => {
    if (!isOpen || !item || type !== 'case') return;
    const caseId = (item as any).id;
    if (!caseId) return;
    apiClient
      .from('requirement_cases')
      .select('requirement_id, requirements(id, title, sequence)')
      .eq('case_id', caseId)
      .then(({ data }) => {
        if (!data) return;
        const reqs = data
          .map((row: any) => row.requirements)
          .filter(Boolean)
          .map((r: any) => ({ id: r.id, title: r.title, sequence: r.sequence ?? null }));
        setLinkedReqs(reqs);
      });
  }, [isOpen, item, type]);

  // Buscar contagem de defeitos para execuções (apenas desta execução específica)
  useEffect(() => {
    if (!isOpen || !item || type !== 'execution') return;
    // Buscar defeitos vinculados à execução específica (não ao caso todo)
    const execId = (item as any).id as string | undefined;
    if (execId) {
      apiClient.from('defects').select('id', { count: 'exact', head: true })
        .eq('execution_id', execId).neq('status', 'closed')
        .then(({ count }) => setDefectCount(count || 0));
    } else {
      setDefectCount(0);
    }
  }, [isOpen, item, type]);

  // Buscar perfil do executor para execuções
  useEffect(() => {
    if (!isOpen || !item || type !== 'execution') return;
    const execItem = item as TestExecution;
    const executorId = execItem.user_id || execItem.executed_by;
    if (!executorId) {
      setExecutor(null);
      return;
    }
    apiClient.from('profiles').select('id, email, display_name').eq('id', executorId).single()
      .then(({ data }) => {
        if (data) setExecutor(data as any);
        else setExecutor(null);
      })
      .catch(() => setExecutor(null));
  }, [isOpen, item, type]);



  // Fetch linked plan/case for vínculos section
  useEffect(() => {
    if (!isOpen || !item) return;
    const planId = (item as any).plan_id as string | undefined;
    const caseId = (item as any).case_id as string | undefined;
    if (planId) {
      apiClient.from('test_plans').select('id, sequence, title').eq('id', planId).maybeSingle()
        .then(({ data }) => { if (data) setLinkedPlan(data as any); });
    }
    if (caseId) {
      apiClient.from('test_cases').select('id, sequence, title').eq('id', caseId).maybeSingle()
        .then(({ data }) => { if (data) setLinkedCase(data as any); });
    }

    // Fetch assigned user
    const assignedTo = (item as any).assigned_to as string | undefined;
    if (assignedTo) {
      apiClient.from('profiles').select('id, email, display_name, avatar_url, role').eq('id', assignedTo).maybeSingle()
        .then(({ data }) => {
          if (data) setAssignedUser(data as any);
          else setAssignedUser(null);
        })
        .catch(() => setAssignedUser(null));
    } else {
      setAssignedUser(null);
    }

    // Fetch interested users profiles
    const interestedIds = (item as any).interested_users || [];
    if (Array.isArray(interestedIds) && interestedIds.length > 0) {
      apiClient.from('profiles').select('id, email, display_name, avatar_url, role')
        .in('id', interestedIds)
        .then(({ data }) => {
          if (data) setInterestedProfiles(data);
        });
    } else {
      setInterestedProfiles([]);
    }
  }, [isOpen, item]);

  useEffect(() => {
    setConfirmDelete(false);
  }, [item]);

  const formatDate = (date: Date) => {
    return formatLocalDateTime(date);
  };

  // Classes para status de Plano/Caso (reuso do padrão aplicado em TestPlans)
  const planStatusClasses = (status: string) => (
    status === 'active'
      ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-400/15 dark:text-green-300 dark:border-transparent dark:ring-1 dark:ring-green-400/25'
      : status === 'review'
      ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-400/15 dark:text-yellow-300 dark:border-transparent dark:ring-1 dark:ring-yellow-400/25'
      : status === 'approved'
      ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-400/15 dark:text-blue-300 dark:border-transparent dark:ring-1 dark:ring-blue-400/25'
      : status === 'archived'
      ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-400/15 dark:text-red-300 dark:border-transparent dark:ring-1 dark:ring-red-400/25'
      : status === 'draft'
      ? 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-slate-400/15 dark:text-slate-300 dark:border-transparent dark:ring-1 dark:ring-slate-400/25'
      : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-slate-400/15 dark:text-slate-300 dark:border-transparent dark:ring-1 dark:ring-slate-400/25'
  );

  // Abre o modal de confirmação de geração
  const openGenerateDialog = () => {
    setShowGenerateDialog(true);
  };

  // Confirma e dispara a geração com as opções escolhidas
  const confirmAndGenerate = () => {
    const modelOverride = selectedModelId === 'default' ? undefined : selectedModelId;
    setShowGenerateDialog(false);
    onClose();
    // Dispara a geração em segundo plano
    handleGenerateCasesForPlan({ additionalContext, modelId: modelOverride });
  };

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete?.(item.id);
      onClose();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
    }
  };

  const handleClose = () => {
    setConfirmDelete(false);
    onClose();
  };

  const getTypeLabel = () => {
    switch (type) {
      case 'plan': return 'Plano de Teste';
      case 'case': return 'Caso de Teste';
      case 'execution': return 'Execução de Teste';
      case 'requirement': return 'Requisito';
      case 'defect': return 'Defeito';
      default: return '';
    }
  };

  // Returns the human-readable sequence prefix for the item (e.g. PT-001, CT-002)
  const getItemSequenceLabel = () => {
    const seq = (item as any).sequence;
    if (seq == null) return null;
    const padded = String(seq).padStart(3, '0');
    switch (type) {
      case 'plan':        return `PT-${padded}`;
      case 'case':        return `CT-${padded}`;
      case 'execution':   return `EXE-${padded}`;
      case 'requirement': return `REQ-${padded}`;
      case 'defect':      return `DEF-${padded}`;
      default:            return `#${padded}`;
    }
  };

  // Short ID badge — no line break (e.g. PT-001, CT-018, EXE-001)
  const getItemSequenceBadgeLabel = () => {
    const seq = (item as any).sequence;
    if (seq == null) return null;
    const padded = String(seq).padStart(3, '0');
    switch (type) {
      case 'plan':        return `PT-${padded}`;
      case 'case':        return `CT-${padded}`;
      case 'execution':   return `EXE-${padded}`;
      case 'requirement': return `REQ-${padded}`;
      case 'defect':      return `DEF-${padded}`;
      default:            return `#${padded}`;
    }
  };

  const getItemTitle = () => {
    if (type === 'execution') {
      const seq = 'sequence' in item && (item as any).sequence ? (item as any).sequence : null;
      const label = seq ? `EXE-${String(seq).padStart(3, '0')}` : `#${item.id.slice(0, 8)}`;
      const notes = (item as TestExecution).notes;
      return notes ? `${label} - ${notes.slice(0, 60)}${notes.length > 60 ? '…' : ''}` : label;
    }
    const base = (item as TestPlan | TestCase | Requirement | Defect).title;
    const seqLabel = getItemSequenceLabel();
    return seqLabel ? `${seqLabel} - ${base}` : base;
  };

  const getItemDescription = () => {
    if (type === 'execution') {
      return (item as TestExecution).notes || '';
    }
    return (item as TestPlan | TestCase | Requirement | Defect).description || '';
  };

  // Carrega informações do autor para exibir e-mail/link do perfil
  useEffect(() => {
    const loadAuthor = async () => {
      if (!isOpen || !item || !('user_id' in (item as any))) return;
      const uid = (item as any).user_id as string;
      try {
        // Always try profiles table first (works regardless of SINGLE_TENANT)
        try {
          const res = await apiClient
            .from('profiles' as any)
            .select('id, email, display_name, avatar_url, github_url, google_url, website_url, tags, role')
            .eq('id', uid)
            .maybeSingle();
          const data = res.data; const error = res.error;
          if (data && !error) {
            const effectiveRole = (data as any).role || (SINGLE_TENANT ? 'master' : undefined);
            setAuthor({
              id: (data as any).id,
              email: (data as any).email,
              display_name: (data as any).display_name,
              avatar_url: (data as any).avatar_url,
              github_url: (data as any).github_url,
              google_url: (data as any).google_url,
              website_url: (data as any).website_url,
              tags: (data as any).tags || [],
              role: effectiveRole,
            });
            if (Array.isArray((data as any).tags) && (data as any).tags.length > 0) {
              setAuthorTags((data as any).tags);
            } else {
              // Fallback: user_metadata.tags (SINGLE_TENANT mode stores tags there)
              try {
                const { data: authData } = await apiClient.auth.getUser();
                if (authData?.user?.id === uid) {
                  const mt = (authData.user.user_metadata as any)?.tags;
                  if (Array.isArray(mt)) setAuthorTags(mt);
                }
              } catch { /* ignore */ }
            }
            return;
          }
        } catch { /* ignore */ }
        // Fallback: auth.getUser() (SINGLE_TENANT or when profile row is missing)
        const { data: authData } = await apiClient.auth.getUser();
        const me = authData?.user;
        if (me && me.id === uid) {
          setAuthor({
            id: me.id,
            email: me.email || undefined,
            display_name: (me.user_metadata as any)?.full_name,
            avatar_url: (me.user_metadata as any)?.avatar_url,
            github_url: (me.user_metadata as any)?.github_url,
            google_url: (me.user_metadata as any)?.google_url,
            website_url: (me.user_metadata as any)?.website_url,
            tags: (me.user_metadata as any)?.tags || [],
            role: SINGLE_TENANT ? 'master' : (me.user_metadata as any)?.role,
          });
          const rawT = (me.user_metadata as any)?.tags; if (Array.isArray(rawT)) setAuthorTags(rawT);
        } else {
          setAuthor({ id: uid });
          setAuthorTags([]);
        }
      } catch {
        setAuthor({ id: uid });
        setAuthorTags([]);
      }
    };
    loadAuthor();
  }, [isOpen, item]);

  if (!item) return null;

  const getItemDate = () => {
    if (type === 'execution') {
      return (item as TestExecution).executed_at;
    }
    return (item as TestPlan | TestCase | Requirement | Defect).created_at;
  };

  const translateStatus = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'open': 'aberto',
      'closed': 'fechado',
      'in_progress': 'em andamento',
      'resolved': 'resolvido',
      'pending': 'pendente',
      'approved': 'aprovado',
      'rejected': 'rejeitado',
      'active': 'ativo',
      'inactive': 'inativo',
      'draft': 'rascunho',
      'review': 'em revisão'
    };
    return statusMap[status] || status;
  };

  // Renderizador: converte texto em lista (ul/li) quando detecta marcadores ('-', '•', 'º', '#N ')
  // Comportamento extra: quando opts.centerShort=true centraliza textos curtos (<15 char) sem marcadores
  const renderListOrParagraph = (raw?: string, opts?: { centerShort?: boolean }) => {
    const text = (raw ?? '').toString().trim();
    if (!text) return null;

    // Normalize slide ranges in plain text (e.g. "slides 15-18" => "[Slide 15, 16, 17, 18]")
    const normalizeSlideReferences = (txt: string): string => {
      // Expand ranges like "slides 15-18" => "[Slide 15, 16, 17, 18]"
      const result = txt.replace(
        /\bslides?\s+(\d+)\s*[-\u2013\u2014a-z]\s*(\d+)\b/gi,
        (_m, start, end) => {
          const s = parseInt(start, 10);
          const e = parseInt(end, 10);
          if (isNaN(s) || isNaN(e) || e < s || e - s > 50) return _m;
          const nums = Array.from({ length: e - s + 1 }, (_, i) => s + i);
          return `[Slide ${nums.join(', ')}]`;
        }
      );
      // Collapse adjacent duplicate slide tags (same numbers already bracketed)
      return result;
    };

    const renderTextWithSlideBadges = (rawTxt: string) => {
      const txt = normalizeSlideReferences(rawTxt);
      // Normalize: [Slide 4, Slide 5] → [Slide 4, 5] so single regex handles it
      const normalized = txt
        // Merge [Slide X, Slide Y, Slide Z] into [Slide X, Y, Z]
        .replace(/\[\s*(slide\s*\d+)(?:\s*,\s*slide\s*(\d+))+\s*\]/gi, (m) => {
          const nums = Array.from(m.matchAll(/\d+/g)).map(x => x[0]);
          return `[Slide ${nums.join(', ')}]`;
        })
        // Merge consecutive bracket slide refs that appear side-by-side
        .replace(/\[\s*slides?\s*([\d,\s]+)\]\s*,?\s*\[\s*slides?\s*([\d,\s]+)\]/gi,
          (_m, a, b) => `[Slide ${a.trim()}, ${b.trim()}]`
        );
      const slideRegex = /\[\s*slide[s]?\s*[\d,\s]+\]/gi;
      const parts = normalized.split(slideRegex);
      const matches = normalized.match(slideRegex);

      if (!matches) return <span>{txt}</span>;

      return (
        <span>
          {parts.map((part, index) => {
            const match = matches[index];
            return (
              <span key={index}>
                {part}
                {match && (
                  <span
                    className="inline-flex items-center gap-0.5 ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold select-none align-middle border"
                    style={{
                      backgroundColor: currentProject?.color ? `${currentProject.color}15` : 'var(--brand-opacity-10)',
                      color: currentProject?.color || 'var(--brand)',
                      borderColor: currentProject?.color ? `${currentProject.color}33` : 'var(--brand-opacity-20)',
                    }}
                  >
                    {match.replace(/\[|\]/g, '').trim()}
                  </span>
                )}
              </span>
            );
          })}
        </span>
      );
    };

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    // Caso especial: bloco consolidado por caso
    if (text.startsWith('Contexto consolidado por caso:')) {
      const [label, ...rest] = lines;
      const items = rest.map(l => l.replace(/^#\d+\s*/, '').trim()).filter(Boolean);
      return (
        <div>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-2 text-left">{renderTextWithSlideBadges(label)}</p>
          <ol className="list-decimal list-outside ml-5 text-gray-600 dark:text-gray-400 text-sm text-left">
            {items.map((i, idx) => (<li key={idx}>{renderTextWithSlideBadges(i)}</li>))}
          </ol>
        </div>
      );
    }

    const hasMarkers = lines.some(l => /^[-•\u00BA]/.test(l) || /^#\d+\s+/.test(l));
    if (opts?.centerShort && !hasMarkers) {
      const isVeryShort = text.length < 80 && !/\r?\n/.test(text);
      if (isVeryShort) {
        return (
          <p className="text-gray-600 dark:text-gray-400 text-sm text-center">{renderTextWithSlideBadges(text)}</p>
        );
      }
    }
    if (hasMarkers) {
      const items = lines.map(l => {
        if (/^[-•]/.test(l)) return l.replace(/^[-•]\s*/, '');
        if (/^\u00BA/.test(l)) return 'º ' + l.replace(/^\u00BA\s*/, ''); // preserva prefixo 'º '
        if (/^#\d+\s+/.test(l)) return l.replace(/^#\d+\s+/, '');
        return l;
      });
      return (
        <ul className="list-disc list-outside ml-5 text-gray-600 dark:text-gray-400 text-sm text-left">
          {items.map((i, idx) => (<li key={idx}>{renderTextWithSlideBadges(i)}</li>))}
        </ul>
      );
    }

    // Heurística para branches: contém 'branch' e vírgulas -> lista com prefixo 'º '
    if (/branch/i.test(text) && text.includes(',')) {
      const [label, rest] = text.split(/:/, 2);
      const items = (rest || '')
        .split(',')
        .map(p => p.replace(/^e\s+/i, '').trim())
        .filter(Boolean);
      if (items.length) {
        return (
          <div>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-2 text-left">{renderTextWithSlideBadges(label)}:</p>
            <ul className="list-none ml-0 text-gray-600 dark:text-gray-400 text-sm text-left">
              {items.map((i, idx) => (<li key={idx}>º {renderTextWithSlideBadges(i)}</li>))}
            </ul>
          </div>
        );
      }
    }

    return (
      <p className="text-gray-600 dark:text-gray-400 text-sm whitespace-pre-wrap text-left">{renderTextWithSlideBadges(text)}</p>
    );
  };

  // Helpers simples para sanitizar e extrair JSON de respostas de IA
  const sanitizeText = (txt?: string) => {
    if (!txt) return '';
    let s = txt
      .replace(/[\u2018\u2019\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[\u2022\u25CF\u25A0\u2219]/g, '-')
      .replace(/[\u00A0]/g, ' ')
      .replace(/[\t ]+/g, ' ');
    // eslint-disable-next-line no-control-regex
    s = s.replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, '');
    return s.trim();
  };

  function tryJson(txt: string): any | undefined {
    try { return JSON.parse(txt); } catch { return undefined; }
  }

  function extractFromString(s: string): any | undefined {
    if (!s) return;
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence && fence[1]) {
      const parsed = tryJson(fence[1]);
      if (parsed) return parsed;
    }
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
      const parsed = tryJson(s.slice(first, last + 1));
      if (parsed) return parsed;
    }
    return tryJson(s.trim());
  }

  function extractAndParseJSON(raw: any): any {
    if (raw == null) return {};
    if (typeof raw === 'string') {
      const parsed = extractFromString(raw);
      return parsed ?? {};
    }
    if (typeof raw === 'object') {
      const candidates: any[] = [
        raw,
        (raw as any).data,
        (raw as any).response,
        (raw as any).output,
        (raw as any).result,
        (raw as any).message,
        (raw as any).content,
        (raw as any).text,
        (raw as any).choices?.[0]?.message?.content,
      ];
      for (const c of candidates) {
        if (!c) continue;
        if (typeof c === 'object' && (('cases' in c) || ('test_cases' in c) || ('testCases' in c))) {
          return c;
        }
        if (typeof c === 'string') {
          const parsed = extractFromString(c);
          if (parsed) return parsed;
        }
      }
    }
  }

  const handleGenerateCasesForPlan = async (opts?: { additionalContext?: string; modelId?: string }) => {
    if (!item || type !== 'plan') return;
    const plan = item as TestPlan;

    // Toast de progresso persistente com o spinner animado
    const activeToast = toast({
      title: "Geração de casos iniciada",
      description: (
        <div className="flex items-center gap-2 mt-1">
          <Loader2 className="h-4 w-4 animate-spin text-brand" />
          <span>A IA está analisando o plano e gerando os casos de teste em segundo plano...</span>
        </div>
      ),
      duration: 600000, // 10 minutos (infinito prático)
    } as any);

    setGenerating(true);
    try {
      // Monta conteúdo do documento a partir do plano atual
      const parts: string[] = [];
      parts.push(`# Plano: ${plan.title}`);
      if (plan.description) parts.push(`Descrição:\n${plan.description}`);
      if (plan.objective?.trim()) parts.push(`Objetivo:\n${plan.objective}`);
      if (plan.scope?.trim()) parts.push(`Escopo:\n${plan.scope}`);
      if (plan.criteria?.trim()) parts.push(`Critérios:\n${plan.criteria}`);
      if (opts?.additionalContext?.trim()) parts.push(`Contexto adicional (usuário):\n${opts.additionalContext.trim()}`);

      // Extrair branches reais do plano para direcionar os casos
      // Fallback: se branches vazio, tenta extrair de resources (mesma logica do modal de exibicao)
      const planBranchesRaw = (plan as any).branches?.toString().trim() || '';
      const planResourcesRaw = (plan as any).resources?.toString().trim() || '';
      const sourceRaw = planBranchesRaw || planResourcesRaw;

      // Parser robusto: suporta grupos "Header:" e listas com marcadores
      const isBranchToken = (s: string): boolean => {
        if (!s || s.length > 100 || s.length < 3) return false;
        if (/\*\*/.test(s)) return false;
        if (/\s/.test(s)) return false;
        return /^[\w./\u00C0-\u017F-]+$/.test(s);
      };
      const lines = sourceRaw.split('\n').map(l => l.trim()).filter(Boolean);
      const branchLines: string[] = [];
      for (const line of lines) {
        // Ignora headers de grupo tipo "Backend:"
        if (/^([A-Za-zÀ-ú\s-]+):$/.test(line)) continue;
        // Remove marcadores e divide por delimitadores
        const cleaned = line.replace(/^[*•º]\s*/, '').trim();
        const tokens = cleaned.split(/[\s,;]+/).map(t => t.trim()).filter(Boolean);
        for (const tk of tokens) {
          if (isBranchToken(tk) && !branchLines.includes(tk)) branchLines.push(tk);
        }
      }

      // Extrair sprint label do plano para prefixar nos titulos (ex: Sprint_16_Jun/2025)
      const MONTH_NAMES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      const extractSprintLabel = (): { fallback: string; label: string } => {
        // 1) Titulo do plano: "Sprint 16/06" ou "sprint_16_06"
        const planTitle = plan.title || '';
        if (planTitle.toLowerCase().startsWith('sprint')) {
          return { fallback: planTitle.replace(/\s+/g, '_'), label: planTitle };
        }
        const titleMatch = planTitle.match(/sprint[_-]?(\d{1,2})[_-]?(\d{1,2})(?:[_-]?(\d{4}))?/i);
        if (titleMatch) {
          const dd = titleMatch[1].padStart(2, '0');
          const mm = titleMatch[2].padStart(2, '0');
          const yyyy = titleMatch[3] || new Date().getFullYear().toString();
          const monthName = MONTH_NAMES_PT[parseInt(mm, 10) - 1] || mm;
          return { fallback: `sprint_${dd}_${mm}`, label: `Sprint_${dd}_${monthName}/${yyyy}` };
        }
        // 2) Cronograma: primeira data DD/MM ou DD/MM/YYYY
        const schedule = plan.schedule || plan.description || '';
        const dates = Array.from(schedule.matchAll(/(\d{1,2})[/](\d{1,2})(?:[/](\d{4}))?/g));
        if (dates.length > 0) {
          const dd = (dates[0][1] as string).padStart(2, '0');
          const mm = (dates[0][2] as string).padStart(2, '0');
          const yyyy = (dates[0][3] as string | undefined) || new Date().getFullYear().toString();
          const monthName = MONTH_NAMES_PT[parseInt(mm, 10) - 1] || mm;
          return { fallback: `sprint_${dd}_${mm}`, label: `Sprint_${dd}_${monthName}/${yyyy}` };
        }
        return { fallback: '', label: '' };
      };
      const { fallback: sprintFallback, label: sprintLabel } = extractSprintLabel();

      const documentContent = parts.join('\n\n');

      const branchInstruction = branchLines.length > 0
        ? `
      BRANCHES DA SPRINT (CRÍTICO): Este plano cobre as seguintes branches: ${branchLines.join(', ')}.
      - Para cada branch, analise se há múltiplas funcionalidades, cenários ou testes necessários.
      - Se uma branch tiver várias funcionalidades/testes, crie UM caso para CADA funcionalidade específica (pode haver múltiplos casos por branch).
      - O campo "branch" deve conter APENAS o nome exato da branch (ex: hotfix/fix-editar-lancamento).
      - O campo "title" deve descrever APENAS a funcionalidade testada, SEM incluir o nome da branch no título.
      - Não crie casos genéricos: cada caso deve ser específico para sua funcionalidade/branch.`
        : '';

      const prompt = `
      Analise o seguinte documento e crie casos de teste específicos para cada funcionalidade/branch identificada.${branchInstruction}
 
      DOCUMENTO:
      ${documentContent}
 
      REGRAS DE DETECÇÃO DE MÓDULOS DO SISTEMA (CRÍTICO):
      O sistema é composto por múltiplos módulos, tais como: GO, Clock, Flow, Printer, Keep, e outros que possam ser mencionados no documento.
      - Se uma funcionalidade/alteração diz respeito a múltiplos módulos (ou se refere a "todos os módulos"), você DEVE gerar UM CASO DE TESTE INDIVIDUAL E SEPARADO PARA CADA UM dos módulos correspondentes (ex: crie um caso para [GO], outro para [Clock], outro para [Flow], outro para [Printer] e outro para [Keep]).
      - O título de cada caso gerado DEVE obrigatoriamente iniciar com o prefixo do módulo correspondente entre colchetes. Ex: "[GO] Validar barra de navegação lock", "[Clock] Validar barra de navegação lock", etc.
      - NUNCA agrupe múltiplos módulos em um único caso de teste sob a escrita "[Todos os Módulos]". Crie casos separados para garantir que a funcionalidade seja validada em cada módulo.
      - O campo "module" do JSON de cada caso deve conter exatamente o nome do módulo específico (ex: "GO", "Clock", "Flow", "Printer", "Keep").
      - Se a funcionalidade NÃO especifica módulos distintos, NÃO inclua prefixo de módulo no título.
 
      INSTRUÇÕES IMPORTANTES:
      - Analise o documento e identifique TODAS as funcionalidades, cenários e variações de teste necessárias
      - Uma mesma branch pode ter múltiplos casos se houver diferentes funcionalidades ou cenários de teste
      - O campo "title" deve descrever APENAS a funcionalidade testada, sem mencionar o nome da branch
      - O prefixo de sprint será adicionado automaticamente ao título — não o inclua
      - Cada caso deve ser independente e testável
      - Inclua passos de teste detalhados
      - Se o plano de teste ou escopo referenciar slides específicos para esta funcionalidade (ex: [Slide 15], slides 15-18), as citações de slides na descrição do caso devem ser feitas EXCLUSIVAMENTE através de tags no formato "[Slide X, Y, Z]". Consolide TODAS as referências de slides do caso em uma única tag, posicionada em qualquer local ao decorrer do texto da descrição (não precisa estar no início ou em local fixo). Nunca mencione slides fora do formato de tag, e nunca coloque slides no campo "title".
      - NUNCA use o texto "(Ver mais)" ou "(ver mais)" em nenhuma das respostas. O conteúdo descritivo deve ser limitado ao resumo direto e completo.
 
      Retorne um JSON válido com esta estrutura EXATA:
      {
        "cases": [
          {
            "title": "título específico do caso (sem slides, com [MODULO] se aplicável)",
            "description": "descrição direta com referências de slides no formato [Slide X, Y, Z] se aplicável",
            "preconditions": "pré-condições necessárias",
            "expected_result": "resultado esperado final",
            "priority": "medium",
            "type": "functional",
            "module": "nome do módulo se aplicável, senão string vazia",
            "branch": "nome exato da branch deste caso — copie da lista acima, sem simbolo # ou prefixo",
            "steps": [
              {
                "action": "ação a ser executada",
                "expected_result": "resultado esperado do passo"
              }
            ]
          }
        ]
      }
 
      IMPORTANTE: Gere quantos casos forem necessários baseado na análise do documento. Quando uma funcionalidade afeta múltiplos módulos, você DEVE gerar um caso de teste separado para cada módulo envolvido, incluindo o prefixo correspondente no título. Seja específico e direto.
    `;

      // Seleção de modelo (mesma lógica de fallback do formulário de IA) com override opcional
      const config = ModelControlService.loadConfig();
      const effectiveModelId = (() => {
        if (opts?.modelId && opts.modelId !== 'default') return opts.modelId;
        const mapped = config?.tasks?.['general-completion'];
        if (mapped) return mapped as string;
        if (config?.defaultModel) return config.defaultModel;
        const firstActive = config?.models?.find(m => m.active)?.id;
        return firstActive;
      })();

      const generatedData = await ModelControlService.executeTask(
        'general-completion',
        { prompt },
        effectiveModelId || undefined
      );

      const parsed: any = extractAndParseJSON(generatedData);
      const casesRaw: any = (parsed?.cases || parsed?.test_cases || parsed?.testCases);
      if (!casesRaw || !Array.isArray(casesRaw)) {
        const snippet = typeof generatedData === 'string' ? generatedData.slice(0, 200) : JSON.stringify(parsed).slice(0, 200);
        throw new Error(`Formato de resposta inválido: esperado array "cases". Amostra recebida: ${snippet}...`);
      }

      console.log('[AI Cases] branches do plano:', branchLines);
      console.log('[AI Cases] casos recebidos da IA:', (casesRaw as any[]).map((c: any) => ({ title: c?.title, branch: c?.branch || c?.branches })));

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

      const casesToInsert = (casesRaw as any[]).map((c: any, idx: number) => {
        const stepsArray = Array.isArray(c?.steps) ? c.steps : (
          typeof c?.steps === 'string'
            ? c.steps.split(/\r?\n/).filter(Boolean).map((line: string) => ({ action: line.trim(), expected_result: '' }))
            : []
        );
        // Associa branch com prioridades:
        // 1) IA retornou um token valido
        // 2) Matching por similaridade titulo<->branch (palavras em comum)
        // 3) Round-robin nas branches do plano
        // 4) Fallback sprint_DD_MM do cronograma
        const isValidBranch = (s: string) => !!s && s.length >= 3 && s.length <= 100
          && !/\*\*/.test(s) && !/\s/.test(s) && /^[\w./\u00C0-\u017F-]+$/.test(s);
        const iaBranchRaw = (typeof c?.branch === 'string' && c.branch.trim()) || (typeof c?.branches === 'string' && c.branches.trim()) || '';
        const iaBranch = isValidBranch(iaBranchRaw) ? iaBranchRaw : '';

        // Matching por similaridade: extrai tokens do titulo e compara com tokens da branch
        const matchBranchByTitle = (): string => {
          if (branchLines.length === 0) return '';
          const title = (typeof c?.title === 'string' ? c.title : '').toLowerCase();
          const titleTokens = new Set(
            title.split(/[^\wÀ-ú]+/).filter((t: string) => t.length >= 3).map((t: string) => t.toLowerCase())
          );
          let bestBranch = '';
          let bestScore = 0;
          for (const br of branchLines) {
            const brTokens = br.toLowerCase().split(/[_./-]+/).filter(t => t.length >= 3);
            const score = brTokens.reduce((acc, t) => acc + (titleTokens.has(t) ? 1 : 0), 0);
            if (score > bestScore) { bestScore = score; bestBranch = br; }
          }
          return bestScore > 0 ? bestBranch : '';
        };

        const matchedBranch = matchBranchByTitle();
        const rrBranch = branchLines.length > 0 ? branchLines[idx % branchLines.length] : '';
        const caseBranch = iaBranch || matchedBranch || rrBranch || sprintFallback || '';
        // Prefixar titulo com sprint label (ex: "Sprint_16_Jun/2025 — Validacao de Desconto")
        const rawTitle = sanitizeText(typeof c?.title === 'string' ? c.title : c?.name || `Caso ${idx + 1}`);
        // Remove o nome da branch do titulo se a IA o incluiu por engano
        const titleWithoutBranch = caseBranch
          ? rawTitle.replace(new RegExp(caseBranch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, '').trim()
          : rawTitle;

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

        const referencedSlides = [
          ...extractSlideNumbers(rawTitle),
          ...extractSlideNumbers(typeof c?.description === 'string' ? c.description : '')
        ];

        const cleanedTitle = cleanTitle(titleWithoutBranch || rawTitle);
        const finalTitle = sprintLabel
          ? `${sprintLabel.replace(/^["'“”‘’]+/g, '').replace(/["'“”‘’]+$/g, '').trim()} - ${cleanedTitle}`
          : cleanedTitle;

        const planImages = (plan as any).images || [];
        const caseImages = planImages.filter((img: any) => {
          if (!img.slides || !Array.isArray(img.slides)) return false;
          return img.slides.some((sNum: number) => referencedSlides.includes(sNum));
        });

        return {
          plan_id: plan.id,
          title: finalTitle,
          description: sanitizeText(typeof c?.description === 'string' ? c.description : ''),
          preconditions: sanitizeText(typeof c?.preconditions === 'string' ? c.preconditions : ''),
          expected_result: sanitizeText(typeof c?.expected_result === 'string' ? c.expected_result : ''),
          priority: sanitizeText(typeof c?.priority === 'string' ? c.priority : 'medium'),
          type: sanitizeText(typeof c?.type === 'string' ? c.type : 'functional'),
          branches: sanitizeText(caseBranch),
          steps: stepsArray.map((s: any, i: number) => ({
            id: crypto.randomUUID(),
            action: sanitizeText(s?.action),
            expected_result: sanitizeText(s?.expected_result),
            order: i + 1,
          })),
          user_id: plan.user_id,
          generated_by_ai: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          images: caseImages,
        };
      });

      console.log('[AI Cases] payload enviado ao DB (branches por caso):', casesToInsert.map((c: any) => ({ title: c.title, branches: c.branches })));

      const { data: insertedCases, error } = await apiClient
        .from('test_cases')
        .insert(casesToInsert)
        .select();
      if (error) throw error;

      console.log('[AI Cases] casos persistidos (verificar se coluna branches existe no DB):', (insertedCases || []).map((c: any) => ({ id: c.id, title: c.title, branches: c.branches })));
      if (insertedCases && insertedCases.length > 0 && !('branches' in insertedCases[0])) {
        toast({ title: 'Aviso', description: 'Coluna "branches" não existe em test_cases — reinicie o servidor (npm run dev:all) para aplicar a migration.', variant: 'destructive' });
      }

      // Auto-criar requisito + vínculo para cada caso gerado
      let reqCount = 0;
      if (Array.isArray(insertedCases) && insertedCases.length > 0) {
        const { createRequirement, linkCaseToRequirement } = await import('@/services/apiClientService');
        await Promise.all(insertedCases.map(async (tc: any) => {
          try {
            const newReq = await createRequirement({
              user_id: plan.user_id,
              project_id: (plan as any).project_id,
              title: tc.title,
              description: `Requisito gerado automaticamente a partir do caso: ${tc.title}`,
              priority: (tc.priority || 'medium') as any,
              status: 'open',
            } as any);
            await linkCaseToRequirement(plan.user_id, newReq.id, tc.id);
            reqCount++;
          } catch (err) {
            console.warn('[AI Cases] falha ao criar requisito para caso', tc.id, err);
          }
        }));
      }

      activeToast.update({
        id: activeToast.id,
        title: 'Sucesso',
        description: `${casesToInsert.length} caso(s) e ${reqCount} requisito(s) criados e vinculados ao plano.`,
        duration: 5000,
      } as any);

      // Dispara eventos customizados para atualizar as listagens
      window.dispatchEvent(new CustomEvent('nexus:cases-changed'));
      window.dispatchEvent(new CustomEvent('nexus:plans-changed'));
    } catch (e: unknown) {
      console.error('Erro ao gerar casos:', e);
      const msg = e instanceof Error ? e.message : String(e);
      activeToast.update({
        id: activeToast.id,
        title: 'Erro na geração',
        description: `Falha ao gerar casos de teste. Detalhe: ${msg.slice(0, 100)}`,
        variant: 'destructive',
        duration: 7000,
      } as any);
    } finally {
      setGenerating(false);
    }
  };

  const desc = getItemDescription();
  const isShortDesc = (() => {
    const t = (desc || '').toString().trim();
    if (!t) return false;
    if (t.length >= 80) return false;
    // se houver quebras ou marcadores, trata como texto longo/lista
    if (/\r?\n/.test(t)) return false;
    if (/^[-•\u00BA]|^#\d+\s+/.test(t)) return false;
    return true;
  })();

  // Consolidate all team members (author + assigned + executor + interested), deduplicated
  const allTeamMembers = [
    ...(author ? [{ ...author, _role: 'Autor' }] : []),
    ...(assignedUser && assignedUser.id !== author?.id ? [{ ...assignedUser, _role: 'Atribuído' }] : []),
    ...(executor && executor.id !== author?.id && executor.id !== assignedUser?.id ? [{ ...executor, _role: 'Executor' }] : []),
    ...interestedProfiles.filter(p => p.id !== author?.id && p.id !== assignedUser?.id && p.id !== executor?.id),
  ].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

  return (<>
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col overflow-hidden p-0">
        <DialogTitle className="sr-only">{getTypeLabel()} — {getItemTitle()}</DialogTitle>

        {/* Cabeçalho Fixo */}
        <div className="p-6 pb-3 shrink-0 border-b border-border/40 bg-background">
          <div className="pr-8 flex flex-col md:flex-row md:items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-foreground leading-tight flex items-center gap-3">
                <span 
                  className="text-brand/80 font-mono text-base bg-brand/10 hover:bg-brand/20 cursor-pointer px-2 py-0.5 rounded border border-brand/20 transition-colors whitespace-nowrap"
                  title="Copiar ID e Título"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(getItemTitle());
                      toast({ title: 'Copiado', description: getItemTitle() });
                    } catch {
                      toast({ title: 'Erro', description: 'Não foi possível copiar', variant: 'destructive' });
                    }
                  }}
                >
                  {getItemSequenceBadgeLabel() || `#${item.id.slice(0, 8)}`}
                </span>
                {type === 'execution' ? ((item as TestExecution).notes || 'Execução sem notas') : (item as any).title}
              </h2>
              {type === 'execution' && defectCount > 0 && (
                <Badge
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 shrink-0 cursor-pointer h-7"
                  title={`${defectCount} defeito(s) aberto(s) vinculado(s) à execução`}
                >
                  <BugIcon className="h-3.5 w-3.5 mr-1" />
                  {defectCount}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3 bg-muted/20 p-2 px-3 rounded-xl border border-border/40 backdrop-blur-sm">
            <div className="flex items-center gap-2 flex-wrap">
              {('status' in item && item.status) && (
                <Badge className={
                  type === 'execution' ? executionStatusBadgeClass(item.status as ExecutionStatus)
                  : type === 'requirement' ? requirementStatusBadgeClass(item.status as any)
                  : type === 'defect' ? defectStatusBadgeClass(item.status as any)
                  : planStatusClasses(item.status as string)
                }>
                  {type === 'execution' ? executionStatusLabel(item.status as ExecutionStatus)
                  : type === 'requirement' ? requirementStatusLabel(item.status as any)
                  : type === 'defect' ? defectStatusLabel(item.status as any)
                  : translateStatus(item.status as string)}
                </Badge>
              )}
              {('priority' in item && (item as any).priority) && (
                <Badge className={priorityBadgeClass((item as any).priority)} variant="secondary">
                  {priorityLabel((item as any).priority)}
                </Badge>
              )}
            </div>

            {allTeamMembers.length > 0 && (
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest hidden sm:inline">
                  Equipe
                </span>
                <TeamAvatars
                  users={allTeamMembers}
                  maxDisplay={2}
                  onUserClick={(uid) => {
                    if (author?.id === uid) setShowAuthorModal(true);
                    else if (assignedUser?.id === uid) setShowAssignedModal(true);
                    else if (executor?.id === uid) setShowExecutorModal(true);
                    else setShowAssignedModal(true);
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Conteúdo Rolável */}
        <div className="relative flex-1 flex flex-col border-b border-border/10 min-h-0" style={{maxHeight:'55vh'}}>
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="overflow-y-auto flex-1 p-6 py-4 space-y-4"
          style={{overflowY:'auto'}}
        >
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-brand/70" />
            <span className="opacity-70">{type === 'execution' ? 'Executado em:' : 'Criado em:'}</span>
            <span className="text-foreground font-medium">{formatDate(getItemDate())}</span>
          </div>

          <hr className="border-border/60" />

          <div className="py-1 space-y-4">

          {/* Descrição */}
          {desc && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1.5">Descrição</h3>
              {renderListOrParagraph(desc)}
            </div>
          )}

          {type === 'plan' && (() => {
            const obj       = (item as any).objective?.toString().trim();
            const scope     = (item as any).scope?.toString().trim();
            const approach  = (item as any).approach?.toString().trim();
            const criteria  = (item as any).criteria?.toString().trim();
            const resources = (item as any).resources?.toString().trim();
            const schedule  = (item as any).schedule?.toString().trim();
            const risks     = (item as any).risks?.toString().trim();
            const branchesRaw = ((item as any).branches?.toString().trim()) || '';

            // Testa se um token isolado parece nome de branch real
            const isBranchName = (s: string): boolean => {
              if (!s || s.length > 100 || s.length < 3) return false;
              if (/\*\*/.test(s)) return false; // markdown bold
              if (/\s/.test(s)) return false;   // sem espacos — sempre token unico
              // snake_case, kebab-case, slash, pontos, acentos
              return /^[\w./\u00C0-\u017F-]+$/.test(s);
            };

            const parseBranchGroups = (raw: string): { group: string; items: string[] }[] => {
              if (!raw) return [];
              const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
              const groups: { group: string; items: string[] }[] = [];
              let current: { group: string; items: string[] } | null = null;
              const groupHeaderRex = /^([A-Za-zÀ-ú\s-]+):$/;
              for (const line of lines) {
                if (groupHeaderRex.test(line) && !line.startsWith('*') && !line.startsWith('-')) {
                  current = { group: line.replace(/:$/, '').trim(), items: [] };
                  groups.push(current);
                  continue;
                }
                // Remove marcadores de lista e divide por espaco/virgula/ponto-e-virgula
                const cleaned = line.replace(/^[*•º]\s*/, '').trim();
                const tokens = cleaned.split(/[\s,;]+/).map(t => t.trim()).filter(Boolean);
                for (const tk of tokens) {
                  if (isBranchName(tk)) {
                    if (!current) { current = { group: 'Geral', items: [] }; groups.push(current); }
                    if (!current.items.includes(tk)) current.items.push(tk);
                  }
                }
              }
              return groups.filter(g => g.items.length > 0);
            };

            const branchGroups = parseBranchGroups(branchesRaw);
            const legacyBranchGroups = branchGroups.length === 0 && resources ? parseBranchGroups(resources) : [];
            const allBranchGroups = branchGroups.length > 0 ? branchGroups : legacyBranchGroups;
            const totalBranches = allBranchGroups.reduce((acc, g) => acc + g.items.length, 0);

            if (!obj && !scope && !approach && !criteria && !schedule && !risks && allBranchGroups.length === 0) return null;

            // Ordenar campos por tamanho (curtos primeiro) para masonry natural
            const gridItems: { label: string; content: string }[] = [
              obj      ? { label: 'Objetivo',   content: obj }      : null,
              approach ? { label: 'Abordagem',  content: approach } : null,
              schedule ? { label: 'Cronograma', content: schedule } : null,
              scope    ? { label: 'Escopo',     content: scope }    : null,
              criteria ? { label: 'Critérios',  content: criteria } : null,
              risks    ? { label: 'Riscos',     content: risks }    : null,
            ].filter(Boolean) as { label: string; content: string }[];

            return (
              <>
                {gridItems.length > 0 && (
                  <div className="space-y-4 bg-muted/10 border border-border/40 p-4 rounded-xl">
                    {gridItems.map((field, idx) => (
                      <div key={field.label} className={cn(
                        "pb-3.5",
                        idx < gridItems.length - 1 ? "border-b border-border/20" : ""
                      )}>
                        <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ backgroundColor: currentProject?.color || 'var(--brand)' }} />
                          {field.label}
                        </h3>
                        <div className="text-sm text-foreground/90 pl-3">
                          {renderListOrParagraph(field.content)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {allBranchGroups.length > 0 && (
                  <Collapsible defaultOpen={false} className="rounded-lg border border-border/50 bg-muted/20 p-3.5 group mt-4">
                    <CollapsibleTrigger className="flex w-full items-center justify-between hover:opacity-80 transition-opacity" aria-label={`Branches de Entrega — ${totalBranches} branch${totalBranches !== 1 ? 'es' : ''}`}>
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: currentProject?.color || 'var(--brand)' }} />
                        Branches de Entrega
                        <span className="ml-2 text-xs font-normal text-muted-foreground">{totalBranches} branch{totalBranches !== 1 ? 'es' : ''}</span>
                      </h3>
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3 space-y-2.5">
                      {allBranchGroups.map((group, gi) => (
                        <div key={gi}>
                          {allBranchGroups.length > 1 && (
                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">{group.group}</p>
                          )}
                          <div className="flex flex-wrap gap-1.5">
                            {group.items.map((b, bi) => (
                              <button
                                key={bi}
                                type="button"
                                aria-label={`Copiar branch ${b}`}
                                style={{
                                  backgroundColor: currentProject?.color ? `${currentProject.color}15` : undefined,
                                  color: currentProject?.color || undefined,
                                  borderColor: currentProject?.color ? `${currentProject.color}33` : undefined,
                                }}
                                className="inline-flex items-center gap-1 rounded-md bg-brand/10 border border-brand/20 hover:bg-brand/20 active:scale-95 transition px-2 py-0.5 text-xs font-mono text-brand cursor-copy"
                                title={`Copiar ${b}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  try {
                                    navigator.clipboard.writeText(b);
                                    toast({ title: 'Branch copiada', description: b });
                                  } catch { /* ignore error */ }
                                }}
                              >
                                <span className="opacity-60">#</span>{b}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </>
            );
          })()}

          {type === 'case' && 'steps' in item && (() => {
            const rawBranches = (item as any).branches?.toString().trim() || '';
            const isValidBranchToken = (s: string) => !!s && s.length >= 3 && s.length <= 100
              && !/\*\*/.test(s) && /^[\w-/.À-ú]+$/.test(s);
            const branchTokens = rawBranches.split(/[\s,;]+/).map((b: string) => b.trim()).filter(isValidBranchToken);
            return (
            <div className="space-y-4">
              {item.preconditions && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-1.5">Pré-condições</h3>
                  {renderListOrParagraph(item.preconditions)}
                </div>
              )}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Passos</h3>
                <div className="space-y-2">
                  {item.steps?.map((step: any, index: number) => (
                    <div key={index} className="rounded-lg border border-border bg-muted/30 p-3">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                        Passo {step.order || index + 1}
                      </div>
                      <div className="text-sm"><span className="font-medium">Ação: </span><span className="text-muted-foreground">{step.action}</span></div>
                      <div className="text-sm mt-0.5"><span className="font-medium">Resultado esperado: </span><span className="text-muted-foreground">{step.expected_result}</span></div>
                    </div>
                  ))}
                </div>
              </div>
              {item.expected_result && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-1.5">Resultado Final Esperado</h3>
                  {renderListOrParagraph(item.expected_result)}
                </div>
              )}
              {branchTokens.length > 0 && (
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3.5">
                  <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: currentProject?.color || 'var(--brand)' }} />
                    Branch
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {branchTokens.map((b: string, i: number) => (
                      <button
                        key={i}
                        type="button"
                        aria-label={`Copiar branch ${b}`}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(b);
                            toast({ title: 'Branch copiada', description: b });
                          } catch {
                            toast({ title: 'Falha ao copiar', description: b, variant: 'destructive' });
                          }
                        }}
                        title={`Copiar ${b}`}
                        style={{
                          backgroundColor: currentProject?.color ? `${currentProject.color}15` : undefined,
                          color: currentProject?.color || undefined,
                          borderColor: currentProject?.color ? `${currentProject.color}33` : undefined,
                        }}
                        className="inline-flex items-center gap-1 rounded-md bg-brand/10 border border-brand/20 hover:bg-brand/20 active:scale-95 transition px-2 py-0.5 text-xs font-mono text-brand cursor-pointer"
                      >
                        <span className="opacity-60">#</span>{b}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            );
          })()}

          {type === 'execution' && 'actual_result' in item && (
            <div className="space-y-4">
              {item.actual_result && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-1.5">Resultado Obtido</h3>
                  {renderListOrParagraph(item.actual_result)}
                </div>
              )}
            </div>
          )}



          {/* Vínculos para requisito — casos vinculados */}
          {type === 'requirement' && linkedCases.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Casos Vinculados</h3>
              <div className="flex flex-wrap gap-1.5">
                {linkedCases.map(c => (
                  <Link
                    key={c.id}
                    to={`/cases?id=${c.id}`}
                    className="text-xs bg-brand/10 text-brand px-2 py-0.5 rounded font-mono hover:bg-brand/20 transition-colors"
                    onClick={handleClose}
                  >
                    {c.sequence != null ? `CT-${String(c.sequence).padStart(3, '0')}` : c.title}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Vínculos */}
          {(type === 'case' || type === 'execution') &&
            (('plan_id' in item && (item as any).plan_id) ||
            (type === 'execution' && 'case_id' in item && (item as any).case_id) ||
            (type === 'case' && linkedReqs.length > 0)) && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Vínculos</h3>
              <div className="space-y-1.5">
                {'plan_id' in item && (item as any).plan_id && (
                  <div className="flex items-center gap-2 text-sm">
                    <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium text-foreground">Plano de Teste:</span>{' '}
                    <Link to={`/plans?id=${(item as any).plan_id}`} className="text-brand hover:underline" onClick={handleClose}>
                      {linkedPlan
                        ? (linkedPlan.sequence != null ? `PT-${String(linkedPlan.sequence).padStart(3, '0')} — ${linkedPlan.title || ''}` : linkedPlan.title || (item as any).plan_id)
                        : (item as any).plan_id}
                    </Link>
                  </div>
                )}
                {type === 'case' && linkedReqs.length > 0 && (
                  <div className="flex items-start gap-2 text-sm">
                    <Link2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium text-foreground">Requisitos vinculados:</span>{' '}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {linkedReqs.map(r => (
                          <Link
                            key={r.id}
                            to={`/management?tab=requirements&id=${r.id}&modal=req:view`}
                            className="text-xs bg-brand/10 text-brand px-2 py-0.5 rounded font-mono hover:bg-brand/20 transition-colors"
                            onClick={handleClose}
                          >
                            {r.sequence != null ? `REQ-${String(r.sequence).padStart(3, '0')}` : r.title}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {type === 'execution' && 'case_id' in item && (item as any).case_id && (
                  <div className="flex items-center gap-2 text-sm">
                    <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium text-foreground">Caso de Teste:</span>{' '}
                    <Link to={`/cases?id=${(item as any).case_id}`} className="text-brand hover:underline" onClick={handleClose}>
                      {linkedCase
                        ? (linkedCase.sequence != null ? `CT-${String(linkedCase.sequence).padStart(3, '0')} — ${linkedCase.title || ''}` : linkedCase.title || (item as any).case_id)
                        : (item as any).case_id}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
        </div>
        {/* Scroll indicator — aparece sutil no canto direito após o usuário rolar */}
        <div
          className={`absolute bottom-3 right-4 z-20 pointer-events-none transition-all duration-300 ${
            hasMoreScroll && hasScrolled ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
          }`}
        >
          <button
            type="button"
            onClick={scrollToBottom}
            className="pointer-events-auto flex items-center gap-1 px-2.5 py-1 rounded-full bg-background/80 backdrop-blur-sm text-muted-foreground shadow border border-border/40 hover:text-foreground hover:border-border active:scale-95 transition-all cursor-pointer text-[11px] font-medium"
            title="Ir até o final do conteúdo"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            Ir até o final
          </button>
        </div>
        </div>{/* end relative scroll wrapper */}

        {/* Rodapé Fixo */}
        <div className="p-6 pt-3 shrink-0 border-t border-border bg-background">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ExportDropdown item={item} type={type} />
              {(() => {
                const imgCount = (item.images && Array.isArray(item.images)) ? item.images.length : 0;
                return (
                  <button
                    type="button"
                    disabled={imgCount === 0}
                    onClick={() => setCarouselOpen(true)}
                    title={imgCount > 0 ? `Ver ${imgCount} imagem${imgCount !== 1 ? 's' : ''} de referência` : 'Nenhuma imagem disponível'}
                    className={`relative h-8 w-8 flex items-center justify-center rounded-md border transition-all ${
                      imgCount > 0
                        ? 'border-brand/25 bg-brand/5 hover:bg-brand/15 hover:border-brand/50 cursor-pointer'
                        : 'border-border/40 bg-background/50 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    {/* Gradient icon */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                    >
                      <defs>
                        <linearGradient id="img-btn-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor={imgCount > 0 ? '#6366f1' : '#94a3b8'} />
                          <stop offset="100%" stopColor={imgCount > 0 ? '#ec4899' : '#94a3b8'} />
                        </linearGradient>
                      </defs>
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="url(#img-btn-grad)" />
                      <circle cx="8.5" cy="8.5" r="1.5" stroke="url(#img-btn-grad)" />
                      <polyline points="21 15 16 10 5 21" stroke="url(#img-btn-grad)" />
                    </svg>
                    {/* Badge de contagem */}
                    {imgCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full text-[9px] font-bold bg-gradient-to-br from-indigo-500 to-pink-500 text-white shadow-sm border border-background leading-none">
                        {imgCount > 99 ? '99+' : imgCount}
                      </span>
                    )}
                  </button>
                );
              })()}
            </div>
            <div className="flex gap-2">
              {type === 'plan' && ('generated_by_ai' in item && Boolean(item.generated_by_ai)) && (
                <Button onClick={openGenerateDialog} disabled={generating || isProjectInactive} title={isProjectInactive ? 'Projeto não ativo — geração desabilitada' : undefined}>
                  {generating ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-1" />Gerar Casos</>
                  )}
                </Button>
              )}
              {onEdit && (
                <Button variant="outline" onClick={() => onEdit(item)} disabled={isProjectInactive} title={isProjectInactive ? 'Projeto não ativo — edição desabilitada' : undefined}>
                  <Edit className="h-4 w-4 mr-1" />
                  Editar
                </Button>
              )}
              {onDelete && (
                <Button
                  variant={confirmDelete ? "destructive" : "outline"}
                  onClick={handleDelete}
                  disabled={isProjectInactive}
                  title={isProjectInactive ? 'Projeto não ativo — exclusão desabilitada' : undefined}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {confirmDelete ? 'Confirmar Exclusão' : 'Excluir'}
                </Button>
              )}
            </div>
          </div>
        </div>
          </DialogContent>
    </Dialog>

    {/* Modal de Carrossel de Imagens */}
    {item.images && item.images.length > 0 && (
      <Dialog open={carouselOpen} onOpenChange={setCarouselOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background">
          <DialogHeader className="p-6 pb-2 border-b border-border/40 shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-brand" />
                Imagens de Referência ({item.images.length})
              </DialogTitle>
              {/* Tooltip de expiração */}
              {(type === 'plan' || type === 'case') && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-1 text-[11px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 cursor-help font-medium">
                        <Info className="h-3 w-3" />
                        Expira em 30 dias
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs p-2.5">
                      Imagens anexadas sumirão depois de 1 mês sendo necessário consultar os docs enviados por e-mail das apresentações.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Visualização de mídias anexadas ao {getTypeLabel().toLowerCase()}.
            </DialogDescription>
          </DialogHeader>

          {/* Conteúdo Central */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-black/5 dark:bg-black/40 overflow-hidden relative min-h-[400px]">
            {/* Imagem Atual */}
            <div className="relative max-w-full max-h-[50vh] flex items-center justify-center cursor-zoom-in group" onClick={() => setZoomOpen(true)}>
              <img
                src={item.images[currentImageIndex]?.dataUrl}
                alt={item.images[currentImageIndex]?.name || `Imagem ${currentImageIndex + 1}`}
                className="max-w-full max-h-[50vh] object-contain rounded-md shadow-md border border-border/40 transition-transform duration-200 hover:scale-[1.01]"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-md">
                <span className="text-xs text-white font-medium bg-black/60 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                  Clique para Expandir
                </span>
              </div>
            </div>

            {/* Controles de Navegação (Prev / Next) */}
            {item.images.length > 1 && (
              <>
                <button
                  onClick={() => setCurrentImageIndex(prev => (prev === 0 ? item.images!.length - 1 : prev - 1))}
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 hover:bg-background border border-border flex items-center justify-center shadow transition-all hover:scale-105 active:scale-95 text-muted-foreground hover:text-foreground"
                  title="Anterior"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setCurrentImageIndex(prev => (prev === item.images!.length - 1 ? 0 : prev + 1))}
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 hover:bg-background border border-border flex items-center justify-center shadow transition-all hover:scale-105 active:scale-95 text-muted-foreground hover:text-foreground"
                  title="Próximo"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>

          {/* Informações da Imagem e Download */}
          <div className="p-4 bg-muted/20 border-t border-border/40 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground flex flex-col gap-1 text-center sm:text-left">
              <span className="font-semibold text-foreground truncate max-w-sm">
                {item.images[currentImageIndex]?.name || `Imagem ${currentImageIndex + 1}`}
              </span>
              {item.images[currentImageIndex]?.slides && item.images[currentImageIndex]?.slides!.length > 0 && (
                <span className="text-[11px] text-brand font-medium">
                  Referência: Slide {item.images[currentImageIndex]?.slides?.join(', ')}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = item.images![currentImageIndex].dataUrl;
                  link.download = item.images![currentImageIndex].name || `imagem_${currentImageIndex + 1}.png`;
                  link.click();
                }}
                className="h-8 text-xs font-semibold gap-1"
              >
                <Download className="h-3.5 w-3.5" />
                Baixar Imagem
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCarouselOpen(false)}
                className="h-8 text-xs font-semibold"
              >
                Fechar
              </Button>
            </div>
          </div>

          {/* Thumbnails list */}
          {item.images.length > 1 && (
            <div className="px-6 py-3 border-t border-border/20 shrink-0 bg-muted/5 flex gap-2 overflow-x-auto max-w-full">
              {item.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={cn(
                    "h-12 w-16 relative rounded border overflow-hidden transition-all duration-200 shrink-0",
                    currentImageIndex === idx ? "border-brand ring-2 ring-brand/20 opacity-100 scale-105" : "border-border/60 opacity-60 hover:opacity-100"
                  )}
                >
                  <img src={img.dataUrl} alt="" className="h-full w-full object-cover" />
                  {img.slides && img.slides.length > 0 && (
                    <span className="absolute bottom-0 right-0 bg-brand text-white text-[8px] font-bold px-1 rounded-tl">
                      S{img.slides[0]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    )}

    {/* Modal Zoom de Imagem Expandido */}
    {item.images && item.images.length > 0 && zoomOpen && (
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden bg-black/95 border-none flex items-center justify-center">
          <button 
            className="absolute right-4 top-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors z-50 text-xs font-semibold"
            onClick={() => setZoomOpen(false)}
          >
            Fechar Zoom [x]
          </button>
          <div className="w-full h-full flex items-center justify-center p-4">
            <img
              src={item.images[currentImageIndex]?.dataUrl}
              alt={item.images[currentImageIndex]?.name || ""}
              className="max-w-full max-h-[90vh] object-contain rounded-md shadow-2xl"
            />
          </div>
        </DialogContent>
      </Dialog>
    )}

    <UserProfileModal
      isOpen={showAuthorModal}
      onClose={() => setShowAuthorModal(false)}
      userId={author?.id || (item as any).user_id}
      initialProfile={author || undefined}
    />

    <UserProfileModal
      isOpen={showAssignedModal}
      onClose={() => setShowAssignedModal(false)}
      userId={assignedUser?.id || (item as any).assigned_to}
      initialProfile={assignedUser || undefined}
    />

    <UserProfileModal
      isOpen={showExecutorModal}
      onClose={() => setShowExecutorModal(false)}
      userId={executor?.id || (item as any).executed_by}
      initialProfile={executor || undefined}
    />

    <AlertDialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Gerar casos com IA?</AlertDialogTitle>
          <AlertDialogDescription>
            Confirme a geração de casos para este plano. Você pode adicionar um contexto extra e, opcionalmente, escolher um modelo de IA diferente.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 text-left">
          {/* Seleção de modelo */}
          {(() => {
            const cfg = ModelControlService.loadConfig();
            const activeModels = cfg?.models?.filter(m => m.active) || [];
            const defaultGeneral = cfg?.tasks?.['general-completion'];
            const defaultModel = activeModels.find(m => m.id === defaultGeneral)
              || activeModels.find(m => m.id === cfg?.defaultModel)
              || activeModels[0];
            return (
              <div className="space-y-2">
                <Label htmlFor="model-select">Modelo (opcional)</Label>
                <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                  <SelectTrigger id="model-select">
                    <SelectValue placeholder="Selecionar modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Padrão do Painel{defaultModel ? ` — ${defaultModel.name || defaultModel.id}` : ''}</SelectItem>
                    {activeModels.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name || m.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })()}

          {/* Contexto adicional */}
          <div className="space-y-2">
            <Label htmlFor="extra-context">Contexto adicional (opcional)</Label>
            <Textarea
              id="extra-context"
              placeholder="Ex.: focar nos relatórios de peças, validar permissões específicas, etc."
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              className="min-h-[120px]"
            />
          </div>
        </div>

        <AlertDialogFooter className="pt-4">
          <AlertDialogCancel disabled={generating}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={confirmAndGenerate} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>Confirmar e Gerar</>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>);
};
