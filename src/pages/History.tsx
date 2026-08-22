import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { usePaginationUrlSync } from '@/hooks/usePaginationUrlSync';
import { useVirtualTableHeight } from '@/hooks/useVirtualTableHeight';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Clock, RefreshCcw, Filter, FileText, ClipboardCheck, Play, Bug, Link2, Activity, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getActivityLogs, type ActivityLog } from '@/services/apiClientService';
import { toast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api';
import { VirtualList } from '@/experimental/VirtualList';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { StandardButton } from '@/components/StandardButton';
import { UserAvatar } from '@/components/ui/UserAvatar';

interface HistoryItem {
  id: string;
  type: 'plan' | 'case' | 'execution' | 'defect' | 'requirement' | 'other';
  action: string;
  description?: string;
  updated_at: Date;
  data: { user_id: string };
  meta?: { entity?: string; id?: string } | Record<string, unknown>;
}

export const History = () => {
  const { initFromSearchParams, writeFromState } = usePaginationUrlSync();
  const { user } = useAuth();
  const navigate = useNavigate();
  const E2E_MOCK = String((import.meta as { env?: Record<string, string> })?.env?.VITE_E2E_MOCK_HISTORY ?? 'false') === 'true';
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const topBlockRef = useRef<HTMLDivElement | null>(null);
  const listCardRef = useRef<HTMLDivElement | null>(null);
  const listHeaderRef = useRef<HTMLDivElement | null>(null);
  const paginationRef = useRef<HTMLDivElement | null>(null);
  const [rowSize, setRowSize] = useState<number>(72);
  const [profilesMap, setProfilesMap] = useState<Record<string, { display_name: string | null; avatar_url?: string | null }>>({});

  // Filtros
  const [q, setQ] = useState('');
  const [daysFilter, setDaysFilter] = useState<number>(90);
  const [typeFilter, setTypeFilter] = useState<'all' | 'plan' | 'case' | 'execution' | 'defect' | 'requirement'>('all');
  const [applied, setApplied] = useState<{ q: string; days: number; type: 'all' | 'plan' | 'case' | 'execution' | 'defect' | 'requirement' }>({ q: '', days: 90, type: 'all' });
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<HistoryItem | null>(null);

  // Paginação
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);

  const deriveTypeFromAction = (action: string): HistoryItem['type'] => {
    const a = action.toLowerCase();
    if (a.includes('execução')) return 'execution';
    if (a.includes('plano')) return 'plan';
    if (a.includes('caso')) return 'case';
    if (a.includes('defeito') || a.includes('bug')) return 'defect';
    if (a.includes('requisito')) return 'requirement';
    return 'other';
  };

  const openLinkedModal = (item: HistoryItem) => {
    const entity = (item.meta?.entity as string | undefined) || item.type;
    const id = (item.meta?.id as string | undefined);
    if (id) {
      if (entity === 'plan') {
        navigate({ pathname: '/plans', search: `?id=${encodeURIComponent(id)}&modal=plan:view` });
        return;
      }
      if (entity === 'case') {
        navigate({ pathname: '/cases', search: `?id=${encodeURIComponent(id)}&modal=case:view` });
        return;
      }
      if (entity === 'execution') {
        navigate({ pathname: '/executions', search: `?id=${encodeURIComponent(id)}&modal=exec:view` });
        return;
      }
      if (entity === 'requirement') {
        navigate(`/management?tab=requirements&id=${encodeURIComponent(id)}&modal=req:view`);
        return;
      }
      if (entity === 'defect') {
        navigate(`/management?tab=defects&id=${encodeURIComponent(id)}&modal=defect:view`);
        return;
      }
    }
    setSelected(item);
    setOpen(true);
  };

  const loadHistoryData = useCallback(async (range?: { start?: Date; end?: Date }) => {
    try {
      if (E2E_MOCK) {
        const now = new Date();
        const mock: HistoryItem[] = [
          { id: '1', type: 'plan', action: 'Criou plano de teste', description: 'Plano de teste de regressão v1.0', updated_at: new Date(now.getTime() - 1000 * 60 * 30), data: { user_id: 'mock-user-1' } },
          { id: '2', type: 'case', action: 'Atualizou caso de teste', description: 'CT-001 — Validação de Login com MFA', updated_at: new Date(now.getTime() - 1000 * 60 * 90), data: { user_id: 'mock-user-2' } },
          { id: '3', type: 'execution', action: 'Registrou execução', description: 'EXE-001 — Aprovado sem ressalvas', updated_at: new Date(now.getTime() - 1000 * 60 * 180), data: { user_id: 'mock-user-1' } },
          { id: '4', type: 'defect', action: 'Abriu defeito', description: 'DEF-001 — Falha no carregamento de tokens', updated_at: new Date(now.getTime() - 1000 * 60 * 360), data: { user_id: 'mock-user-3' } },
          { id: '5', type: 'requirement', action: 'Cadastrou requisito', description: 'REQ-001 — Autenticação de dois fatores', updated_at: new Date(now.getTime() - 1000 * 60 * 720), data: { user_id: 'mock-user-1' } },
        ];
        setItems(mock);
        setProfilesMap({
          'mock-user-1': { display_name: 'Paulo Ricardo', avatar_url: null },
          'mock-user-2': { display_name: 'Carlos Oliveira', avatar_url: null },
          'mock-user-3': { display_name: 'Ana Souza', avatar_url: null },
        });
        setLoading(false);
        return;
      }

      setLoading(true);
      const logs = await getActivityLogs(100, undefined, range);
      const userIds = Array.from(new Set((logs || []).map((l: ActivityLog) => l.user_id).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: profs } = await apiClient.from('profiles').select('id, display_name, avatar_url').in('id', userIds);
        const map: Record<string, { display_name: string | null; avatar_url?: string | null }> = {};
        (profs || []).forEach((p: any) => { map[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url }; });
        setProfilesMap(map);
      }

      const mapped: HistoryItem[] = (logs || []).map((l: ActivityLog) => ({
        id: l.id,
        type: deriveTypeFromAction(l.action),
        action: l.action,
        description: l.details || '',
        updated_at: new Date(l.created_at),
        data: { user_id: l.user_id },
        meta: l.metadata as Record<string, unknown>,
      }));
      setItems(mapped);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o histórico de atividades.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [user, E2E_MOCK]);

  useEffect(() => {
    loadHistoryData();
  }, [loadHistoryData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qParam = params.get('q') || '';
    const daysParam = parseInt(params.get('days') || '90', 10);
    const typeParam = (params.get('type') as any) || 'all';
    setQ(qParam);
    setDaysFilter(isNaN(daysParam) ? 90 : Math.min(90, daysParam));
    setTypeFilter(typeParam);
    setApplied({ q: qParam, days: isNaN(daysParam) ? 90 : Math.min(90, daysParam), type: typeParam });
    const pageParam = parseInt(params.get('page') || '1', 10);
    if (!isNaN(pageParam)) setPage(pageParam);
  }, []);

  const filteredItems = useMemo(() => {
    const f = applied;
    let list = items;
    if (f.type !== 'all') list = list.filter(it => it.type === f.type);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - f.days);
    list = list.filter(it => it.updated_at >= cutoffDate);
    const term = (f.q || '').trim().toLowerCase();
    if (term) {
      list = list.filter(it => {
        const prof = profilesMap[it.data.user_id];
        const userName = (prof?.display_name || '').toLowerCase();
        const typeLabel = getTypeLabel(it.type).toLowerCase();
        const action = (it.action || '').toLowerCase();
        const desc = (it.description || '').toLowerCase();
        return userName.includes(term) || typeLabel.includes(term) || action.includes(term) || desc.includes(term);
      });
    }
    return list;
  }, [items, applied, profilesMap]);

  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const limitedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const { listHeight } = useVirtualTableHeight({
    containerRef,
    listHeaderRef,
    listCardRef,
    paginationRef,
    rowSize,
    pageSize,
    totalItems,
    currentPage,
    minHeight: 240,
  });

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'plan':
        return <Badge variant="outline" className="bg-brand/10 text-brand border-brand/20 text-xs font-semibold py-0.5"><FileText className="h-3 w-3 mr-1" /> Plano</Badge>;
      case 'case':
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-xs font-semibold py-0.5"><ClipboardCheck className="h-3 w-3 mr-1" /> Caso</Badge>;
      case 'execution':
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs font-semibold py-0.5"><Play className="h-3 w-3 mr-1" /> Execução</Badge>;
      case 'defect':
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs font-semibold py-0.5"><Bug className="h-3 w-3 mr-1" /> Defeito</Badge>;
      case 'requirement':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs font-semibold py-0.5"><Link2 className="h-3 w-3 mr-1" /> Requisito</Badge>;
      default:
        return <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-xs font-semibold py-0.5"><Activity className="h-3 w-3 mr-1" /> Ação</Badge>;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'plan': return 'Plano de Teste';
      case 'case': return 'Caso de Teste';
      case 'execution': return 'Execução';
      case 'defect': return 'Defeito';
      case 'requirement': return 'Requisito';
      default: return 'Geral';
    }
  };

  const applyFilters = () => {
    const nextApplied = { q, days: Math.min(90, daysFilter), type: typeFilter as 'all'|'plan'|'case'|'execution'|'defect'|'requirement' };
    setApplied(nextApplied);
    const start = new Date();
    start.setDate(start.getDate() - nextApplied.days);
    const end = new Date();
    loadHistoryData({ start, end });
    setPage(1);
    const params = new URLSearchParams();
    if (nextApplied.q) params.set('q', nextApplied.q);
    params.set('days', String(nextApplied.days));
    params.set('type', nextApplied.type);
    params.set('page', '1');
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  };

  return (
    <div ref={containerRef} className="flex-1 p-6 flex flex-col gap-6 min-h-0 overflow-hidden animate-slide-up" data-testid="history-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Clock className="h-6 w-6 text-brand" />
            Histórico e Auditoria de Atividades
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Rastreamento completo de eventos, criações, edições e execuções realizadas no sistema.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => loadHistoryData()} className="h-9 gap-1.5 text-xs border-border/70 self-start sm:self-auto">
          <RefreshCcw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {/* Filtros */}
      <div ref={topBlockRef} className="border border-border/70 rounded-xl p-3.5 bg-card/60 backdrop-blur-sm shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2.5 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Pesquisar por usuário, ação ou detalhe..."
              className="pl-8 h-9 text-xs bg-muted/20 border-border/60"
            />
          </div>

          <Select value={String(daysFilter)} onValueChange={(v) => setDaysFilter(parseInt(v, 10))}>
            <SelectTrigger className="h-9 w-full sm:w-[140px] text-xs bg-muted/20 border-border/60">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">Últimos 5 dias</SelectItem>
              <SelectItem value="10">Últimos 10 dias</SelectItem>
              <SelectItem value="25">Últimos 25 dias</SelectItem>
              <SelectItem value="50">Últimos 50 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
            <SelectTrigger className="h-9 w-full sm:w-[160px] text-xs bg-muted/20 border-border/60">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Tipos</SelectItem>
              <SelectItem value="plan">Planos de Teste</SelectItem>
              <SelectItem value="case">Casos de Teste</SelectItem>
              <SelectItem value="execution">Execuções</SelectItem>
              <SelectItem value="defect">Defeitos</SelectItem>
              <SelectItem value="requirement">Requisitos</SelectItem>
            </SelectContent>
          </Select>

          <StandardButton variant="brand" onClick={applyFilters} className="h-9 px-3">
            <Filter className="h-3.5 w-3.5 mr-1.5" /> Filtrar
          </StandardButton>
        </div>
      </div>

      {/* Lista em tabela */}
      {filteredItems.length > 0 ? (
        <div ref={listCardRef} className="border border-border/70 rounded-xl overflow-hidden bg-card/60 backdrop-blur-sm shadow-xs flex-1 flex flex-col min-h-0" data-testid="history-list">
          <div ref={listHeaderRef} className="grid grid-cols-[1.2fr_1fr_2fr_1fr] items-center gap-4 px-4 py-3 bg-muted/40 border-b border-border/70 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <div>Usuário</div>
            <div>Entidade / Tipo</div>
            <div>Detalhes da Atividade</div>
            <div className="text-right">Data & Hora</div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border/50">
            {limitedItems.map((item) => {
              const prof = profilesMap[item.data.user_id];
              return (
                <div
                  key={`${item.type}-${item.id}`}
                  className="grid grid-cols-[1.2fr_1fr_2fr_1fr] items-center gap-4 px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => openLinkedModal(item)}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <UserAvatar userId={item.data.user_id} className="h-7 w-7 shrink-0" />
                    <div className="truncate font-semibold text-xs text-foreground">
                      {prof?.display_name || 'Usuário'}
                    </div>
                  </div>

                  <div>
                    {getTypeBadge(item.type)}
                  </div>

                  <div className="text-xs text-muted-foreground min-w-0 pr-4">
                    <div className="text-foreground font-medium truncate">{item.action}</div>
                    {item.description && (
                      <div className="truncate text-muted-foreground/80 text-[11px] mt-0.5">{item.description}</div>
                    )}
                  </div>

                  <div className="text-xs text-right text-muted-foreground font-mono tabular-nums min-w-0 pl-2">
                    {`${item.updated_at.toLocaleDateString('pt-BR')}, ${item.updated_at.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="border border-border/60 rounded-xl p-12 text-center text-muted-foreground bg-card/30">
          Nenhum registro de atividade encontrado com os filtros atuais.
        </div>
      )}

      {/* Paginação */}
      {filteredItems.length > 0 && (
        <div ref={paginationRef} className="flex items-center justify-between pt-1">
          <div className="text-xs text-muted-foreground">
            Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalItems)} de {totalItems} eventos
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs border-border/70"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs border-border/70"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      {/* Dialog de detalhes */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-xl border border-border/80 bg-card shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-brand" />
              Detalhes do Evento
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Registro auditável de alteração no sistema.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3.5 py-2 text-xs">
              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/30 border border-border/50">
                <UserAvatar userId={selected.data.user_id} className="h-8 w-8 shrink-0" />
                <div>
                  <div className="font-bold text-foreground">{profilesMap[selected.data.user_id]?.display_name || 'Usuário'}</div>
                  <div className="text-[11px] text-muted-foreground">{selected.data.user_id}</div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/20 border border-border/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Ação Executada</span>
                  {getTypeBadge(selected.type)}
                </div>
                <div className="font-semibold text-foreground text-sm">{selected.action}</div>
                {selected.description && (
                  <div className="text-muted-foreground leading-relaxed pt-1 border-t border-border/30">{selected.description}</div>
                )}
              </div>

              <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1">
                <span>Registrado em:</span>
                <span className="font-mono text-foreground font-semibold">{`${selected.updated_at.toLocaleDateString('pt-BR')}, ${selected.updated_at.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default History;
