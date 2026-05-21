import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Users, Bell, X, UserPlus, ShieldAlert, CheckCircle2, Layout, UserCircle, Settings2, Trash2, Plus, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Group {
  id: string;
  name: string;
  color: string;
  description: string;
}

interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: string;
}

interface GroupsManagementProps {
  users: any[];
  canManage: boolean;
}

export const GroupsManagement = ({ users, canManage }: GroupsManagementProps) => {
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState(false);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#2563eb');
  const [createLoading, setCreateLoading] = useState(false);

  const COLOR_PRESETS = [
    { value: '#2563eb', name: 'Azul' },
    { value: '#059669', name: 'Verde' },
    { value: '#d97706', name: 'Amarelo' },
    { value: '#dc2626', name: 'Vermelho' },
    { value: '#00c2a8', name: 'Turquesa' },
    { value: '#0891b2', name: 'Ciano' },
    { value: '#ea580c', name: 'Laranja' },
    { value: '#64748b', name: 'Cinza' },
  ];

  const fetchGroupsData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: gData, error: gError } = await apiClient.from('groups').select('*').order('name');
      if (gError) throw gError;
      
      const { data: mData, error: mError } = await apiClient.from('group_members').select('*');
      if (mError) throw mError;

      setGroups(gData as Group[]);
      setMembers(mData as GroupMember[]);
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erro ao carregar grupos', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchGroupsData();
  }, [fetchGroupsData]);

  const handleAddMember = async (userId: string, groupId: string) => {
    if (!canManage) return;
    try {
      const newId = crypto.randomUUID();
      const { error } = await apiClient.from('group_members').insert({
        id: newId,
        group_id: groupId,
        user_id: userId,
        role: 'member'
      });
      if (error) {
        if (error.code === '23505') {
          toast({ title: 'Usuário já está neste grupo', variant: 'destructive' });
        } else {
          throw error;
        }
      } else {
        toast({ title: 'Membro adicionado com sucesso', variant: 'default' });
        fetchGroupsData();
      }
    } catch (e: any) {
      toast({ title: 'Erro ao adicionar membro', description: e.message, variant: 'destructive' });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!canManage) return;
    try {
      const { error } = await apiClient.from('group_members').delete().eq('id', memberId);
      if (error) throw error;
      setMembers(prev => prev.filter(m => m.id !== memberId));
      toast({ title: 'Membro removido', variant: 'default' });
    } catch (e: any) {
      toast({ title: 'Erro ao remover membro', description: e.message, variant: 'destructive' });
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setCreateLoading(true);
    try {
      const { error } = await apiClient.from('groups').insert({
        id: crypto.randomUUID(),
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
        color: newGroupColor,
      });
      if (error) throw error;
      toast({ title: 'Grupo criado com sucesso', variant: 'default' });
      setNewGroupName('');
      setNewGroupDesc('');
      setNewGroupColor('#2563eb');
      setCreateDialogOpen(false);
      fetchGroupsData();
    } catch (e: any) {
      toast({ title: 'Erro ao criar grupo', description: e.message, variant: 'destructive' });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!canManage) return;
    if (!window.confirm(`Tem certeza de que deseja excluir o grupo "${groupName}"? Todos os membros serão desvinculados.`)) return;
    try {
      await apiClient.from('group_members').delete().eq('group_id', groupId);
      const { error } = await apiClient.from('groups').delete().eq('id', groupId);
      if (error) throw error;
      toast({ title: 'Grupo excluído com sucesso', variant: 'default' });
      fetchGroupsData();
    } catch (e: any) {
      toast({ title: 'Erro ao excluir grupo', description: e.message, variant: 'destructive' });
    }
  };

  const notifyOrphanUsers = async () => {
    if (orphanUsers.length === 0) return;
    setNotifying(true);
    try {
      const promises = orphanUsers.map(async (u) => {
        const { data: existing } = await apiClient
          .from('notifications' as any)
          .select('id')
          .eq('user_id', u.id)
          .eq('title', 'Alocação de Grupo Pendente')
          .is('read_at', null);

        if (!existing || existing.length === 0) {
          return apiClient
            .from('notifications' as any)
            .insert({
              id: crypto.randomUUID(),
              user_id: u.id,
              title: 'Alocação de Grupo Pendente',
              body: 'Você não está vinculado a nenhum grupo. Por favor, solicite a um administrador para ser alocado em um time.',
              created_at: new Date().toISOString()
            });
        }
      });
      
      await Promise.all(promises);
      toast({ title: 'Notificações Enviadas', description: 'Usuários pendentes foram notificados para realizar o onboarding.', variant: 'default' });
    } catch (e: any) {
      toast({ title: 'Erro ao enviar notificações', description: e.message, variant: 'destructive' });
    } finally {
      setNotifying(false);
    }
  };

  const orphanUsers = useMemo(() => {
    const membersUserIds = new Set(members.map(m => m.user_id));
    return users.filter(u => !membersUserIds.has(u.id));
  }, [users, members]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 animate-in fade-in">
        <div className="relative">
          <Loader2 className="h-10 w-10 animate-spin text-brand/40" />
          <Users className="h-4 w-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-brand" />
        </div>
        <span className="text-sm font-medium text-muted-foreground tracking-tight">Preparando estrutura de colaboração...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
      
      {/* ── Pending Users Banner ── */}
      {orphanUsers.length > 0 && (
        <section className="bg-card border border-border border-l-2 border-l-amber-500/60 rounded-xl p-5 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0">
                <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  Pendências de Alocação
                  <Badge variant="outline" className="bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold px-2 py-0.5 text-xs">
                    {orphanUsers.length}
                  </Badge>
                </h3>
                <p className="text-xs text-muted-foreground max-w-xl mt-1 leading-relaxed">
                  Estes usuários estão ativos no sistema mas ainda não foram vinculados a um grupo de trabalho. Por favor, associe cada usuário a um time abaixo para garantir o acesso correto.
                </p>
              </div>
            </div>
            
            {canManage && (
              <Button 
                onClick={notifyOrphanUsers} 
                disabled={notifying}
                variant="outline"
                size="sm"
                className="h-9 px-4 rounded-lg font-medium text-amber-600 border-amber-500/20 hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300"
              >
                {notifying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Bell className="h-4 w-4 mr-2" />}
                Solicitar Onboarding
              </Button>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
            {orphanUsers.map(u => (
              <div 
                key={u.id} 
                className="flex flex-col gap-3 p-4 bg-card border border-border rounded-xl transition-all group/user shadow-sm hover:border-brand/40"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center border border-border">
                    <UserCircle className="h-5 w-5 text-muted-foreground group-hover/user:text-brand transition-colors" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate text-foreground">
                      {u.profile?.display_name || 'Usuário Pendente'}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate uppercase tracking-tight">
                      {u.email}
                    </p>
                  </div>
                </div>
                
                {canManage && (
                  <Select onValueChange={(val) => handleAddMember(u.id, val)}>
                    <SelectTrigger className="h-8.5 text-xs rounded-lg border-border bg-muted/30 hover:bg-muted/60 transition-all">
                      <SelectValue placeholder="Alocar agora..." />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map(g => (
                        <SelectItem key={g.id} value={g.id} className="text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
                            {g.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {orphanUsers.length === 0 && (
        <section className="bg-muted/20 border border-border border-l-4 border-l-emerald-500 rounded-xl p-4 shadow-sm w-fit">
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            Excelente! Todos os membros estão devidamente alocados.
          </div>
        </section>
      )}
      
      {/* ── Groups Grid ── */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand/10 rounded-lg">
              <Layout className="h-5 w-5 text-brand" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Estrutura de Times</h2>
            {canManage && (
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="ml-2 flex items-center gap-1">
                    <Plus className="h-3.5 w-3.5" />
                    <span>Novo Grupo</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <form onSubmit={handleCreateGroup} className="space-y-4">
                    <DialogHeader>
                      <DialogTitle>Criar Novo Grupo</DialogTitle>
                      <DialogDescription>
                        Insira as informações do novo grupo de colaboração no sistema.
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="name" className="text-xs">Nome do Grupo</Label>
                        <Input 
                          id="name" 
                          value={newGroupName} 
                          onChange={e => setNewGroupName(e.target.value)} 
                          placeholder="Ex: Time Alfa" 
                          required 
                        />
                      </div>
                      <div>
                        <Label htmlFor="description" className="text-xs">Descrição</Label>
                        <Textarea 
                          id="description" 
                          value={newGroupDesc} 
                          onChange={e => setNewGroupDesc(e.target.value)} 
                          placeholder="Ex: Responsável pelos testes automatizados de regressão" 
                          rows={3} 
                        />
                      </div>
                      <div>
                        <Label className="text-xs block mb-1.5">Cor do Grupo</Label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {COLOR_PRESETS.map(preset => (
                            <button
                              key={preset.value}
                              type="button"
                              className={`w-6 h-6 rounded-full border-2 transition-all ${newGroupColor === preset.value ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'}`}
                              style={{ backgroundColor: preset.value }}
                              onClick={() => setNewGroupColor(preset.value)}
                              title={preset.name}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <Input 
                            type="color" 
                            value={newGroupColor} 
                            onChange={e => setNewGroupColor(e.target.value)} 
                            className="w-12 h-8 p-0 border-0 cursor-pointer" 
                          />
                          <span className="text-xs font-mono text-muted-foreground">{newGroupColor}</span>
                        </div>
                      </div>
                    </div>
                    
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={createLoading}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={createLoading || !newGroupName.trim()}>
                        {createLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Salvar
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
            {groups.length} Grupos Ativos
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {groups.map(g => {
            const groupMembers = members.filter(m => m.group_id === g.id);
            return (
              <div 
                key={g.id} 
                className="group/card flex flex-col border border-border rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 relative"
              >
                
                {/* Header Section */}
                <div className="p-5 flex items-center justify-between gap-4 border-b border-border/40 min-h-[76px] relative">
                  {/* Left accent color indicator stripe */}
                  <div className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full" style={{ backgroundColor: g.color }} />
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Icon/Indicator */}
                    <div className="shrink-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-border" style={{ backgroundColor: `${g.color}15` }}>
                        <Users className="h-5 w-5" style={{ color: g.color }} />
                      </div>
                    </div>
                    
                    <div className="min-w-0">
                      <h3 className="font-bold text-base text-foreground truncate">{g.name}</h3>
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider truncate max-w-[150px]">{g.description || 'Time Operacional'}</p>
                    </div>
                  </div>
 
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="secondary" className="font-semibold bg-muted border border-border/40 px-2 py-0.5 text-xs">
                      {groupMembers.length}
                    </Badge>
                    {canManage && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g.id, g.name); }}
                        className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                        title="Excluir Grupo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Members List Section */}
                <div className="px-5 py-4 flex-1 flex flex-col gap-3 bg-muted/5 min-h-[180px]">
                  {groupMembers.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-40 group/empty hover:opacity-60 transition-opacity">
                      <div className="p-4 rounded-full bg-muted mb-3 group-hover/empty:scale-110 transition-transform">
                        <Users className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Célula Vazia</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 overflow-y-auto max-h-[300px] pr-1 custom-scrollbar">
                      {groupMembers.map(m => {
                        const user = users.find(u => u.id === m.user_id);
                        return (
                          <div 
                            key={m.id} 
                            className="flex items-center justify-between bg-card border border-border/40 px-3 py-3 rounded-xl shadow-sm hover:border-brand/30 hover:bg-muted/30 transition-all group/member"
                          >
                            <div className="flex items-center gap-3 min-w-0 pr-4">
                              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center border border-border group-hover/member:bg-brand/10 transition-colors">
                                <span className="text-[10px] font-bold text-muted-foreground group-hover/member:text-brand">
                                  {user?.profile?.display_name?.substring(0, 2).toUpperCase() || 'U'}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-foreground truncate leading-none mb-1">
                                  {user?.profile?.display_name || 'Usuário'}
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate leading-none">
                                  {user?.email || 'Sem contato'}
                                </p>
                              </div>
                            </div>
                            
                            {canManage && (
                              <button
                                onClick={() => handleRemoveMember(m.id)}
                                className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover/member:opacity-100 transition-all duration-200 shrink-0"
                                title="Remover"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                {/* Action Section */}
                {canManage && (
                  <div className="p-5 border-t border-border/40 bg-card/80 backdrop-blur-sm">
                    <Select onValueChange={(val) => handleAddMember(val, g.id)}>
                      <SelectTrigger className="w-full h-11 text-xs font-semibold rounded-xl bg-muted hover:bg-muted/80 transition-all border-border/80 hover:border-brand/40 shadow-sm">
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <div className="p-1 rounded-md bg-brand/10 text-brand">
                            <UserPlus className="h-4 w-4" />
                          </div>
                          <span>Adicionar Membro</span>
                        </div>
                      </SelectTrigger>
                      <SelectContent className="max-h-60 rounded-xl">
                        {users
                          .filter(u => !groupMembers.some(m => m.user_id === u.id))
                          .map(u => (
                            <SelectItem key={u.id} value={u.id} className="text-xs font-medium focus:bg-brand/10 focus:text-brand cursor-pointer py-2">
                              {u.profile?.display_name || u.email}
                            </SelectItem>
                          ))}
                        {users.filter(u => !groupMembers.some(m => m.user_id === u.id)).length === 0 && (
                          <div className="py-4 px-2 text-xs text-center text-muted-foreground font-medium">
                            Nenhum usuário disponível para alocação.
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
