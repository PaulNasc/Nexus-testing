import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import KrigzisLogo from '@/components/branding/KrigzisLogo';
import { Eye, EyeOff, ArrowRight, Mail, Lock } from 'lucide-react';

export default function Login() {
  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { error } = await signIn(email, password);
      if (error) {
        setError('E-mail ou senha inválidos.');
      } else {
        navigate('/');
      }
    } catch {
      setError('Erro ao tentar entrar.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setResetMessage('');
    setError('');
    if (!email) {
      setError('Informe seu e-mail para enviar o link de recuperação.');
      return;
    }
    try {
      setResetLoading(true);
      const { error } = await resetPassword(email);
      if (error) {
        setError('Não foi possível enviar o e-mail de recuperação. Tente novamente.');
      } else {
        setResetMessage('Enviamos um link de recuperação para o seu e-mail.');
      }
    } catch {
      setError('Ocorreu um erro ao solicitar a recuperação de senha.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--brand)/0.08),transparent)]" />

      <div className="relative w-full max-w-sm mx-4">
        {/* Logo + Title */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <KrigzisLogo size={28} className="h-7 w-7" />
            <span className="text-xl font-semibold tracking-tight text-foreground">Nexus Testing</span>
          </div>
          <p className="text-sm text-muted-foreground">Entre com suas credenciais para continuar</p>
        </div>

        {/* Form Card */}
        <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-6 shadow-sm">
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input
                  id="login-email"
                  type="email"
                  placeholder="nome@empresa.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="pl-10 h-10 bg-background/50 border-border/50 focus:border-brand/50 focus:ring-1 focus:ring-brand/20"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Senha</label>
                <button
                  type="button"
                  className="text-xs text-brand/80 hover:text-brand transition-colors"
                  onClick={handleResetPassword}
                  disabled={resetLoading}
                >
                  {resetLoading ? 'Enviando...' : 'Esqueceu?'}
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="pl-10 pr-10 h-10 bg-background/50 border-border/50 focus:border-brand/50 focus:ring-1 focus:ring-brand/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error / Success */}
            {error && (
              <div className="text-destructive text-xs text-center bg-destructive/5 border border-destructive/10 rounded-lg py-2 px-3">
                {error}
              </div>
            )}
            {resetMessage && (
              <div className="text-emerald-500 text-xs text-center bg-emerald-500/5 border border-emerald-500/10 rounded-lg py-2 px-3">
                {resetMessage}
              </div>
            )}

            {/* Submit */}
            <Button
              className="w-full h-10 font-medium transition-all duration-200"
              variant="brand"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Entrando...' : (
                <>
                  Entrar
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </>
              )}
            </Button>
          </form>

          {/* Register link */}
          <div className="mt-5 pt-4 border-t border-border/40 text-center">
            <span className="text-xs text-muted-foreground">Não tem uma conta? </span>
            <a href="/register" className="text-xs text-brand hover:text-brand/80 font-medium transition-colors">
              Cadastre-se
            </a>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-muted-foreground/50 mt-6">
          © {new Date().getFullYear()} Nexus Testing — v1.0.0
        </p>
      </div>
    </div>
  );
}
