import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Building2, Sparkles, X, ArrowRight, AlertCircle } from 'lucide-react';

interface RegisterModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({ onClose, onSuccess }) => {
  const { login } = useAuth();
  const [form, setForm] = useState({
    terreiroName: '',
    leaderName: '',
    email: '',
    password: '',
    phone: '',
    city: 'São Paulo',
    state: 'SP',
    tradition: 'Umbanda Sagrada',
    planCode: 'gestao'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/register-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const data = await res.json();
      if (res.ok) {
        // Auto-login
        await login(form.email, form.password);
        onSuccess();
      } else {
        setErrorMsg(data.error || 'Erro ao cadastrar terreiro.');
      }
    } catch (err: any) {
      setErrorMsg('Erro: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-stone-900 border border-emerald-800/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 bg-[#09231b] border-b border-emerald-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-amber-400" />
            <h2 className="text-base font-bold text-stone-100">Cadastrar Novo Terreiro</h2>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 mx-6 mt-4 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">
              Nome do Terreiro / Templo *
            </label>
            <input
              type="text"
              required
              value={form.terreiroName}
              onChange={(e) => setForm({ ...form, terreiroName: e.target.value })}
              className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100 focus:outline-hidden focus:border-emerald-600"
              placeholder="Ex: Tenda Espírita Vovó Maria Conga"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">
                Nome do Dirigente / Sacerdote *
              </label>
              <input
                type="text"
                required
                value={form.leaderName}
                onChange={(e) => setForm({ ...form, leaderName: e.target.value })}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100 focus:outline-hidden focus:border-emerald-600"
                placeholder="Mãe / Pai de Santo"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">
                Tradição / Matriz
              </label>
              <input
                type="text"
                value={form.tradition}
                onChange={(e) => setForm({ ...form, tradition: e.target.value })}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100 focus:outline-hidden focus:border-emerald-600"
                placeholder="Umbanda, Candomblé..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">E-mail de Acesso *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100 focus:outline-hidden focus:border-emerald-600"
                placeholder="contato@seuterreiro.org"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Senha de Acesso *</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100 focus:outline-hidden focus:border-emerald-600"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">WhatsApp</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                placeholder="(11) 98765-4321"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Cidade</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Estado</label>
              <input
                type="text"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">Plano Inicial</label>
            <select
              value={form.planCode}
              onChange={(e) => setForm({ ...form, planCode: e.target.value })}
              className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-amber-300 font-semibold"
            >
              <option value="essencial">Essencial - R$ 39,90/mês (Até 30 membros)</option>
              <option value="gestao">Gestão - R$ 79,90/mês (Até 100 membros)</option>
              <option value="completo">Completo - R$ 129,90/mês (Até 300 membros)</option>
            </select>
          </div>

          <div className="pt-3 border-t border-stone-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-stone-800 text-stone-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 text-xs font-bold rounded-lg bg-emerald-800 hover:bg-emerald-700 text-amber-300 border border-amber-500/40 shadow-sm flex items-center gap-1.5"
            >
              {isLoading ? 'Criando Terreiro no PostgreSQL...' : 'Criar Terreiro & Entrar'}
              <ArrowRight size={14} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
