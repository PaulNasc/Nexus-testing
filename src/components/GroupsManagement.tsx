import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Users, Bell, X, UserPlus, ShieldAlert, CheckCircle2, Layout, UserCircle, Settings2, Trash2 } from 'lucide-react';

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

  const notifyOrphanUsers = async () => {
    setNotifying(true);
    // Simulating a notification process for local environment
    setTimeout(() => {
      setNotifying(false);
      toast({ title: 'Notificações Enviadas', description: 'Usuários pendentes foram notificados para realizar o onboarding.', variant: 'default' });
    }, 1500);
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
    <div className="space-y-10 pb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
      
      {/* ── Pending Users Banner ── */}
      <section className="relative group overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-500/20 dark:via-amber-500/10 dark:to-transparent rounded-2xl -z-10" />
        <div className="absolute -right-10 -top-10 h-40 w-40 bg-amber-500/5 dark:bg-amber-500/10 rounded-full blur-3xl" />
        
        <div className="border border-amber-500/20 dark:border-amber-500/30 backdrop-blur-md rounded-2xl p-6 shadow-xl shadow-amber-500/5 transition-all hover:shadow-amber-500/10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-500/20 flex items-center justify-center shadow-inner">
                <ShieldAlert className="h-6 w-6 text-amber-600 dark:text-amber-400 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  Pendências de Alocação
                  {orphanUsers.length > 0 && (
                    <Badge variant="outline" className="bg-amber-500/20 border-amber-500/40 text-amber-700 dark:text-amber-400 animate-bounce">
                      {orphanUsers.length}
                    </Badge>
                  )}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mt-1 leading-relaxed">
                  Estes usuários estão ativos no sistema mas ainda não foram vinculados a um grupo de trabalho. Usuários sem grupo podem ter acesso restrito a funcionalidades específicas.
                </p>
              </div>
            </div>
            
            {canManage && orphanUsers.length > 0 && (
              <Button 
                onClick={notifyOrphanUsers} 
                disabled={notifying}
                className="bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500 text-white font-semibold h-11 px-6 rounded-xl shadow-lg shadow-amber-600/20 transition-all active:scale-95"
              >
                {notifying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Bell className="h-4 w-4 mr-2" />}
                Solicitar Onboarding
              </Button>
            )}
          </div>
          
          {orphanUsers.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-8">
              {orphanUsers.map(u => (
                <div 
                  key={u.id} 
                  className="flex flex-col gap-4 p-4 bg-white/50 dark:bg-slate-950/50 border border-white/60 dark:border-slate-800/60 rounded-xl hover:border-amber-500/40 dark:hover:border-amber-500/40 transition-all group/user shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 group-hover/user:scale-110 transition-transform">
                      <UserCircle className="h-5 w-5 text-slate-400 group-hover/user:text-amber-500 transition-colors" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate text-slate-900 dark:text-slate-100">
                        {u.profile?.display_name || 'Usuário Pendente'}
                      </p>
                      <p className="text-[10px] font-medium text-slate-500 truncate uppercase tracking-tight">
                        {u.email}
                      </p>
                    </div>
                  </div>
                  
                  {canManage && (
                    <Select onValueChange={(val) => handleAddMember(u.id, val)}>
                      <SelectTrigger className="h-9 text-xs rounded-lg border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
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
          )}
          
          {orphanUsers.length === 0 && (
            <div className="mt-4 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-4 py-2 rounded-lg w-fit">
              <CheckCircle2 className="h-4 w-4" />
              Excelente! Todos os membros estão devidamente alocados.
            </div>
          )}
        </div>
      </section>

      {/* ── Groups Grid ── */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand/10 rounded-lg">
              <Layout className="h-5 w-5 text-brand" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Estrutura de Times</h2>
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
                className="group/card flex flex-col border border-slate-200/60 dark:border-slate-800/60 rounded-2xl bg-white dark:bg-slate-950 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-brand/5 hover:-translate-y-1 transition-all duration-300"
              >
                
                {/* Header Section */}
                <div className="p-5 flex items-center gap-4 relative overflow-hidden min-h-[80px]">
                  {/* Backdrop Gradient */}
                  <div 
                    className="absolute inset-0 opacity-10 group-hover/card:opacity-15 transition-opacity" 
                    style={{ background: `linear-gradient(135deg, ${g.color}, transparent)` }} 
                  />
                  
                  {/* Icon/Indicator */}
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center relative z-10 border border-white/20 dark:border-black/20 overflow-hidden">
                      <div className="absolute inset-0 opacity-20" style={{ backgroundColor: g.color }} />
                      <Users className="h-6 w-6 relative z-10" style={{ color: g.color }} />
                    </div>
                    {/* Shadow pulse */}
                    <div className="absolute -inset-1 rounded-xl blur-md opacity-20 animate-pulse" style={{ backgroundColor: g.color }} />
                  </div>

                  <div className="relative z-10 min-w-0 flex-1">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 truncate">{g.name}</h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">{g.description || 'Time Operacional'}</p>
                  </div>

                  <Badge variant="secondary" className="relative z-10 font-bold bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-white/40 dark:border-slate-700/40 px-2.5 py-1">
                    {groupMembers.length}
                  </Badge>
                </div>
                
                {/* Members List Section */}
                <div className="px-5 py-4 flex-1 flex flex-col gap-3 bg-slate-50/30 dark:bg-slate-900/10 min-h-[200px]">
                  {groupMembers.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-40 group/empty hover:opacity-60 transition-opacity">
                      <div className="p-4 rounded-full bg-slate-200/50 dark:bg-slate-800/50 mb-3 group-hover/empty:scale-110 transition-transform">
                        <Users className="h-10 w-10 text-slate-400" />
                      </div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">Célula Vazia</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 overflow-y-auto max-h-[300px] pr-1 custom-scrollbar">
                      {groupMembers.map(m => {
                        const user = users.find(u => u.id === m.user_id);
                        return (
                          <div 
                            key={m.id} 
                            className="flex items-center justify-between bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 px-3 py-3 rounded-xl shadow-sm hover:border-brand/30 dark:hover:border-brand/30 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all group/member"
                          >
                            <div className="flex items-center gap-3 min-w-0 pr-4">
                              <div className="h-8 w-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 group-hover/member:bg-brand/10 transition-colors">
                                <span className="text-[10px] font-bold text-slate-500 group-hover/member:text-brand">
                                  {user?.profile?.display_name?.substring(0, 2).toUpperCase() || 'U'}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate leading-none mb-1">
                                  {user?.profile?.display_name || 'Usuário'}
                                </p>
                                <p className="text-[10px] text-slate-500 truncate leading-none">
                                  {user?.email || 'Sem contato'}
                                </p>
                              </div>
                            </div>
                            
                            {canManage && (
                              <button
                                onClick={() => handleRemoveMember(m.id)}
                                className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover/member:opacity-100 transition-all duration-200 shrink-0"
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
                  <div className="p-5 border-t border-slate-100 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm">
                    <Select onValueChange={(val) => handleAddMember(val, g.id)}>
                      <SelectTrigger className="w-full h-11 text-xs font-semibold rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 transition-all border-slate-200/80 dark:border-slate-800/80 hover:border-brand/40 shadow-sm">
                        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
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
