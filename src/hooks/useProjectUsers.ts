import { useEffect, useState } from 'react';
import { apiClient as supabase } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export interface ProjectUser {
  id: string;
  display_name: string | null;
  email: string;
}

// Carrega usuarios disponiveis (perfis ativos) para selects de "interessado".
// Usuario logado vai sempre primeiro com prefixo (Eu).
let _cache: ProjectUser[] | null = null;
let _inflight: Promise<ProjectUser[]> | null = null;

async function fetchUsers(): Promise<ProjectUser[]> {
  if (_cache) return _cache;
  if (_inflight) return _inflight;
  _inflight = (async () => {
    const { data } = await supabase
      .from('profiles' as any)
      .select('id, display_name, email')
      .order('display_name');
    const users = ((data as any[]) || []).map((u) => ({
      id: u.id,
      display_name: u.display_name ?? null,
      email: u.email,
    }));
    _cache = users;
    _inflight = null;
    return users;
  })();
  return _inflight;
}

export function invalidateProjectUsersCache() {
  _cache = null;
}

export function useProjectUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState<ProjectUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchUsers()
      .then((list) => {
        if (!mounted) return;
        const me = list.find((u) => u.id === user?.id);
        const others = list.filter((u) => u.id !== user?.id);
        setUsers(me ? [me, ...others] : list);
      })
      .catch(() => mounted && setUsers([]))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const labelFor = (u: ProjectUser) =>
    `${u.id === user?.id ? '(Eu) ' : ''}${u.display_name || u.email}`;

  return { users, loading, labelFor };
}
