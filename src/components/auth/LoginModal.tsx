import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, Sparkles, Building2, User, Key, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface LoginModalProps {
  onOpenRegister: () => void;
  onPreviewPublic: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onOpenRegister, onPreviewPublic }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('dirigente@aruanda.org');
  const [password, setPassword] = useState('aruanda123');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    const res = await login(email, password);
    setIsLoading(false);
    if (!res.success) {
      setErrorMessage(res.error || 'Credenciais inválidas.');
    }
  };

  const demoAccounts = [
    {
      label: 'Mãe Mariana (Dirigente)',
      house: 'Terreiro Pai Benedito de Aruanda',
      email: 'dirigente@aruanda.org',
      pass: 'aruanda123',
      role: 'dirigente',
      icon: Sparkles,
      color: 'border-emerald-600/60 bg-[#09231b]'
    },
    {
      label: 'Carlos Eduardo (Financeiro)',
      house: 'Terreiro Pai Benedito de Aruanda',
      email: 'financeiro@aruanda.org',
      pass: 'aruanda123',
      role: 'financeiro',
      icon: Key,
      color: 'border-amber-600/50 bg-[#16271a]'
    },
    {
      label: 'Pai Ogunté (Dirigente Tenant B)',
      house: 'Tenda Caboclo Pena Branca',
      email: 'dirigente@penabranca.org',
      pass: 'penabranca123',
      role: 'dirigente',
      icon: Building2,
      color: 'border-teal-600/50 bg-[#082024]'
    },
    {
      label: 'Superadministrador 7Teknologia',
      house: 'SaaS Platform Superadmin',
      email: 'admin@7teknologia.com',
      pass: 'admin123',
      role: 'superadmin',
      icon: Shield,
      color: 'border-amber-500/70 bg-[#241a08]'
    }
  ];

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center mx-auto shadow-xl shadow-amber-950/40 border border-amber-400/40 font-serif font-bold text-stone-950 text-2xl">
            7
          </div>
          <h1 className="text-2xl font-bold text-stone-100 tracking-tight">
            7 Gestão de Terreiros
          </h1>
          <div className="inline-block px-3 py-1 rounded-full bg-emerald-950/90 border border-emerald-700/50 text-xs text-amber-300 font-medium">
            Uma solução 7Teknologia.
          </div>
          <p className="text-xs text-stone-400 max-w-sm mx-auto">
            Plataforma completa de gestão administrativa, financeira e organizacional para terreiros.
          </p>
        </div>

        {/* Quick Demo Access Bar */}
        <div className="p-4 rounded-xl bg-stone-900 border border-emerald-900/50 space-y-2.5">
          <span className="text-[11px] uppercase tracking-wider font-bold text-amber-400 block text-center">
            Acesso Rápido com Contas Oficiais de Demonstração
          </span>
          <div className="grid grid-cols-1 gap-2">
            {demoAccounts.map((demo) => {
              const Icon = demo.icon;
              return (
                <button
                  key={demo.email}
                  type="button"
                  onClick={() => {
                    setEmail(demo.email);
                    setPassword(demo.pass);
                  }}
                  className={`p-2.5 rounded-lg border text-left transition-all flex items-center justify-between hover:scale-[1.01] ${demo.color} ${
                    email === demo.email ? 'ring-2 ring-amber-400' : ''
                  }`}
                >
                  <div className="truncate pr-2">
                    <div className="text-xs font-bold text-stone-100 truncate flex items-center gap-1.5">
                      <Icon size={13} className="text-amber-400 shrink-0" />
                      <span>{demo.label}</span>
                    </div>
                    <div className="text-[11px] text-stone-400 truncate">{demo.house}</div>
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-black/40 text-stone-300 shrink-0">
                    {demo.role}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Login Card */}
        <div className="p-6 rounded-2xl bg-stone-900 border border-emerald-900/40 shadow-xl space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">E-mail Cadastrado</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100 focus:outline-hidden focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Senha</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100 focus:outline-hidden focus:border-emerald-600"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-800 to-emerald-700 hover:from-emerald-700 hover:to-emerald-600 text-amber-300 border border-amber-500/40 font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? 'Autenticando no PostgreSQL...' : 'Entrar no Sistema'}
              <ArrowRight size={15} />
            </button>
          </form>

          <div className="pt-2 border-t border-stone-800 text-center space-y-2">
            <button
              onClick={onOpenRegister}
              className="text-xs text-amber-300 hover:underline font-semibold block w-full"
            >
              Cadastrar Novo Terreiro — 7 Gestão de Terreiros
            </button>
            <button
              onClick={onPreviewPublic}
              className="text-xs text-stone-400 hover:text-stone-200 block w-full"
            >
              Ver Página Pública de Inscrição em Rituais
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
