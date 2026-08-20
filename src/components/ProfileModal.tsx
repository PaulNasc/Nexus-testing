import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions, UserRole } from '@/hooks/usePermissions';
import { apiClient as supabase } from '@/lib/api';
import { logActivity } from '@/services/apiClientService';
import { invalidateUserAvatarCache } from '@/components/ui/UserAvatar';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Github,
  Globe,
  Camera,
  Shield,
  User,
  Users,
  Code,
  Tag as TagIcon,
  Loader2,
  CheckCircle2,
  Lock,
} from 'lucide-react';

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

const SINGLE_TENANT = String((import.meta as any).env?.VITE_SINGLE_TENANT ?? 'true') === 'true';

const roleLabels: Record<UserRole, string> = {
  master: 'Master',
  admin: 'Administrador',
  manager: 'Gerente',
  tester: 'Testador',
  viewer: 'Visualizador',
};

const ROLE_BADGE_STYLES: Record<UserRole, { badge: string; icon: string }> = {
  master:  { badge: 'bg-amber-500/10  text-amber-500  border-amber-500/25', icon: 'text-amber-500' },
  admin:   { badge: 'bg-red-500/10    text-red-500    border-red-500/25',   icon: 'text-red-500' },
  manager: { badge: 'bg-blue-500/10   text-blue-500   border-blue-500/25',  icon: 'text-blue-500' },
  tester:  { badge: 'bg-green-500/10  text-green-500  border-green-500/25', icon: 'text-green-500' },
  viewer:  { badge: 'bg-muted/50      text-muted-foreground border-border/50', icon: 'text-muted-foreground' },
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

  useEffect(() => {
    const load = async () => {
      if (!isOpen || !user) return;
      try {
        setLoading(true);
        setEmail(user.email || '');

        const { data, error } = await supabase
          .from('profiles' as any)
          .select('id, display_name, email, role, avatar_url, github_url, google_url, website_url, bio, skills')
          .eq('id', user.id)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          const prof = data as any;
          setProfile(prof);
          setDisplayName(prof.display_name || user.user_metadata?.full_name || '');
          setAvatarUrl(prof.avatar_url || user.user_metadata?.avatar_url || '');
          setGithubUrl(prof.github_url || '');
          setGoogleUrl(prof.google_url || '');
          setWebsiteUrl(prof.website_url || '');
          setBio(prof.bio || '');
          setSkills(prof.skills || '');
        }

        // Buscar grupos do usuário
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

            if (gData && gData.length > 0) {
              setTags(gData.map((g: any) => ({
                label: g.name,
                color: g.color || '#3b82f6',
                icon: 'tag'
              })));
            } else {
              setTags([{ label: 'Desenvolvimento', color: '#3b82f6' }]);
            }
          } else {
            setTags([{ label: 'Desenvolvimento', color: '#3b82f6' }]);
          }
        } catch {
          setTags([{ label: 'Desenvolvimento', color: '#3b82f6' }]);
        }
      } catch (err: any) {
        console.error('Erro ao carregar perfil:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen, user]);

  const roleName = useMemo(() => roleLabels[(profile?.role || role || 'viewer') as UserRole], [profile?.role, role]);

  const handleSave = async () => {
    if (!user) return;
    try {
      setSaving(true);
      const { error: profErr } = await supabase
        .from('profiles' as any)
        .update({
          display_name: displayName,
          avatar_url: avatarUrl,
          github_url: githubUrl,
          google_url: googleUrl,
          website_url: websiteUrl,
          bio: bio,
          skills: skills,
        })
        .eq('id', user.id);

      if (profErr) throw profErr;

      if (SINGLE_TENANT) {
        try {
          await supabase.auth.updateUser({ data: { full_name: displayName, avatar_url: avatarUrl } } as any);
        } catch { /* ignore */ }
      }

      toast({ title: 'Perfil atualizado', description: 'Suas informações foram salvas com sucesso.' });
      invalidateUserAvatarCache(user.id);
      try { logActivity('profile_saved'); } catch { /* ignore */ }
      onClose();
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

      const serverPath = (uploadData as any)?.publicUrl || path;
      const { data: pub } = supabase.storage.from('public-assets').getPublicUrl(serverPath);
      const url = pub?.publicUrl || '';
      setAvatarUrl(url);

      await supabase
        .from('profiles' as any)
        .update({ avatar_url: url })
        .eq('id', user.id);

      toast({ title: 'Foto atualizada', description: 'Sua foto de perfil foi salva com sucesso.' });
      invalidateUserAvatarCache(user.id);
      try { logActivity('avatar_updated'); } catch { /* ignore */ }
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Erro no upload', description: err?.message || 'Não foi possível enviar a foto.', variant: 'destructive' });
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto scrollbar-auto-hide rounded-xl bg-card border border-border/80 p-6 shadow-xl">
        <DialogHeader className="pb-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
              <User className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground tracking-tight">
                Meu Perfil
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Atualize suas informações públicas, competências e redes
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* ─── Hero com Avatar e Identificação ─── */}
          <div className="flex items-center gap-5 p-4 rounded-xl bg-card/60 border border-border/60 shadow-2xs">
            <div className="relative group shrink-0">
              <Avatar className="h-20 w-20 border-2 border-border/80 shadow-md">
                <AvatarImage src={avatarUrl || undefined} alt={displayName || 'Avatar'} className="object-cover" />
                <AvatarFallback className="text-lg font-bold bg-brand/10 text-brand">{initials}</AvatarFallback>
              </Avatar>
              <label className="absolute -bottom-1 -right-1 p-1.5 bg-brand text-white rounded-lg cursor-pointer shadow-md hover:scale-105 transition-transform border border-background" title="Alterar foto">
                <Camera className="h-3.5 w-3.5" />
                <input type="file" className="sr-only" accept="image/*" onChange={handleAvatarChange} />
              </label>
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <h3 className="text-base font-bold text-foreground truncate">
                {displayName || 'Usuário'}
              </h3>
              <p className="text-xs text-muted-foreground truncate">{email}</p>
              
              <div className="flex items-center gap-2 pt-1">
                {(() => {
                  const r = ((profile?.role || role || 'viewer') as UserRole);
                  const style = ROLE_BADGE_STYLES[r] || ROLE_BADGE_STYLES.viewer;
                  return (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold border uppercase tracking-wider ${style.badge}`}>
                      <Shield className={`h-3 w-3 ${style.icon}`} />
                      {roleName}
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* ─── Grid de Formulário ─── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Coluna 1: Informações Básicas */}
            <div className="space-y-4">
              <div className="space-y-1.5 text-left">
                <Label htmlFor="display_name" className="text-xs font-semibold text-foreground">
                  Nome de Exibição
                </Label>
                <Input
                  id="display_name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Seu nome completo"
                  className="h-9 text-xs bg-background/60 border-border/70 rounded-md focus-visible:ring-1 focus-visible:ring-brand/40"
                />
              </div>

              <div className="space-y-1.5 text-left">
                <Label htmlFor="bio" className="text-xs font-semibold text-foreground">
                  Biografia
                </Label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Conte um pouco sobre sua atuação e foco técnico..."
                  rows={3}
                  className="w-full rounded-md border border-border/70 bg-background/60 p-2.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/40 focus-visible:border-brand"
                />
              </div>

              <div className="space-y-1.5 text-left">
                <Label htmlFor="skills" className="text-xs font-semibold text-foreground">
                  Skills / Especialidades
                </Label>
                <Input
                  id="skills"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="Ex: React, Cypress, Playwright, API Testing"
                  className="h-9 text-xs bg-background/60 border-border/70 rounded-md focus-visible:ring-1 focus-visible:ring-brand/40"
                />
              </div>
            </div>

            {/* Coluna 2: Redes e Grupos */}
            <div className="space-y-4">
              <div className="space-y-1.5 text-left">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" /> Links Sociais
                </Label>
                <div className="space-y-2.5 p-3 rounded-lg border border-border/60 bg-card/60">
                  <div className="flex items-center gap-2">
                    <Github className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                      id="github_url"
                      placeholder="URL do GitHub"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      className="h-8 text-xs bg-background/60 border-border/70 rounded-md"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted-foreground shrink-0 fill-current">
                      <path d="M12 10.2v3.9h5.5c-.2 1.2-1.7 3.6-5.5 3.6-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.7C16.8 2.7 14.6 1.8 12 1.8 6.9 1.8 2.7 6 2.7 11.1S6.9 20.4 12 20.4c6.9 0 9.5-4.8 9.5-7.3 0-.5-.1-.8-.1-1.1H12z"/>
                    </svg>
                    <Input
                      id="google_url"
                      placeholder="URL do Google"
                      value={googleUrl}
                      onChange={(e) => setGoogleUrl(e.target.value)}
                      className="h-8 text-xs bg-background/60 border-border/70 rounded-md"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                      id="website_url"
                      placeholder="URL do Website"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      className="h-8 text-xs bg-background/60 border-border/70 rounded-md"
                    />
                  </div>
                </div>
              </div>

              {/* Seus Grupos */}
              <div className="space-y-1.5 text-left">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" /> Seus Grupos
                </Label>
                <div className="p-3 rounded-lg border border-border/60 bg-card/60 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {tags.map((t, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-brand/10 text-brand border border-brand/20 shadow-2xs"
                      >
                        <TagIcon className="h-3 w-3" />
                        {t.label}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Grupos sincronizados automaticamente de acordo com as permissões de equipe.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Footer com Ações ─── */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs h-8.5 px-4 rounded-md border-border/60 hover:bg-muted/60"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="text-xs h-8.5 px-4 rounded-md bg-brand hover:bg-brand/90 text-white font-semibold shadow-xs"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                <span>Salvando...</span>
              </>
            ) : (
              'Salvar Alterações'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
