import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api';
import { usePermissions, UserRole } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Plus, Edit, Loader2, Search, Check, X as XIcon } from 'lucide-react';

// Flag single-tenant: mantém consistência com UserManagement
const SINGLE_TENANT = String((import.meta as any).env?.VITE_SINGLE_TENANT ?? 'true') === 'true';

type Profile = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: UserRole | string | null;
  created_at: string;
  updated_at: string;
  organization_id: string | null;
};

type FunctionRole = 'desenvolvimento' | 'suporte' | 'gerencia' | 'supervisao' | 'visualizador';

type RoleRequest = {
  id: string;
  user_id: string;
  requested_roles: FunctionRole[];
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};

const roleLabels: Record<UserRole, string> = {
  master: 'Master',
  admin: 'Administrador',
  manager: 'Gerente',
  tester: 'Testador',
  viewer: 'Visualizador',
};

const roleLabel: Record<string, string> = {
  desenvolvimento: 'Desenvolvimento',
  suporte: 'Suporte',
  gerencia: 'Gerência',
  supervisao: 'Supervisão',
  visualizador: 'Visualizador',
};

export const Profiles: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [profileRoles, setProfileRoles] = useState<Record<string, any[]>>({});
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | UserRole>('all');
  const [roleRequests, setRoleRequests] = useState<RoleRequest[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [selection, setSelection] = useState<Record<string, Set<FunctionRole>>>({});

  // Modais (placeholders)
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);

  const fetchProfiles = useCallback(async () => {
    try {
      setLoading(true);

      if (SINGLE_TENANT) {
        const { data: authData } = await apiClient.auth.getUser();
        const current = authData?.user;
        if (current) {
          const local: Profile = {
            id: current.id,
            display_name: (current.user_metadata as any)?.full_name || 'Master',
            email: current.email || `user_${current.id.slice(0, 8)}@sistema.local`,
            role: 'master',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            organization_id: null,
          };
          setProfiles([local]);
        } else {
          setProfiles([]);
        }
        return;
      }

      const { data, error } = await apiClient
        .from('profiles' as any)
        .select('id, display_name, email, avatar_url, github_url, google_url, website_url, role')
        .order('display_name', { ascending: true });

      if (error) throw error;
      setProfiles(data || []);

      // Fetch all function roles for these profiles
      const { data: rolesData, error: rolesError } = await apiClient
        .from('profile_function_roles' as any)
        .select('user_id, role, icon');
      
      if (!rolesError && rolesData) {
        const rolesMap: Record<string, any[]> = {};
        rolesData.forEach(r => {
          if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
          rolesMap[r.user_id].push(r);
        });
        setProfileRoles(rolesMap);
      }
    } catch (e) {
      console.error('Erro ao buscar perfis:', e);
      toast({ title: 'Erro', description: 'Não foi possível carregar os perfis.', variant: 'destructive' });
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchRoleRequests = useCallback(async () => {
    if (SINGLE_TENANT) { setRoleRequests([]); return; }
    const { data, error } = await apiClient
      .from('role_requests' as any)
      .select('id, user_id, requested_roles, status, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (!error && data) {
      setRoleRequests(data as any);
      const init: Record<string, Set<FunctionRole>> = {};
      for (const r of data as RoleRequest[]) init[r.user_id] = new Set(r.requested_roles);
      setSelection(init);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
    fetchRoleRequests();
  }, [fetchProfiles, fetchRoleRequests]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = profiles;
    if (activeTab !== 'all') {
      list = list.filter(p => p.role === activeTab);
    }
    if (!q) return list;
    return list.filter(p =>
      (p.display_name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q)
    );
  }, [profiles, search, activeTab]);

  const toggleRole = (userId: string, role: FunctionRole) => {
    setSelection((prev) => {
      const next = { ...prev };
      const set = new Set(next[userId] || []);
      if (set.has(role)) set.delete(role); else set.add(role);
      next[userId] = set;
      return next;
    });
  };

  const approveRequest = async (req: RoleRequest) => {
    if (SINGLE_TENANT) return;
    try {
      setAssigning(req.id);
      const roles = Array.from(selection[req.user_id] || new Set<FunctionRole>());
      if (roles.length === 0) return;
      // Upsert roles em profile_function_roles
      const rows = roles.map(r => ({ user_id: req.user_id, role: r }));
      const { error: upErr } = await apiClient.from('profile_function_roles' as any).upsert(rows, { onConflict: 'user_id,role' } as any);
      if (upErr) throw upErr;
      // Atualizar status da request
      const { error: stErr } = await apiClient.from('role_requests' as any).update({ status: 'approved' }).eq('id', req.id);
      if (stErr) throw stErr;
      setRoleRequests((prev) => prev.filter(r => r.id !== req.id));
    } finally {
      setAssigning(null);
    }
  };

  const rejectRequest = async (req: RoleRequest) => {
    if (SINGLE_TENANT) return;
    try {
      setAssigning(req.id);
      const { error } = await apiClient.from('role_requests' as any).update({ status: 'rejected' }).eq('id', req.id);
      if (error) throw error;
      setRoleRequests((prev) => prev.filter(r => r.id !== req.id));
    } finally {
      setAssigning(null);
    }
  };

  const handleOpenCreate = () => {
    if (SINGLE_TENANT) {
      toast({ title: 'Ação indisponível', description: 'Criação de perfis desabilitada no modo single-tenant.' });
      return;
    }
    setOpenCreate(true);
  };

  const handleOpenEdit = (profile: Profile) => {
    if (SINGLE_TENANT) {
      toast({ title: 'Ação indisponível', description: 'Edição de perfis desabilitada no modo single-tenant.' });
      return;
    }
    setEditing(profile);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-8 w-8" />
            Perfis de Usuário
          </h1>
          <p className="text-muted-foreground">Gerencie perfis e papéis de acesso</p>
        </div>
        {hasPermission('can_manage_users') && (
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Perfil
          </Button>
        )}
      </div>

      <Card className="h-full flex flex-col">
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-base">Lista de Perfis</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative w-full max-w-sm">
              <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar por nome ou email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList>
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="master">Masters</TabsTrigger>
              <TabsTrigger value="admin">Administradores</TabsTrigger>
              <TabsTrigger value="manager">Gerentes</TabsTrigger>
              <TabsTrigger value="tester">Testadores</TabsTrigger>
              <TabsTrigger value="viewer">Visualizadores</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="p-0">
              <Card className="h-full flex flex-col">
                <CardContent className="p-0">
                  {loading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      Carregando perfis...
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">Nenhum perfil encontrado</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Papel</TableHead>
                          <TableHead className="w-[100px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>{p.display_name || '—'}</TableCell>
                            <TableCell className="text-muted-foreground">{p.email || '—'}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
                                  {p.role}
                                </span>
                                {profileRoles[p.id]?.map((pr, idx) => (
                                  <span key={idx} className="text-[10px] font-bold text-brand bg-brand/10 px-2 py-0.5 rounded-full border border-brand/20 uppercase tracking-tight">
                                    {roleLabel[pr.role] || pr.role}
                                  </span>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              {hasPermission('can_manage_users') && (
                                <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(p)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {!SINGLE_TENANT && hasPermission('can_manage_users') && (
        <Card className="h-full flex flex-col">
          <CardHeader className="p-4 pb-3">
            <CardTitle className="text-base">Solicitações de Cargo</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            {roleRequests.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sem solicitações pendentes</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Solicitado</TableHead>
                    <TableHead>Selecionar cargos</TableHead>
                    <TableHead className="w-[160px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roleRequests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{profiles.find(p => p.id === r.user_id)?.display_name || r.user_id}</TableCell>
                      <TableCell>{r.requested_roles.join(', ')}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {(['desenvolvimento','suporte','gerencia','supervisao','visualizador'] as FunctionRole[]).map((fr) => (
                            <label key={fr} className="inline-flex items-center gap-1 border rounded px-2 py-1">
                              <input
                                type="checkbox"
                                checked={!!selection[r.user_id]?.has(fr)}
                                onChange={() => toggleRole(r.user_id, fr)}
                              />
                              <span className="capitalize">{fr}</span>
                            </label>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => approveRequest(r)} disabled={assigning === r.id}>
                            <Check className="h-4 w-4 mr-1" /> Aprovar
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => rejectRequest(r)} disabled={assigning === r.id}>
                            <XIcon className="h-4 w-4 mr-1" /> Rejeitar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal: Criar Perfil (placeholder) */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Perfil</DialogTitle>
            <DialogDescription>
              Placeholder de criação de perfil. Implementação backend não inclusa nesta etapa.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Perfil (placeholder) */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Perfil</DialogTitle>
            <DialogDescription>
              Placeholder de edição de perfil para {editing?.display_name || '—'}. Implementação backend não inclusa nesta etapa.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profiles;
