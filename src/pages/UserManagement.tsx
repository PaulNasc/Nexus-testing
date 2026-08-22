import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '@/lib/api';
import { usePermissions, UserRole, UserPermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Users, Loader2, Search, UserPlus, Trash2, ChevronDown, ChevronUp,
  Shield, UserCog, RefreshCcw, Check, X as XIcon, Mail, Crown,
  FileText, ClipboardCheck, Play, BarChart3, Download, Sparkles,
  Zap, Settings, Link2, Bug, Activity, Eye, Lock, Clock, Layers
} from 'lucide-react';
import { ActivityLogPanel } from '@/components/ActivityLogPanel';
import { GroupsManagement } from '@/components/GroupsManagement';
import { StandardButton } from '@/components/StandardButton';
import { UserAvatar } from '@/components/ui/UserAvatar';

const SINGLE_TENANT = String(import.meta.env?.VITE_SINGLE_TENANT ?? 'true') === 'true';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserData {
  id: string;
  email: string;
  created_at: string;
  profile?: { display_name: string | null; role: UserRole; organization_id: string | null };
  permissions?: Partial<UserPermissions>;
}

type PermRow = { user_id: string } & { [K in keyof UserPermissions]?: boolean };

type RoleRequest = {
  id: string;
  user_id: string;
  requested_roles: string[];
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<UserRole, string> = {
  master: 'Master',
  admin: 'Administrador',
  manager: 'Gerente',
  tester: 'Testador',
  viewer: 'Visualizador',
};

const ROLE_COLORS: Record<UserRole, string> = {
  master: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  admin: 'bg-red-500/10 text-red-400 border-red-500/20',
  manager: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  tester: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  viewer: 'bg-muted text-muted-foreground border-border',
};

// Permissões agrupadas por categoria
const PERMISSION_GROUPS: Array<{
  key: string;
  label: string;
  icon: React.ElementType;
  items: Array<{ key: keyof UserPermissions; label: string; desc: string; icon: React.ElementType }>;
}> = [
  {
    key: 'admin',
    label: 'Administração do Sistema',
    icon: Shield,
    items: [
      { key: 'can_manage_users', label: 'Gerenciar Usuários', desc: 'Criar, editar e remover usuários', icon: UserCog },
      { key: 'can_manage_groups', label: 'Gerenciar Grupos', desc: 'Criar e editar grupos e seus membros', icon: Users },
      { key: 'can_manage_projects', label: 'Gerenciar Projetos', desc: 'Criar e editar projetos', icon: Settings },
      { key: 'can_delete_projects', label: 'Excluir Projetos', desc: 'Remover projetos permanentemente', icon: Trash2 },
    ],
  },
  {
    key: 'testing',
    label: 'Gerenciamento de Testes',
    icon: ClipboardCheck,
    items: [
      { key: 'can_manage_plans', label: 'Planos de Teste', desc: 'Criar e editar planos de teste', icon: FileText },
      { key: 'can_manage_cases', label: 'Casos de Teste', desc: 'Criar e editar casos de teste', icon: ClipboardCheck },
      { key: 'can_manage_executions', label: 'Execuções', desc: 'Registrar e editar execuções de teste', icon: Play },
    ],
  },
  {
    key: 'gestao',
    label: 'Gestão',
    icon: Link2,
    items: [
      { key: 'can_manage_requirements', label: 'Requisitos', desc: 'Criar e editar requisitos', icon: FileText },
      { key: 'can_manage_defects', label: 'Defeitos', desc: 'Registrar e gerenciar defeitos', icon: Bug },
    ],
  },
  {
    key: 'reports',
    label: 'Relatórios e Exportação',
    icon: BarChart3,
    items: [
      { key: 'can_view_reports', label: 'Visualizar Relatórios', desc: 'Acessar relatórios e histórico', icon: BarChart3 },
      { key: 'can_export', label: 'Exportar Dados', desc: 'Exportar dados em CSV/PDF', icon: Download },
    ],
  },
  {
    key: 'ai',
    label: 'Inteligência Artificial',
    icon: Sparkles,
    items: [
      { key: 'can_use_ai', label: 'Usar IA', desc: 'Gerar planos e casos com IA', icon: Sparkles },
      { key: 'can_select_ai_models', label: 'Selecionar Modelos IA', desc: 'Trocar o modelo de IA em uso', icon: Zap },
      { key: 'can_manage_ai_templates', label: 'Gerenciar Templates IA', desc: 'Editar prompts e templates', icon: FileText },
    ],
  },
  {
    key: 'model_control',
    label: 'Model Control (Avançado)',
    icon: Activity,
    items: [
      { key: 'can_access_model_control', label: 'Acessar Model Control', desc: 'Painel de controle de modelos IA', icon: Activity },
      { key: 'can_configure_ai_models', label: 'Configurar Modelos IA', desc: 'Chaves de API e endpoints', icon: Settings },
      { key: 'can_test_ai_connections', label: 'Testar Conexões IA', desc: 'Diagnosticar conectividade de modelos', icon: Zap },
    ],
  },
];

const normalizePerms = (row?: PermRow): Partial<UserPermissions> => {
  if (!row) return {};
  const out: Partial<UserPermissions> = {};
  for (const g of PERMISSION_GROUPS) {
    for (const item of g.items) {
      const v = (row as Record<string, unknown>)[item.key];
      if (typeof v === 'boolean') (out as Record<string, unknown>)[item.key] = v;
    }
  }
  return out;
};

export const UserManagement = () => {
  const { role, isMaster, hasPermission, getDefaultPermissions } = usePermissions();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [permSearch, setPermSearch] = useState('');

  // Modais
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('tester');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserData | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [syncingProfiles, setSyncingProfiles] = useState(false);

  // Role requests
  const [roleRequests, setRoleRequests] = useState<RoleRequest[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: profilesData } = await apiClient
        .from('profiles')
        .select('id, display_name, role, organization_id, created_at, email');

      const rows = (profilesData || []) as Array<{
        id: string; display_name: string | null; role: string; organization_id: string | null; created_at: string; email?: string;
      }>;

      const ids = rows.map(r => r.id);
      if (ids.length > 0) {
        await apiClient.from('user_permissions').upsert(ids.map(id => ({ user_id: id })), { onConflict: 'user_id' });
      }

      const { data: permsList } = await apiClient
        .from('user_permissions')
        .select('*')
        .in('user_id', ids);

      const permMap = new Map<string, PermRow>(((permsList as PermRow[] | null) || []).map(p => [p.user_id, p]));

      setUsers(rows.map(r => ({
        id: r.id,
        email: r.email || `user_${r.id.slice(0, 8)}@sistema.local`,
        created_at: r.created_at || '',
        profile: { display_name: r.display_name, role: (r.role as UserRole) || 'viewer', organization_id: null },
        permissions: normalizePerms(permMap.get(r.id)),
      })));
    } catch (e) {
      console.error('fetchUsers error:', e);
      toast({ title: 'Erro', description: 'Não foi possível carregar os usuários.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [getDefaultPermissions, toast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    if (SINGLE_TENANT) return;
    apiClient.from('role_requests').select('id, user_id, requested_roles, status, created_at').eq('status', 'pending').order('created_at').then(({ data }) => {
      if (data) {
        const parsed = (data as any[]).map((r) => ({
          ...r,
          requested_roles: Array.isArray(r.requested_roles)
            ? r.requested_roles
            : (() => { try { return JSON.parse(r.requested_roles || '[]'); } catch { return [r.requested_roles].filter(Boolean); } })(),
        }));
        setRoleRequests(parsed as RoleRequest[]);
      }
    });
  }, []);

  // Stats for KPI bar
  const stats = useMemo(() => {
    const total = users.length;
    const masters = users.filter(u => u.profile?.role === 'master' || u.profile?.role === 'admin').length;
    const managers = users.filter(u => u.profile?.role === 'manager').length;
    const testers = users.filter(u => u.profile?.role === 'tester').length;
    const viewers = users.filter(u => u.profile?.role === 'viewer').length;

    return { total, masters, managers, testers, viewers };
  }, [users]);

  // Filtered lists
  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return q ? users.filter(u => (u.profile?.display_name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : users;
  }, [users, searchQuery]);

  const filteredGroups = useMemo(() => {
    if (!permSearch) return PERMISSION_GROUPS;
    const q = permSearch.toLowerCase();
    return PERMISSION_GROUPS.map(g => ({
      ...g,
      items: g.items.filter(i => i.label.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q)),
    })).filter(g => g.items.length > 0);
  }, [permSearch]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!(role === 'master' || role === 'admin')) {
      toast({ title: 'Acesso negado', description: 'Apenas administradores podem alterar papéis.', variant: 'destructive' }); return;
    }
    const { error } = await apiClient.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) { toast({ title: 'Erro ao alterar papel', description: error.message, variant: 'destructive' }); return; }
    const defaults = getDefaultPermissions(newRole as UserRole);
    await apiClient.from('user_permissions').upsert({ user_id: userId, ...defaults }, { onConflict: 'user_id' });
    setUsers(prev => prev.map(u => u.id === userId ? {
      ...u,
      profile: { ...(u.profile ?? { display_name: null, organization_id: null, role: 'viewer' as UserRole }), role: newRole as UserRole },
      permissions: defaults,
    } : u));
    toast({ title: 'Papel atualizado com sucesso' });
  };

  const handlePermissionChange = async (userId: string, perm: string, value: boolean) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, permissions: { ...u.permissions, [perm]: value } } : u));
    if (!(role === 'master' || role === 'admin')) { toast({ title: 'Acesso negado', variant: 'destructive' }); return; }
    const { error } = await apiClient.from('user_permissions').upsert({ user_id: userId, [perm]: value }, { onConflict: 'user_id' });
    if (error) toast({ title: 'Erro ao salvar permissão', description: error.message, variant: 'destructive' });
    else toast({ title: 'Permissão salva' });
  };

  const handleInviteUser = async () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      toast({ title: 'Email inválido', variant: 'destructive' }); return;
    }
    if (role !== 'master') { toast({ title: 'Acesso negado', variant: 'destructive' }); return; }
    setInviteLoading(true);
    try {
      const orgId = users.find(u => u.id === currentUser?.id)?.profile?.organization_id || null;
      const { data, error } = await apiClient.functions.invoke('invite-user', {
        body: { email: inviteEmail, role: inviteRole, organization_id: orgId },
      });
      if (error) { toast({ title: 'Falha ao enviar convite', description: (error as any)?.message || 'Erro desconhecido.', variant: 'destructive' }); return; }
      const d = data as Record<string, unknown> | null;
      if (d?.email_sent_via === 'password_reset') {
        toast({ title: 'E-mail enviado', description: 'Usuário já existia — enviamos um e-mail de recuperação.' });
      } else if (d?.success) {
        toast({ title: 'Convite enviado', description: `Convite enviado para ${inviteEmail}.` });
      } else {
        toast({ title: 'Aviso', description: 'Resposta inesperada do servidor.', variant: 'destructive' });
      }
      setInviteOpen(false);
      setInviteEmail('');
      setInviteRole('tester');
      await fetchUsers();
    } catch (e: unknown) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Não foi possível enviar.', variant: 'destructive' });
    } finally {
      setInviteLoading(false);
    }
  };

  const confirmDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const { error } = await apiClient.functions.invoke('delete-user', { body: { user_id: deleteTarget.id } });
      if (error) { toast({ title: 'Erro ao remover', description: (error as any)?.message, variant: 'destructive' }); return; }
      toast({ title: 'Usuário removido' });
      await fetchUsers();
    } catch (e: unknown) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Não foi possível remover.', variant: 'destructive' });
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  };

  const handleSyncProfiles = async () => {
    if (!(role === 'master' || role === 'admin')) return;
    setSyncingProfiles(true);
    const { error } = await apiClient.rpc('sync_profiles_from_auth');
    setSyncingProfiles(false);
    if (error) { toast({ title: 'Erro ao sincronizar', description: error.message, variant: 'destructive' }); return; }
    await fetchUsers();
    toast({ title: 'Perfis sincronizados' });
  };

  const approveRequest = async (req: RoleRequest) => {
    setAssigning(req.id);
    await apiClient.from('role_requests').update({ status: 'approved' }).eq('id', req.id);
    setRoleRequests(prev => prev.filter(r => r.id !== req.id));
    setAssigning(null);
  };

  const rejectRequest = async (req: RoleRequest) => {
    setAssigning(req.id);
    await apiClient.from('role_requests').update({ status: 'rejected' }).eq('id', req.id);
    setRoleRequests(prev => prev.filter(r => r.id !== req.id));
    setAssigning(null);
  };

  const canManage = () => role === 'master' || role === 'admin';

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
        <span className="text-sm">Carregando usuários e permissões...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <UserCog className="h-6 w-6 text-brand" />
            Gestão de Usuários e Permissões
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie membros da equipe, níveis de acesso, papéis funcionais e permissões granulares.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canManage() && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={handleSyncProfiles} disabled={syncingProfiles} className="h-9 gap-1.5 text-xs border-border/70">
                    {syncingProfiles ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                    Sincronizar
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Recarregar lista de usuários da base de autenticação</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {isMaster() && (
            <StandardButton variant="brand" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" /> Convidar Usuário
            </StandardButton>
          )}
        </div>
      </div>

      {/* KPI Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Total de Usuários</span>
            <Users className="h-4 w-4 text-brand/70" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">{stats.total}</div>
        </div>

        <div className="p-3.5 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Master / Admins</span>
            <Crown className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-400 mt-1">{stats.masters}</div>
        </div>

        <div className="p-3.5 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Gerentes</span>
            <Shield className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400 mt-1">{stats.managers}</div>
        </div>

        <div className="p-3.5 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Testadores</span>
            <Play className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{stats.testers}</div>
        </div>

        <div className="p-3.5 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Visualizadores</span>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold text-muted-foreground mt-1">{stats.viewers}</div>
        </div>
      </div>

      {/* Tabs & Search */}
      <Tabs defaultValue="users">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <TabsList className="bg-muted/30 p-1 rounded-xl border border-border/60 h-auto flex flex-wrap gap-1">
            <TabsTrigger 
              value="users" 
              className="rounded-lg px-3.5 py-1.5 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-brand data-[state=active]:shadow-xs transition-all flex items-center gap-2"
            >
              <Users className="h-3.5 w-3.5" />
              Usuários ({users.length})
            </TabsTrigger>
            {hasPermission('can_manage_groups') && (
              <TabsTrigger 
                value="groups" 
                className="rounded-lg px-3.5 py-1.5 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-brand data-[state=active]:shadow-xs transition-all flex items-center gap-2"
              >
                <Layers className="h-3.5 w-3.5" />
                Grupos
              </TabsTrigger>
            )}
            <TabsTrigger 
              value="requests" 
              className="rounded-lg px-3.5 py-1.5 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-brand data-[state=active]:shadow-xs transition-all flex items-center gap-2"
            >
              <Lock className="h-3.5 w-3.5" />
              Solicitações
              {roleRequests.length > 0 && (
                <span className="ml-1.5 bg-brand/20 text-brand text-xs font-bold rounded-full px-1.5 py-0.2">{roleRequests.length}</span>
              )}
            </TabsTrigger>
            {isMaster() && (
              <TabsTrigger 
                value="logs" 
                className="rounded-lg px-3.5 py-1.5 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-brand data-[state=active]:shadow-xs transition-all flex items-center gap-2"
              >
                <Clock className="h-3.5 w-3.5" />
                Log de Auditoria
              </TabsTrigger>
            )}
          </TabsList>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar usuário por nome ou email..."
              className="pl-8 h-8 text-xs bg-muted/20 border-border/60"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Tab: Usuários */}
        <TabsContent value="users" className="mt-4">
          {filteredUsers.length === 0 ? (
            <div className="border border-border/60 rounded-xl p-12 text-center text-sm text-muted-foreground bg-card/30">
              {searchQuery ? 'Nenhum usuário encontrado para a busca informada.' : 'Nenhum usuário cadastrado.'}
            </div>
          ) : (
            <div className="border border-border/70 rounded-xl overflow-hidden bg-card/60 backdrop-blur-sm shadow-xs">
              <div className="grid grid-cols-[1fr_180px_80px] items-center px-4 py-3 bg-muted/40 border-b border-border/70 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <div>Membro / Email</div>
                <div>Papel Funcional</div>
                <div className="text-right">Ações</div>
              </div>

              <div className="divide-y divide-border/50">
                {filteredUsers.map(u => {
                  const userRole = u.profile?.role || 'viewer';
                  const isExpanded = expandedUser === u.id;

                  return (
                    <React.Fragment key={u.id}>
                      <div
                        className="grid grid-cols-[1fr_180px_80px] items-center px-4 py-3.5 hover:bg-muted/20 transition-colors cursor-pointer"
                        onClick={() => setExpandedUser(prev => prev === u.id ? null : u.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <UserAvatar userId={u.id} className="h-9 w-9 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-foreground truncate">
                              {u.profile?.display_name || 'Usuário Sem Nome'}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                          </div>
                        </div>

                        <div onClick={e => e.stopPropagation()}>
                          {canManage() ? (
                            <Select value={userRole} onValueChange={v => handleRoleChange(u.id, v)}>
                              <SelectTrigger className={`h-8 text-xs font-semibold border px-2.5 rounded-lg shadow-2xs ${ROLE_COLORS[userRole]}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {userRole === 'master' && <SelectItem value="master">Master</SelectItem>}
                                <SelectItem value="admin">Administrador</SelectItem>
                                <SelectItem value="manager">Gerente</SelectItem>
                                <SelectItem value="tester">Testador</SelectItem>
                                <SelectItem value="viewer">Visualizador</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className={`text-xs font-semibold py-0.5 ${ROLE_COLORS[userRole]}`}>
                              {ROLE_LABELS[userRole]}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedUser(prev => prev === u.id ? null : u.id)}>
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-brand" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                          </Button>
                          {isMaster() && userRole !== 'master' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteTarget(u)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-5 py-5 bg-muted/15 border-t border-border/60 space-y-5 animate-slide-up">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                              <Shield className="h-4 w-4 text-brand" />
                              Permissões Granulares de {u.profile?.display_name || u.email}
                            </div>
                            <div className="relative w-full sm:w-64">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                              <Input
                                placeholder="Filtrar permissões..."
                                className="pl-8 h-8 text-xs bg-muted/20 border-border/60"
                                value={permSearch}
                                onChange={e => setPermSearch(e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                            {filteredGroups.map(group => (
                              <div key={group.key} className="border border-border/70 rounded-xl overflow-hidden bg-card/60 shadow-2xs">
                                <div className="flex items-center gap-2 px-3.5 py-2.5 bg-muted/40 border-b border-border/60">
                                  <group.icon className="h-4 w-4 text-brand" />
                                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">{group.label}</span>
                                </div>
                                <div className="divide-y divide-border/40">
                                  {group.items.map(item => {
                                    const checked = !!(u.permissions as Record<string, unknown>)?.[item.key];
                                    const disabled = !canManage();
                                    return (
                                      <div key={item.key} className="flex items-center justify-between px-3.5 py-2.5 gap-3 hover:bg-muted/20 transition-colors">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                                          <div className="min-w-0">
                                            <div className="text-xs font-semibold text-foreground leading-none">{item.label}</div>
                                            <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{item.desc}</div>
                                          </div>
                                        </div>
                                        <Switch
                                          checked={checked}
                                          onCheckedChange={v => handlePermissionChange(u.id, item.key, v)}
                                          disabled={disabled}
                                          className="shrink-0 data-[state=checked]:bg-brand"
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>

                          {isMaster() && (
                            <div className="pt-2 border-t border-border/40">
                              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                                <Clock className="h-4 w-4 text-brand" />
                                Histórico de Atividades de {u.profile?.display_name || u.email}
                              </div>
                              <ActivityLogPanel userId={u.id} showUserColumn={false} />
                            </div>
                          )}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab: Logs Gerais */}
        {isMaster() && (
          <TabsContent value="logs" className="mt-4">
            <ActivityLogPanel userId={null} showUserColumn />
          </TabsContent>
        )}

        {/* Tab: Grupos */}
        {hasPermission('can_manage_groups') && (
          <TabsContent value="groups" className="mt-4">
            <GroupsManagement users={users} canManage={hasPermission('can_manage_groups')} />
          </TabsContent>
        )}

        {/* Tab: Solicitações */}
        <TabsContent value="requests" className="mt-4">
          {SINGLE_TENANT ? (
            <div className="border border-border/70 rounded-xl p-8 text-xs text-muted-foreground text-center bg-card/30">
              Solicitações desativadas no modo single-tenant.
            </div>
          ) : roleRequests.length === 0 ? (
            <div className="border border-border/70 rounded-xl p-8 text-xs text-muted-foreground text-center bg-card/30">
              Nenhuma solicitação de papel pendente no momento.
            </div>
          ) : (
            <div className="border border-border/70 rounded-xl overflow-hidden bg-card/60 backdrop-blur-sm shadow-xs">
              <div className="grid grid-cols-[1fr_1fr_auto] items-center px-4 py-3 bg-muted/40 border-b border-border/70 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <div>Usuário Solicitante</div>
                <div>Papéis Solicitados</div>
                <div className="text-right">Decisão</div>
              </div>
              <div className="divide-y divide-border/50">
                {roleRequests.map(r => {
                  const reqUser = users.find(u => u.id === r.user_id);
                  return (
                    <div key={r.id} className="grid grid-cols-[1fr_1fr_auto] items-center px-4 py-3.5 gap-4">
                      <div>
                        <div className="text-sm font-semibold text-foreground">{reqUser?.profile?.display_name || reqUser?.email || r.user_id}</div>
                        <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString('pt-BR')}</div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(r.requested_roles) ? r.requested_roles.map(rr => (
                          <span key={rr} className="text-xs bg-brand/10 text-brand border border-brand/20 rounded-md px-2 py-0.5 capitalize font-semibold">{rr}</span>
                        )) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="h-8 text-xs border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10" disabled={assigning === r.id} onClick={() => approveRequest(r)}>
                          <Check className="h-3.5 w-3.5 mr-1" /> Aprovar
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs border-destructive/30 text-destructive hover:bg-destructive/10" disabled={assigning === r.id} onClick={() => rejectRequest(r)}>
                          <XIcon className="h-3.5 w-3.5 mr-1" /> Rejeitar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal Convidar Usuário */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-[440px] rounded-xl border border-border/80 bg-card shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-brand" />
              Convidar Novo Usuário
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Um link de convite e ativação de acesso será enviado para o endereço informado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">E-mail Corporativo *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="invite-email"
                  name="invite-email"
                  placeholder="exemplo@empresa.com"
                  className="pl-9 bg-muted/20 border-border/70 text-xs"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-role" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Papel Inicial</Label>
              <Select value={inviteRole} onValueChange={v => setInviteRole(v as UserRole)}>
                <SelectTrigger id="invite-role" className="bg-muted/20 border-border/70 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="manager">Gerente</SelectItem>
                  <SelectItem value="tester">Testador</SelectItem>
                  <SelectItem value="viewer">Visualizador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2 border-t border-border/40">
            <StandardButton variant="outline" onClick={() => setInviteOpen(false)} disabled={inviteLoading}>
              Cancelar
            </StandardButton>
            <StandardButton variant="brand" onClick={handleInviteUser} disabled={inviteLoading || !inviteEmail.trim()}>
              {inviteLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</> : 'Enviar Convite'}
            </StandardButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Remoção */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="rounded-xl border border-border/80 bg-card shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Remover Usuário
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Tem certeza que deseja remover o usuário <strong className="text-foreground">{deleteTarget?.profile?.display_name || deleteTarget?.email}</strong>?
              Esta ação revoga permanentemente todas as permissões e acessos ao sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteUser} disabled={deleteLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Removendo...</> : 'Confirmar Remoção'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserManagement;
