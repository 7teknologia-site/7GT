import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  DollarSign,
  Users,
  Sparkles,
  ShieldAlert,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  X
} from 'lucide-react';

export const SuperadminView: React.FC = () => {
  const { token } = useAuth();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [newPlanId, setNewPlanId] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchOverview = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Error fetching superadmin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [token]);

  const handleToggleStatus = async (tenantId: string, currentStatus: boolean) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/toggle-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: !currentStatus })
      });

      if (res.ok) {
        setFeedback('Status do terreiro atualizado com sucesso.');
        fetchOverview();
      }
    } catch (err) {
      console.error('Toggle status error:', err);
    }
  };

  const handleChangePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedTenant || !newPlanId) return;

    try {
      const res = await fetch(`/api/admin/tenants/${selectedTenant.id}/plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ plan_id: newPlanId })
      });

      if (res.ok) {
        setFeedback('Plano comercial do terreiro alterado com sucesso.');
        setSelectedTenant(null);
        fetchOverview();
      }
    } catch (err) {
      console.error('Change plan error:', err);
    }
  };

  const formatBRL = (val: number = 0) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  if (isLoading) {
    return (
      <div className="py-12 text-center text-xs text-stone-400">
        Carregando console executivo — 7 Gestão de Terreiros (7Teknologia)...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold mb-2">
          <Building2 size={14} /> Console Executivo 7Teknologia
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-stone-100">
          Painel SaaS — 7 Gestão de Terreiros
        </h1>
        <p className="text-xs md:text-sm text-stone-400 mt-1">
          Plataforma completa de gestão administrativa, financeira e organizacional para terreiros. Uma solução 7Teknologia.
        </p>
      </div>

      {feedback && (
        <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-stone-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Global KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-stone-900 border border-emerald-900/40">
          <span className="text-xs text-stone-400">Total de Casas / Terreiros</span>
          <div className="text-2xl font-bold text-stone-100 mt-1">{data?.metrics?.totalTenants || 0}</div>
          <span className="text-xs text-emerald-400 font-semibold">{data?.metrics?.activeTenants || 0} ativos</span>
        </div>

        <div className="p-5 rounded-xl bg-stone-900 border border-emerald-900/40">
          <span className="text-xs text-stone-400">MRR (Faturamento Mensal)</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {formatBRL(data?.metrics?.mrr)}
          </div>
          <span className="text-xs text-stone-400">Planos ativos no SaaS</span>
        </div>

        <div className="p-5 rounded-xl bg-stone-900 border border-emerald-900/40">
          <span className="text-xs text-stone-400">Comunidade Global Atendida</span>
          <div className="text-2xl font-bold text-amber-300 mt-1">{data?.metrics?.totalMembers || 0}</div>
          <span className="text-xs text-stone-400">Membros cadastrados</span>
        </div>

        <div className="p-5 rounded-xl bg-stone-900 border border-emerald-900/40">
          <span className="text-xs text-stone-400">Rituais Realizados na Plataforma</span>
          <div className="text-2xl font-bold text-stone-100 mt-1">{data?.metrics?.totalRituals || 0}</div>
          <span className="text-xs text-stone-400">Trabalhos coletivos</span>
        </div>
      </div>

      {/* Commercial Plans Catalog */}
      <div className="p-5 rounded-2xl bg-stone-900 border border-emerald-900/40 shadow-lg space-y-4">
        <h2 className="text-sm font-bold text-stone-100">Catálogo de Planos Oficiais</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {data?.plans?.map((p: any) => (
            <div key={p.id} className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-stone-200">{p.name}</span>
                <span className="text-xs font-bold text-amber-300">{formatBRL(p.price_monthly)}/mês</span>
              </div>
              <div className="text-xs text-stone-400">
                Até <strong>{p.max_members}</strong> membros na corrente
              </div>
              <div className="text-xs text-stone-400">
                Até <strong>{p.max_rituals_per_month}</strong> rituais/mês
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tenants Management Table */}
      <div className="rounded-xl bg-stone-900 border border-emerald-900/40 overflow-hidden shadow-lg">
        <div className="p-4 bg-[#09231b] border-b border-emerald-900/50">
          <h3 className="text-sm font-bold text-stone-100">Terreiros Cadastrados no SaaS</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-stone-950 text-stone-400 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Terreiro / Slug</th>
                <th className="py-3 px-4">Localização</th>
                <th className="py-3 px-4">Plano Atual</th>
                <th className="py-3 px-4">Membros</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800">
              {data?.tenants?.map((t: any) => (
                <tr key={t.id} className="hover:bg-emerald-950/20 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-stone-100">{t.name}</div>
                    <div className="text-xs text-stone-500 font-mono">/r/{t.slug}</div>
                  </td>
                  <td className="py-3 px-4 text-xs text-stone-300">
                    {t.address_city} - {t.address_state}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs font-bold text-amber-300 px-2 py-0.5 rounded bg-stone-950 border border-stone-800">
                      {t.plan_name || 'Gestão'} ({formatBRL(t.price_monthly)})
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-stone-200 text-xs">{t.members_count || 0}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        t.is_active
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                          : 'bg-red-950 text-red-300 border-red-800'
                      }`}
                    >
                      {t.is_active ? 'Ativo' : 'Suspenso'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      onClick={() => {
                        setSelectedTenant(t);
                        setNewPlanId(t.plan_id || 'plan_gestao');
                      }}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-stone-800 hover:bg-stone-700 text-stone-200"
                    >
                      Mudar Plano
                    </button>
                    <button
                      onClick={() => handleToggleStatus(t.id, t.is_active)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded ${
                        t.is_active
                          ? 'bg-red-950 text-red-300 hover:bg-red-900'
                          : 'bg-emerald-950 text-emerald-300 hover:bg-emerald-900'
                      }`}
                    >
                      {t.is_active ? 'Suspender' : 'Reativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Change Plan Modal */}
      {selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-stone-900 border border-emerald-800/60 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 bg-[#09231b] border-b border-emerald-900/50 flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-100">Alterar Plano Comercial</h3>
              <button onClick={() => setSelectedTenant(null)} className="text-stone-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleChangePlan} className="p-5 space-y-4">
              <div className="text-xs text-stone-300">
                Terreiro: <strong className="text-amber-300">{selectedTenant.name}</strong>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Selecione o Novo Plano</label>
                <select
                  value={newPlanId}
                  onChange={(e) => setNewPlanId(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                >
                  {data?.plans?.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} - {formatBRL(p.price_monthly)}/mês (Até {p.max_members} membros)
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTenant(null)}
                  className="px-3 py-1.5 text-xs bg-stone-800 text-stone-300 rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-emerald-800 hover:bg-emerald-700 text-amber-300 rounded border border-amber-500/40"
                >
                  Confirmar Alteração
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
