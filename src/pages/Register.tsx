import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { NexusIcon } from '@/components/branding/NexusLogo';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    if (password.length < 6) {
      setError('A senha deve conter pelo menos 6 caracteres.');
      setLoading(false);
      return;
    }

    try {
      const { error: signUpError } = await signUp(email, password, name);
      if (signUpError) {
        setError(signUpError.message || 'Erro ao criar conta de usuário.');
        setLoading(false);
      } else {
        setSuccess(true);
        setTimeout(() => navigate('/'), 1200);
      }
    } catch {
      setError('Erro inesperado ao conectar ao servidor.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 sm:p-6 relative select-none">
      <div className="relative w-full max-w-[420px] z-10 animate-page-enter">
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

        {/* ── Card Principal de Cadastro ── */}
        <div className="rounded-xl border border-border/80 bg-card/95 backdrop-blur-md p-6 sm:p-7 shadow-md">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-foreground tracking-tight">
              Criar nova conta
            </h2>
            <p className="text-xs text-muted-foreground">
              Preencha os campos para iniciar na plataforma
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            {/* Campo Nome Completo */}
            <div className="space-y-1.5 text-left">
              <label htmlFor="register-name" className="text-xs font-semibold text-foreground/90">
                Nome Completo
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="register-name"
                  type="text"
                  placeholder="Seu nome completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                  className="pl-10 h-10 text-xs bg-background/60 border-border/70 focus-visible:ring-1 focus-visible:ring-brand/40 focus-visible:border-brand rounded-md font-medium"
                />
              </div>
            </div>

            {/* Campo E-mail */}
            <div className="space-y-1.5 text-left">
              <label htmlFor="register-email" className="text-xs font-semibold text-foreground/90">
                E-mail Corporativo
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="register-email"
                  type="email"
                  placeholder="usuario@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 h-10 text-xs bg-background/60 border-border/70 focus-visible:ring-1 focus-visible:ring-brand/40 focus-visible:border-brand rounded-md font-medium"
                />
              </div>
            </div>

            {/* Campo Senha */}
            <div className="space-y-1.5 text-left">
              <div className="flex items-center justify-between">
                <label htmlFor="register-password" className="text-xs font-semibold text-foreground/90">
                  Senha de Acesso
                </label>
                <span className="text-[11px] text-muted-foreground/70">Mínimo 6 dígitos</span>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="register-password"
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

            {/* Alerta de Erro */}
            {error && (
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium animate-fadeIn">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Alerta de Sucesso */}
            {success && (
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-medium animate-fadeIn">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Conta criada com sucesso! Redirecionando...</span>
              </div>
            )}

            {/* Botão de Criação */}
            <Button
              type="submit"
              disabled={loading || success}
              className="w-full h-10 rounded-md bg-brand hover:bg-brand/90 text-white font-semibold text-xs shadow-xs transition-all flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Registrando conta...</span>
                </>
              ) : (
                <>
                  <span>Concluir Cadastro</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </form>

          {/* Link para Login */}
          <div className="mt-5 pt-4 border-t border-border/40 text-center">
            <span className="text-xs text-muted-foreground">Já possui uma conta ativa? </span>
            <Link
              to="/login"
              className="text-xs text-brand hover:underline font-semibold transition-colors"
            >
              Fazer login
            </Link>
          </div>
        </div>

        {/* Rodapé institucional */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground/60 mt-6 font-medium">
          <span>Nexus Testing</span>
          <span>•</span>
          <span className="font-mono">v1.0.0</span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Ambiente Seguro
          </span>
        </div>
      </div>
    </div>
  );
}
