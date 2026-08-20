import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { NexusIcon } from '@/components/branding/NexusLogo';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  X,
} from 'lucide-react';

export default function Login() {
  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();

  // Estados do Formulário de Login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Estados do Modal "Esqueceu a Senha"
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');

  // ── Inicialização do "Lembrar Login" via localStorage ──────────────────
  useEffect(() => {
    try {
      const savedRemember = localStorage.getItem('nexus_remember_me') === 'true';
      const savedEmail = localStorage.getItem('nexus_remember_email') || '';
      if (savedRemember && savedEmail) {
        setRememberMe(true);
        setEmail(savedEmail);
      }
    } catch {
      // Ignora erro em ambientes restritos de storage
    }
  }, []);

  // ── Submissão do Login ────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        setError('E-mail ou senha inválidos. Verifique suas credenciais.');
        setLoading(false);
      } else {
        // Tratar "Lembrar Login"
        if (rememberMe) {
          localStorage.setItem('nexus_remember_me', 'true');
          localStorage.setItem('nexus_remember_email', email);
        } else {
          localStorage.removeItem('nexus_remember_me');
          localStorage.removeItem('nexus_remember_email');
        }
        navigate('/');
      }
    } catch {
      setError('Erro ao conectar ao servidor. Tente novamente.');
      setLoading(false);
    }
  };

  // ── Recuperação de Senha ──────────────────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMessage('');
    setResetError('');

    const targetEmail = resetEmail.trim() || email.trim();
    if (!targetEmail) {
      setResetError('Por favor, informe seu e-mail cadastrado.');
      return;
    }

    try {
      setResetLoading(true);
      const { error: reqError } = await resetPassword(targetEmail);
      if (reqError) {
        setResetError('Não foi possível enviar o link de recuperação. Verifique o e-mail informado.');
      } else {
        setResetMessage(`Enviamos as instruções de recuperação para ${targetEmail}.`);
      }
    } catch {
      setResetError('Ocorreu uma falha ao solicitar recuperação de senha.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 sm:p-6 relative select-none">
      <div className="relative w-full max-w-[400px] z-10 animate-page-enter">
        {/* ── Topo: Branding & Título ── */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-card border border-border/80 p-2.5 shadow-sm mb-3.5 transition-transform hover:scale-105">
            <NexusIcon size={36} className="w-9 h-9" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Nexus Testing
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-medium">
            Plataforma de Gestão e Automação de Qualidade
          </p>
        </div>

        {/* ── Card Principal de Autenticação ── */}
        <div className="rounded-xl border border-border/80 bg-card/95 backdrop-blur-md p-6 sm:p-7 shadow-md">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-foreground tracking-tight">
              Acesse sua conta
            </h2>
            <p className="text-xs text-muted-foreground">
              Insira seus dados para entrar no sistema
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Campo E-mail */}
            <div className="space-y-1.5 text-left">
              <label htmlFor="login-email" className="text-xs font-semibold text-foreground/90">
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="login-email"
                  type="email"
                  placeholder="usuario@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="pl-10 h-10 text-xs bg-background/60 border-border/70 focus-visible:ring-1 focus-visible:ring-brand/40 focus-visible:border-brand rounded-md font-medium"
                />
              </div>
            </div>

            {/* Campo Senha */}
            <div className="space-y-1.5 text-left">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-xs font-semibold text-foreground/90">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setResetMessage('');
                    setResetError('');
                    setForgotModalOpen(true);
                  }}
                  className="text-xs text-brand hover:underline font-medium transition-colors"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 pr-10 h-10 text-xs bg-background/60 border-border/70 focus-visible:ring-1 focus-visible:ring-brand/40 focus-visible:border-brand rounded-md font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors p-1"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Checkbox "Lembrar Login" */}
            <div className="flex items-center space-x-2 pt-0.5">
              <Checkbox
                id="remember-me"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                className="data-[state=checked]:bg-brand data-[state=checked]:border-brand rounded"
              />
              <label
                htmlFor="remember-me"
                className="text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
              >
                Lembrar meu e-mail neste dispositivo
              </label>
            </div>

            {/* Alerta de Erro */}
            {error && (
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium animate-fadeIn">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Botão de Entrada */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-md bg-brand hover:bg-brand/90 text-white font-semibold text-xs shadow-xs transition-all flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </form>

          {/* Link para Cadastro */}
          <div className="mt-5 pt-4 border-t border-border/40 text-center">
            <span className="text-xs text-muted-foreground">Não possui uma conta? </span>
            <Link
              to="/register"
              className="text-xs text-brand hover:underline font-semibold transition-colors"
            >
              Criar conta agora
            </Link>
          </div>
        </div>

        {/* Rodapé institucional */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground/60 mt-6 font-medium">
          <span>Nexus Testing</span>
          <span>•</span>
          <span className="font-mono">v1.0.0</span>
          <span>•</span>
          <span>Single Tenant</span>
        </div>
      </div>

      {/* ── Modal Integrado: Recuperação de Senha ── */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-card border border-border/80 rounded-xl p-6 shadow-xl relative animate-scaleIn">
            <button
              type="button"
              onClick={() => setForgotModalOpen(false)}
              className="absolute top-4 right-4 h-7 w-7 rounded-md bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground tracking-tight">
                  Recuperar Acesso
                </h3>
                <p className="text-xs text-muted-foreground">
                  Enviaremos as instruções de recuperação
                </p>
              </div>
            </div>

            {resetMessage ? (
              <div className="space-y-4">
                <div className="flex items-start gap-2.5 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-medium">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-0.5">Instruções enviadas!</p>
                    <p>{resetMessage}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={() => setForgotModalOpen(false)}
                  className="w-full h-9 text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground"
                >
                  Voltar ao Login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <label htmlFor="reset-email" className="text-xs font-semibold text-foreground/90">
                    E-mail cadastrado
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="usuario@empresa.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      className="pl-10 h-9.5 text-xs bg-background/60 border-border/70 focus-visible:ring-1 focus-visible:ring-brand/40 focus-visible:border-brand rounded-md"
                    />
                  </div>
                </div>

                {resetError && (
                  <div className="flex items-start gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{resetError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setForgotModalOpen(false)}
                    className="h-9 px-3 text-xs"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={resetLoading}
                    className="h-9 px-4 text-xs font-semibold bg-brand hover:bg-brand/90 text-white"
                  >
                    {resetLoading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      'Enviar Instruções'
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
