import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions, UserRole } from '@/hooks/usePermissions';
import { apiClient as supabase } from '@/lib/api';
import { logActivity } from '@/services/apiClientService';
import { invalidateUserAvatarCache } from '@/components/ui/UserAvatar';
// Tipagem local para evitar dependência de types gerados
type Profile = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: UserRole | string | null;
  created_at: string;
  updated_at: string;
  organization_id: string | null;
  avatar_url?: string | null;
  github_url?: string | null;
  google_url?: string | null;
  website_url?: string | null;
};
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Github, Globe, Mail, Plus, X, Code, LifeBuoy, Briefcase, Shield, Eye, Tag as TagIcon, Star, Bug, Settings, CheckCircle, AlertTriangle, Database, Cpu, Server, Smartphone, Rocket, Wrench, Zap, Cloud, Lock, BookOpen, Bell, Camera, Compass, Gift, Users } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const SINGLE_TENANT = String((import.meta as any).env?.VITE_SINGLE_TENANT ?? 'true') === 'true';

// OBS: Em projetos multi-tenant, ajuste para usar tipos gerados do Supabase

const roleLabels: Record<UserRole, string> = {
  master: 'Master',
  admin: 'Administrador',
  manager: 'Gerente',
  tester: 'Testador',
  viewer: 'Visualizador',
};

const ROLE_BADGE_STYLES: Record<UserRole, { badge: string; icon: string }> = {
  master:  { badge: 'bg-amber-500/10  text-amber-500  border-amber-500/25',    icon: 'text-amber-500'  },
  admin:   { badge: 'bg-red-500/10    text-red-500    border-red-500/25',      icon: 'text-red-500'    },
  manager: { badge: 'bg-blue-500/10   text-blue-500   border-blue-500/25',     icon: 'text-blue-500'   },
  tester:  { badge: 'bg-green-500/10  text-green-500  border-green-500/25',    icon: 'text-green-500'  },
  viewer:  { badge: 'bg-muted/50 text-muted-foreground border-border/50',      icon: 'text-muted-foreground' },
};

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { role } = usePermissions();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [googleUrl, setGoogleUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState('');
  const [tags, setTags] = useState<Array<{ label: string; icon?: string; color?: string }>>([]);
  const [newTag, setNewTag] = useState('');
  const [newTagIcon, setNewTagIcon] = useState<string>('');
  const [newTagColor, setNewTagColor] = useState<string>('#10B981');
  const palette: string[] = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#A78BFA', '#14B8A6', '#F472B6', '#94A3B8'];
  const tagIconOptions: Array<{ id: string; Icon: React.ComponentType<any> | null; title: string }> = [
    { id: '', Icon: null, title: 'Sem ícone' },
    { id: 'code', Icon: Code, title: 'Code' },
    { id: 'lifebuoy', Icon: LifeBuoy, title: 'Suporte' },
    { id: 'briefcase', Icon: Briefcase, title: 'Gerência' },
    { id: 'shield', Icon: Shield, title: 'Supervisão' },
    { id: 'eye', Icon: Eye, title: 'Visualizador' },
    { id: 'tag', Icon: TagIcon, title: 'Tag' },
    { id: 'globe', Icon: Globe, title: 'Globe' },
    { id: 'github', Icon: Github, title: 'GitHub' },
    { id: 'mail', Icon: Mail, title: 'Mail' },
    { id: 'star', Icon: Star, title: 'Star' },
    { id: 'bug', Icon: Bug, title: 'Bug' },
    { id: 'settings', Icon: Settings, title: 'Settings' },
    { id: 'check', Icon: CheckCircle, title: 'Check' },
    { id: 'alert', Icon: AlertTriangle, title: 'Alerta' },
    { id: 'database', Icon: Database, title: 'Database' },
    { id: 'cpu', Icon: Cpu, title: 'CPU' },
    { id: 'server', Icon: Server, title: 'Server' },
    { id: 'phone', Icon: Smartphone, title: 'Smartphone' },
    { id: 'rocket', Icon: Rocket, title: 'Rocket' },
    { id: 'wrench', Icon: Wrench, title: 'Wrench' },
    { id: 'zap', Icon: Zap, title: 'Zap' },
    { id: 'cloud', Icon: Cloud, title: 'Cloud' },
    { id: 'lock', Icon: Lock, title: 'Lock' },
    { id: 'book', Icon: BookOpen, title: 'Book' },
    { id: 'bell', Icon: Bell, title: 'Bell' },
    { id: 'camera', Icon: Camera, title: 'Camera' },
    { id: 'compass', Icon: Compass, title: 'Compass' },
    { id: 'gift', Icon: Gift, title: 'Gift' },
  ];
  const [requestRolesOpen, setRequestRolesOpen] = useState(false);
  const [requestedRoles, setRequestedRoles] = useState<Array<'desenvolvimento' | 'suporte' | 'gerencia' | 'supervisao' | 'visualizador'>>([]);
  const [hasRoleRequest, setHasRoleRequest] = useState<boolean>(false);

  // Preferimos carregar quando abrir
  useEffect(() => {
    const load = async () => {
      if (!isOpen) return;
      try {
        setLoading(true);
        if (!user) return;

        if (SINGLE_TENANT) {
          const { data } = await supabase.auth.getUser();
          const u = data?.user;
          setEmail(u?.email || '');
          setDisplayName((u?.user_metadata as any)?.full_name || '');
          setAvatarUrl((u?.user_metadata as any)?.avatar_url || '');
          setGithubUrl((u?.user_metadata as any)?.github_url || '');
          setGoogleUrl((u?.user_metadata as any)?.google_url || '');
          setWebsiteUrl((u?.user_metadata as any)?.website_url || '');
          setProfile({
            id: u?.id || '',
            email: u?.email || '',
            display_name: (u?.user_metadata as any)?.full_name || '',
            role: (role || 'viewer') as UserRole,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            organization_id: null,
          } as Profile);
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('id, display_name, email, role, created_at, updated_at, tags, avatar_url, github_url, google_url, website_url')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error(error);
          toast({ title: 'Erro', description: 'Não foi possível carregar seu perfil.', variant: 'destructive' });
          return;
        }
        if (data) {
          setProfile(data as Profile);
          setDisplayName((data as any).display_name || '');
          setEmail((data as any).email || '');
          setAvatarUrl((data as any).avatar_url || '');
          setGithubUrl((data as any).github_url || '');
          setGoogleUrl((data as any).google_url || '');
          setWebsiteUrl((data as any).website_url || '');
          setBio((data as any).bio || '');
          setSkills((data as any).skills || '');
          
          // Fetch functional roles
          try {
            const { data: fRoles } = await supabase
              .from('profile_function_roles' as any)
              .select('role, icon')
              .eq('user_id', user.id);
            if (fRoles) {
              setRequestedRoles(fRoles.map((r: any) => r.role));
            }
          } catch (e) {
            console.error('Error fetching functional roles:', e);
          }

          // Fetch groups instead of manual tags
          try {
            const { data: mData } = await supabase
              .from('group_members' as any)
              .select('group_id')
              .eq('user_id', user.id);
            
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
        }

        // As preferências foram migradas para o SettingsModal

        

        // Verificar se já existe solicitação de cargo (apenas multi-tenant)
        if (!SINGLE_TENANT) {
          try {
            const { data: rr } = await supabase
              .from('role_requests' as any)
              .select('id, status')
              .eq('user_id', user.id)
              .maybeSingle();
            setHasRoleRequest(!!rr);
          } catch (e) {
            console.error('Error fetching role requests:', e);
            setHasRoleRequest(false);
          }
        } else {
          setHasRoleRequest(true); // desativa no single-tenant
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen, toast, user, role]);

  // Funções fora do useEffect para uso no JSX
  const addTag = () => {
    const label = newTag.trim();
    if (!label) return;
    // Limitar a 3 tags
    if (tags.length >= 3) {
      toast({ title: 'Limite de tags', description: 'Você pode ter no máximo 3 tags.', variant: 'destructive' });
      return;
    }
    setTags((prev) => [...prev, { label, icon: newTagIcon || undefined, color: newTagColor }]);
    try { logActivity('tag_added', `label=${label}`); } catch { /* ignore */ }
    setNewTag('');
    setNewTagIcon('');
    setNewTagColor('#10B981');
  };

  const removeTag = (idx: number) => {
    const t = tags[idx];
    setTags((prev) => prev.filter((_, i) => i !== idx));
    try { logActivity('tag_removed', `label=${(t as any)?.label || ''}`); } catch { /* ignore */ }
  };

  const toggleRequestedRole = (val: 'desenvolvimento' | 'suporte' | 'gerencia' | 'supervisao' | 'visualizador') => {
    setRequestedRoles((prev) => prev.includes(val) ? prev.filter(r => r !== val) : [...prev, val]);
  };

  const submitRoleRequest = async () => {
    if (SINGLE_TENANT || hasRoleRequest || requestedRoles.length === 0 || !user) return;
    try {
      const { error } = await supabase
        .from('role_requests' as any)
        .insert({
          user_id: user.id,
          // requested_role satisfaz o NOT NULL da coluna legada (primeira opção escolhida)
          requested_role: requestedRoles[0],
          // requested_roles armazena todas as opções como JSON
          requested_roles: JSON.stringify(requestedRoles),
        });
      if (error) throw error;
      setHasRoleRequest(true);
      setRequestRolesOpen(false);
      toast({ title: 'Solicitação enviada', description: 'Sua solicitação de cargo foi enviada ao Master.' });
      try { logActivity('role_request_submitted', `roles=${requestedRoles.join(',')}`, user.id); } catch { /* ignore */ }
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message || 'Não foi possível enviar a solicitação.', variant: 'destructive' });
    }
  };

  const roleName = useMemo(() => roleLabels[(profile?.role || role || 'viewer') as UserRole], [profile?.role, role]);



  const handleSave = async () => {
    if (!user) return;
    try {
      setSaving(true);
      // Salvar perfil
      const { error: profErr } = await supabase
        .from('profiles' as any)
        .update({ 
          display_name: displayName, 
          avatar_url: avatarUrl, 
          github_url: githubUrl, 
          google_url: googleUrl, 
          website_url: websiteUrl,
          bio: bio,
          skills: skills
        })
        .eq('id', user.id);
      
      if (profErr) throw profErr;

      if (SINGLE_TENANT) {
        try { await supabase.auth.updateUser({ data: { full_name: displayName, avatar_url: avatarUrl } } as any); } catch { /* ignore */ }
        toast({ title: 'Perfil atualizado', description: 'Dados salvos com sucesso.' });
        invalidateUserAvatarCache(user.id);
        try { logActivity('profile_saved', 'single_tenant'); } catch { /* ignore */ }
        return;
      }

      toast({ title: 'Perfil atualizado', description: 'Dados do seu perfil foram salvos.' });
      invalidateUserAvatarCache(user.id);
      try { logActivity('profile_saved', 'multi_tenant'); } catch { /* ignore */ }
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erro ao salvar', description: e?.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const initials = (displayName || email || 'U')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleAvatarChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    if (!user) return;
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setLoading(true);
      const ext = file.name.split('.').pop();
      const path = `avatars/${user.id}_${Date.now()}.${ext}`;
      const { data: uploadData, error: upErr } = await supabase.storage.from('public-assets').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      // Usar a URL retornada pelo servidor (não o path original do cliente)
      const serverPath = (uploadData as any)?.publicUrl || path;
      const { data: pub } = supabase.storage.from('public-assets').getPublicUrl(serverPath);
      const url = pub?.publicUrl || '';
      setAvatarUrl(url);
      // Persistir imediatamente em profiles (funciona em ambos os modos)
      const { error: profErr } = await supabase
        .from('profiles' as any)
        .update({ avatar_url: url })
        .eq('id', user.id);
      if (profErr) throw profErr;
      toast({ title: 'Avatar atualizado', description: 'Sua foto foi enviada e salva.' });
      invalidateUserAvatarCache(user.id);
      try { logActivity('avatar_updated'); } catch { /* ignore */ }
    } catch (err: any) {
      console.error(err);
      // Tratamento amigável quando bucket não existir
      const msg = err?.message || '';
      if (/bucket not found/i.test(msg) || err?.statusCode === '404') {
        toast({
          title: 'Bucket ausente',
          description: 'Crie o bucket "public-assets" (aplique a migration 20250917_storage_public_assets.sql) e tente novamente.',
          variant: 'destructive'
        });
      } else {
        toast({ title: 'Erro no upload', description: msg || 'Não foi possível enviar a foto.', variant: 'destructive' });
      }
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Meu Perfil</DialogTitle>
          <DialogDescription>Atualize suas informações públicas e preferências.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <Avatar className="h-24 w-24 border-2 border-brand/20 shadow-md">
                <AvatarImage src={avatarUrl || undefined} alt={displayName || 'Avatar'} />
                <AvatarFallback className="text-xl font-bold bg-brand/5 text-brand">{initials}</AvatarFallback>
              </Avatar>
              <label className="absolute bottom-0 right-0 p-2 bg-brand text-white rounded-full cursor-pointer shadow-lg hover:scale-110 transition-transform border-2 border-background">
                <Camera className="h-4 w-4" />
                <input type="file" className="sr-only" accept="image/*" onChange={handleAvatarChange} />
              </label>
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="text-xl font-bold">{displayName || 'Usuário'}</h3>
              <p className="text-sm text-muted-foreground">{email}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {(() => {
                  const r = ((profile?.role || role || 'viewer') as UserRole);
                  const style = ROLE_BADGE_STYLES[r] || ROLE_BADGE_STYLES.viewer;
                  return (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-widest ${style.badge}`}>
                      <Shield className={`h-3 w-3 ${style.icon}`} />
                      {roleName}
                    </span>
                  );
                })()}
                {requestedRoles.map((r, idx) => {
                  const icons: Record<string, any> = {
                    desenvolvimento: Code, suporte: LifeBuoy, gerencia: Briefcase, supervisao: Shield, visualizador: Eye
                  };
                  const IconC = icons[r] || Code;
                  const label = r.charAt(0).toUpperCase() + r.slice(1);
                  return (
                    <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-muted/40 text-foreground/70 border border-border/50 uppercase tracking-widest">
                      <IconC className="h-3 w-3" />
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="display_name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nome de Exibição</Label>
                <Input id="display_name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="bg-muted/30" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Biografia</Label>
                <textarea 
                  id="bio" 
                  value={bio} 
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Conte um pouco sobre você..."
                  className="w-full min-h-[100px] rounded-md border border-input bg-muted/30 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="skills" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Skills / Especialidades</Label>
                <Input id="skills" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, Testing, Playwright..." className="bg-muted/30" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5" /> Links Sociais
                </Label>
                <div className="space-y-3 p-3 rounded-lg border bg-muted/10">
                  <div className="flex items-center gap-3">
                    <Github className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input id="github_url" placeholder="URL do GitHub" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} className="h-8 text-xs bg-background" />
                  </div>
                  <div className="flex items-center gap-3">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted-foreground shrink-0 fill-current"><path d="M12 10.2v3.9h5.5c-.2 1.2-1.7 3.6-5.5 3.6-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.7C16.8 2.7 14.6 1.8 12 1.8 6.9 1.8 2.7 6 2.7 11.1S6.9 20.4 12 20.4c6.9 0 9.5-4.8 9.5-7.3 0-.5-.1-.8-.1-1.1H12z"/></svg>
                    <Input id="google_url" placeholder="URL do Google" value={googleUrl} onChange={(e) => setGoogleUrl(e.target.value)} className="h-8 text-xs bg-background" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input id="website_url" placeholder="URL do Website" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className="h-8 text-xs bg-background" />
                  </div>
                </div>
              </div>

              {/* Tags vinculadas aos grupos (Read-only aqui) */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" /> Seus Grupos
                </Label>
                <div className="flex flex-wrap gap-2 p-2 min-h-[40px]">
                  {tags.length > 0 ? tags.map((t, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-muted/50 text-foreground/80 border border-border/50">
                      <TagIcon className="h-3 w-3 opacity-70" style={{ color: t.color || undefined }} /> {t.label}
                    </span>
                  )) : (
                    <span className="text-[10px] text-muted-foreground italic">Nenhum grupo vinculado</span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground px-1 italic">Sincronizado automaticamente com a gestão de usuários.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
            <Button variant="outline" onClick={onClose} className="px-6">Cancelar</Button>
            <Button variant="brand" onClick={handleSave} disabled={loading || saving} className="px-8 shadow-md hover:shadow-lg transition-all">
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileModal;
