import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { 
  Github, Globe, Mail, 
  Code, LifeBuoy, Briefcase, Shield, Eye, Tag as TagIcon,
  Star, Bug, Settings, CheckCircle, AlertTriangle, Database, Cpu, Server, Smartphone, Rocket, Wrench, Zap, Cloud, Lock, BookOpen, Bell, Camera, Compass, Gift
} from 'lucide-react';
import { apiClient as supabase } from '@/lib/api';

export interface PublicProfile {
  id: string;
  display_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  github_url?: string | null;
  google_url?: string | null;
  website_url?: string | null;
  tags?: any[] | null;
  role?: string | null;
  bio?: string | null;
  skills?: string | null;
}

type FunctionRole = 'desenvolvimento' | 'suporte' | 'gerencia' | 'supervisao' | 'visualizador';

type UserRole = 'master' | 'admin' | 'manager' | 'tester' | 'viewer';

const roleLabel: Record<FunctionRole, string> = {
  desenvolvimento: 'Desenvolvimento',
  suporte: 'Suporte',
  gerencia: 'Gerência',
  supervisao: 'Supervisão',
  visualizador: 'Visualizador',
};

const userRoleLabel: Record<UserRole, string> = {
  master: 'Master',
  admin: 'Administrador',
  manager: 'Gerência',
  tester: 'Testador',
  viewer: 'Visualizador',
};

const RoleIcon: Record<FunctionRole, React.ComponentType<any>> = {
  desenvolvimento: Code,
  suporte: LifeBuoy,
  gerencia: Briefcase,
  supervisao: Shield,
  visualizador: Eye,
};

const TagIconMap: Record<string, React.ComponentType<any>> = {
  '': TagIcon,
  'tag': TagIcon,
  'code': Code,
  'lifebuoy': LifeBuoy,
  'briefcase': Briefcase,
  'shield': Shield,
  'eye': Eye,
  'globe': Globe,
  'github': Github,
  'mail': Mail,
  'star': Star,
  'bug': Bug,
  'settings': Settings,
  'check': CheckCircle,
  'alert': AlertTriangle,
  'database': Database,
  'cpu': Cpu,
  'server': Server,
  'phone': Smartphone,
  'rocket': Rocket,
  'wrench': Wrench,
  'zap': Zap,
  'cloud': Cloud,
  'lock': Lock,
  'book': BookOpen,
  'bell': Bell,
  'camera': Camera,
  'compass': Compass,
  'gift': Gift,
};

export const UserProfileModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  initialProfile?: Partial<PublicProfile>;
}> = ({ isOpen, onClose, userId, initialProfile }) => {
  const SINGLE_TENANT = String((import.meta as any).env?.VITE_SINGLE_TENANT ?? 'true') === 'true';
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<PublicProfile | null>(initialProfile ? { id: userId, ...initialProfile } as PublicProfile : null);
  const [roles, setRoles] = useState<Array<{ role: FunctionRole; icon?: string }>>([]);
  const [tags, setTags] = useState<Array<{ label: string; icon?: string; color?: string }>>([]);

  useEffect(() => {
    const load = async () => {
      if (!isOpen || !userId) return;
      try {
        setLoading(true);
        // Always try profiles table first (works regardless of SINGLE_TENANT)
        try {
          const { data, error } = await supabase
            .from('profiles' as any)
            .select('id, display_name, email, avatar_url, github_url, google_url, website_url, role, bio, skills')
            .eq('id', userId)
            .maybeSingle();
          if (!error && data) {
            const effectiveRole = (data as any).role || (SINGLE_TENANT ? 'master' : 'viewer');
            setProfile({ 
              ...(data as PublicProfile), 
              role: effectiveRole,
              bio: (data as any).bio,
              skills: (data as any).skills
            });
            // Tags — Now fetched from groups and group_members
            try {
              const { data: mData } = await supabase
                .from('group_members' as any)
                .select('group_id')
                .eq('user_id', userId);
              
              if (mData && mData.length > 0) {
                const groupIds = mData.map((m: any) => m.group_id);
                const { data: gData } = await supabase
                  .from('groups' as any)
                  .select('name, color')
                  .in('id', groupIds);
                
                if (gData) {
                  setTags(gData.map((g: any) => ({
                    label: g.name,
                    color: g.color,
                    icon: 'tag'
                  })));
                }
              } else {
                setTags([]);
              }
            } catch (e) {
              console.error('Error fetching group tags:', e);
            }
            // Function roles
            try {
              const resRoles = await supabase
                .from('profile_function_roles' as any)
                .select('role, icon')
                .eq('user_id', userId);
              const list = (resRoles.data || []) as Array<{ role: FunctionRole; icon?: string }>;
              setRoles(list);
            } catch (e) {
              console.error('Error fetching function roles:', e);
            }
            return;
          }
        } catch (e) {
          console.error('Error in profiles fetch:', e);
        }
        // Fallback: auth.getUser() (covers SINGLE_TENANT when profiles table is empty)
        const { data: authData } = await supabase.auth.getUser();
        const me = authData?.user;
        if (me && me.id === userId) {
          setProfile({
            id: me.id,
            display_name: (me.user_metadata as any)?.full_name || me.email || 'Usuário',
            email: me.email || undefined,
            avatar_url: (me.user_metadata as any)?.avatar_url,
            github_url: (me.user_metadata as any)?.github_url,
            google_url: (me.user_metadata as any)?.google_url,
            website_url: (me.user_metadata as any)?.website_url,
            tags: [], // Tags handled by group fetch
            role: SINGLE_TENANT ? 'master' : (me.user_metadata as any)?.role,
            bio: (me.user_metadata as any)?.bio,
            skills: (me.user_metadata as any)?.skills,
          });
          
          // Re-fetch groups even in fallback if possible
          try {
            const { data: mData } = await supabase.from('group_members' as any).select('group_id').eq('user_id', userId);
            if (mData && mData.length > 0) {
              const groupIds = mData.map((m: any) => m.group_id);
              const { data: gData } = await supabase.from('groups' as any).select('name, color').in('id', groupIds);
              if (gData) setTags(gData.map((g: any) => ({ label: g.name, color: g.color, icon: 'tag' })));
            }
          } catch {}
          return;
        }
        // Minimal fallback
        setProfile((prev) => prev ?? { id: userId, role: SINGLE_TENANT ? 'master' : undefined } as PublicProfile);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen, userId]);

  const initials = (profile?.display_name || profile?.email || 'U')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md [&_*[aria-label='Close']]:!ring-0 [&_*[aria-label='Close']]:!ring-offset-0 [&_*[aria-label='Close']]:!outline-none [&_*[aria-label='Close']]:!focus:outline-none [&_*[aria-label='Close']]:!focus:ring-0 [&_*[aria-label='Close']]:!focus:ring-offset-0 [&_*[aria-label='Close']]:!focus-visible:outline-none [&_*[aria-label='Close']]:!focus-visible:ring-0 [&_*[aria-label='Close']]:!focus-visible:ring-offset-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Perfil de {profile?.display_name || 'Usuário'}</DialogTitle>
          <DialogDescription>Detalhes do perfil profissional e informações de contato.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center text-center gap-3">
          <Avatar className="h-24 w-24">
            <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || 'Avatar'} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <div className="text-lg font-semibold">{profile?.display_name || 'Usuário'}</div>
          </div>

          {/* Permissão e Cargo (Lado a Lado) */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
            {/* Nível de Permissão (Master, Admin, etc) */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-brand/10 text-brand border border-brand/20 uppercase tracking-widest transition-all hover:bg-brand/20">
              <Shield className="h-3 w-3 fill-brand/20" />
              ( {userRoleLabel[(profile?.role as UserRole) || 'viewer']} )
            </span>
            
            {/* Cargo de Função (Desenvolvimento, Teste, Suporte, etc) */}
            {roles.map((r, idx) => {
              const IconC = (r.icon && TagIconMap[r.icon]) ? TagIconMap[r.icon] : Code;
              return (
                <span key={`f-role-${idx}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-brand/10 text-brand border border-brand/20 uppercase tracking-widest transition-all hover:bg-brand/20">
                  <IconC className="h-3 w-3 fill-brand/20" />
                  ( {roleLabel[r.role] || r.role} )
                </span>
              );
            })}
          </div>

          {/* Ícones de links (email, GitHub, Google, website) */}
          {(profile?.email || profile?.github_url || profile?.google_url || profile?.website_url) && (
            <div className="flex items-center gap-2 mt-2">
              {profile?.email && (
                <Button asChild variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-500/10" title="Email">
                  <a href={`mailto:${profile.email}`} target="_blank" rel="noreferrer">
                    <Mail className="h-4.5 w-4.5 text-[#EA4335]" />
                  </a>
                </Button>
              )}
              {profile?.github_url && (
                <Button asChild variant="ghost" size="icon" className="h-8 w-8 hover:bg-gray-500/10" title="GitHub">
                  <a href={profile.github_url} target="_blank" rel="noreferrer">
                    <Github className="h-4.5 w-4.5 text-[#9CA3AF]" />
                  </a>
                </Button>
              )}
              {profile?.google_url && (
                <Button asChild variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-500/10" title="Google">
                  <a href={profile.google_url} target="_blank" rel="noreferrer">
                    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden="true">
                      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.2-1.7 3.6-5.5 3.6-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.7C16.8 2.7 14.6 1.8 12 1.8 6.9 1.8 2.7 6 2.7 11.1S6.9 20.4 12 20.4c6.9 0 9.5-4.8 9.5-7.3 0-.5-.1-.8-.1-1.1H12z"/>
                    </svg>
                  </a>
                </Button>
              )}
              {profile?.website_url && (
                <Button asChild variant="ghost" size="icon" className="h-8 w-8 hover:bg-sky-500/10" title="Website">
                  <a href={profile.website_url} target="_blank" rel="noreferrer">
                    <Globe className="h-4.5 w-4.5 text-[#0EA5E9]" />
                  </a>
                </Button>
              )}
            </div>
          )}

          {/* Bio e Skills */}
          {(profile?.bio || profile?.skills) && (
            <div className="mt-4 w-full text-left p-4 rounded-xl bg-muted/20 border border-border/40 space-y-3">
              {profile?.bio && (
                <p className="text-sm text-foreground/80 leading-relaxed italic">
                  "{profile.bio}"
                </p>
              )}
              {profile?.skills && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {profile.skills.split(',').map((s, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-brand/5 text-brand text-[9px] font-bold border border-brand/10 uppercase tracking-tighter">
                      {s.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {tags.length > 0 && (
            <div className="space-y-3 mt-4 w-full">
              <div className="flex items-center gap-2 justify-center">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Grupos & Tags</span>
                <div className="h-px flex-1 bg-gradient-to-r from-border via-border to-transparent" />
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {tags.map((t, idx) => {
                  const label = typeof t === 'string' ? (t as any) : (t?.label || 'tag');
                  const icon = (typeof t === 'object' && (t as any)?.icon) ? (t as any).icon : undefined;
                  const color = (typeof t === 'object' && (t as any)?.color) ? (t as any).color : undefined;
                  const iconMap: Record<string, React.ComponentType<any>> = TagIconMap;
                  const IconC = (icon && iconMap[icon]) ? iconMap[icon] : TagIcon;
                  return (
                    <span 
                      key={`tag-${idx}`} 
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-muted/50 text-foreground/80 border border-border/50 transition-all hover:bg-muted hover:text-foreground"
                    >
                      <IconC className="h-3 w-3 opacity-70" style={{ color }} /> {label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Removidos ícones de informações pessoais (email, GitHub, Google, website) */}

          

          {/* Removido o botão 'Fechar' (o X do modal já fecha) */}
        </div>
      </DialogContent>
    </Dialog>
  );
};
