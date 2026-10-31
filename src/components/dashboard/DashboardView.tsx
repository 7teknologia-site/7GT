import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardMetrics, CalendarEvent } from '../../types';
import {
  Users,
  DollarSign,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Clock,
  ExternalLink,
  Plus
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (view: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { token, activeTenantId, activeTenant } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [pendingReviews, setPendingReviews] = useState<any[]>([]);
  const [funnelStages, setFunnelStages] = useState<any[]>([]);
  const [monthlyFinancials, setMonthlyFinancials] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = async () => {
    if (!token || !activeTenantId) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/dashboard/metrics', {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        }
      });
      if (res.ok) {
        const data = await res.json();
        setMetrics(data.metrics);
        setUpcomingEvents(data.upcomingEvents || []);
        setPendingReviews(data.pendingReviews || []);
        setFunnelStages(data.funnelStages || []);
        setMonthlyFinancials(data.monthlyFinancials || []);
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token, activeTenantId]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-stone-400">
        <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-3" />
        <p className="text-sm">Calculando indicadores em tempo real no PostgreSQL...</p>
      </div>
    );
  }

  const formatBRL = (val: number = 0) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#0c2f24] via-[#081e17] to-stone-900 border border-emerald-800/40 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-amber-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-700/40 text-xs text-amber-300 font-medium mb-2">
              <Sparkles size={13} className="text-amber-400" />
              <span>{activeTenant?.house_tradition || 'Umbanda Sagrada'}</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-stone-100 tracking-tight">
              {activeTenant?.name}
            </h1>
            <p className="text-xs md:text-sm text-stone-300/80 mt-1">
              Painel integrado de gestão, finanças, CRM de visitantes e rituais a distância.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onNavigate('members')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-800 hover:bg-emerald-700 text-stone-100 border border-emerald-600/40 transition-colors shadow-sm"
            >
              <Plus size={14} /> Novo Membro
            </button>
            <button
              onClick={() => onNavigate('financial')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold transition-colors shadow-sm"
            >
              <DollarSign size={14} /> Novo Lançamento
            </button>
            <button
              onClick={() => onNavigate('rituals')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 transition-colors"
            >
              <Sparkles size={14} className="text-amber-400" /> Gestão de Rituais
            </button>
          </div>
        </div>
      </div>

      {/* Main KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Membros Ativos */}
        <div
          onClick={() => onNavigate('members')}
          className="p-5 rounded-xl bg-stone-900/90 border border-emerald-900/40 hover:border-emerald-600/50 cursor-pointer transition-all shadow-md group"
        >
          <div className="flex items-center justify-between text-stone-400 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Corrente & Membros</span>
            <div className="p-2 rounded-lg bg-emerald-950 text-emerald-400 group-hover:scale-110 transition-transform">
              <Users size={18} />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-stone-100">
            {metrics?.activeMembers || 0}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-stone-400">
            <span className="text-emerald-400 font-semibold">+{metrics?.newMembersMonth || 0} este mês</span>
            <span>• {metrics?.totalMembers || 0} total cadastrados</span>
          </div>
        </div>

        {/* Card 2: CRM & Visitantes */}
        <div
          onClick={() => onNavigate('crm')}
          className="p-5 rounded-xl bg-stone-900/90 border border-emerald-900/40 hover:border-amber-500/40 cursor-pointer transition-all shadow-md group"
        >
          <div className="flex items-center justify-between text-stone-400 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">CRM de Visitantes</span>
            <div className="p-2 rounded-lg bg-amber-950/60 text-amber-400 group-hover:scale-110 transition-transform">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-stone-100">
            {metrics?.totalContacts || 0}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-stone-400">
            <span className="text-amber-400 font-semibold">{metrics?.visitorsCount || 0} visitantes</span>
            <span>no funil de relacionamento</span>
          </div>
        </div>

        {/* Card 3: Receitas Recebidas */}
        <div
          onClick={() => onNavigate('financial')}
          className="p-5 rounded-xl bg-stone-900/90 border border-emerald-900/40 hover:border-emerald-500/40 cursor-pointer transition-all shadow-md group"
        >
          <div className="flex items-center justify-between text-stone-400 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Receitas Realizadas</span>
            <div className="p-2 rounded-lg bg-emerald-950 text-emerald-400 group-hover:scale-110 transition-transform">
              <ArrowUpRight size={18} />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-emerald-400">
            {formatBRL(metrics?.monthRevenueReceived)}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-stone-400">
            <span>A receber: <strong>{formatBRL(metrics?.accountsReceivable)}</strong></span>
          </div>
        </div>

        {/* Card 4: Saldo Líquido do Mês */}
        <div
          onClick={() => onNavigate('financial')}
          className="p-5 rounded-xl bg-stone-900/90 border border-emerald-900/40 hover:border-amber-500/40 cursor-pointer transition-all shadow-md group"
        >
          <div className="flex items-center justify-between text-stone-400 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Saldo Líquido no Mês</span>
            <div className="p-2 rounded-lg bg-emerald-950 text-amber-400 group-hover:scale-110 transition-transform">
              <DollarSign size={18} />
            </div>
          </div>
          <div className={`text-2xl md:text-3xl font-bold ${(metrics?.netMonthBalance || 0) >= 0 ? 'text-stone-100' : 'text-red-400'}`}>
            {formatBRL(metrics?.netMonthBalance)}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-stone-400">
            <span>Despesas pagas: {formatBRL(metrics?.monthExpensePaid)}</span>
          </div>
        </div>
      </div>

      {/* Alert Banner for Pending Receipts or Low Inventory */}
      {((metrics?.pendingReceiptReviews || 0) > 0 || (metrics?.lowStockCount || 0) > 0) && (
        <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-600/40 flex flex-col md:flex-row md:items-center justify-between gap-3 text-amber-200">
          <div className="flex items-center gap-3">
            <AlertCircle size={22} className="text-amber-400 shrink-0" />
            <div className="text-xs md:text-sm">
              <strong>Atenção necessária:</strong> Há{' '}
              <span className="underline font-bold text-amber-300">
                {metrics?.pendingReceiptReviews} comprovante(s) de ritual aguardando conferência
              </span>{' '}
              e {metrics?.lowStockCount} item(ns) com estoque abaixo do mínimo.
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {metrics?.pendingReceiptReviews ? (
              <button
                onClick={() => onNavigate('rituals')}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 transition-colors"
              >
                Conferir Comprovantes
              </button>
            ) : null}
            {metrics?.lowStockCount ? (
              <button
                onClick={() => onNavigate('inventory')}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-600"
              >
                Ver Estoque
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* Two Columns: Financial Performance & Upcoming Events */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Financial History & CRM Funnel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Revenue vs Expense Chart */}
          <div className="p-5 rounded-xl bg-stone-900 border border-emerald-900/40 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-stone-100 flex items-center gap-2">
                  <TrendingUp size={16} className="text-emerald-400" />
                  Evolução de Receitas vs Despesas (Últimos Meses)
                </h3>
                <p className="text-xs text-stone-400">Valores consolidados no livro caixa</p>
              </div>
              <button
                onClick={() => onNavigate('financial')}
                className="text-xs text-amber-400 hover:underline inline-flex items-center gap-1"
              >
                Abrir Financeiro <ExternalLink size={12} />
              </button>
            </div>

            {monthlyFinancials.length === 0 ? (
              <div className="py-8 text-center text-xs text-stone-500">
                Nenhum lançamento no período anterior.
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                {monthlyFinancials.map((item) => {
                  const maxVal = Math.max(
                    ...monthlyFinancials.map((m) => Math.max(Number(m.revenue), Number(m.expense))),
                    1
                  );
                  const revPct = Math.min(100, (Number(item.revenue) / maxVal) * 100);
                  const expPct = Math.min(100, (Number(item.expense) / maxVal) * 100);

                  return (
                    <div key={item.month_label} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-stone-300">{item.month_label}</span>
                        <div className="flex gap-4">
                          <span className="text-emerald-400 font-bold">
                            Entradas: {formatBRL(Number(item.revenue))}
                          </span>
                          <span className="text-red-400 font-bold">
                            Saídas: {formatBRL(Number(item.expense))}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 h-3.5 bg-stone-950 rounded-full overflow-hidden p-0.5 border border-stone-800">
                        {/* Revenue Bar */}
                        <div className="flex justify-end">
                          <div
                            style={{ width: `${revPct}%` }}
                            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-sm"
                          />
                        </div>
                        {/* Expense Bar */}
                        <div>
                          <div
                            style={{ width: `${expPct}%` }}
                            className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-sm"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CRM Funnel Overview */}
          <div className="p-5 rounded-xl bg-stone-900 border border-emerald-900/40 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-stone-100 flex items-center gap-2">
                  <Users size={16} className="text-amber-400" />
                  Funil de Relacionamento & Integração (CRM)
                </h3>
                <p className="text-xs text-stone-400">Fluxo de acolhimento de visitantes e novos filhos de fé</p>
              </div>
              <button
                onClick={() => onNavigate('crm')}
                className="text-xs text-amber-400 hover:underline inline-flex items-center gap-1"
              >
                Abrir Kanban <ExternalLink size={12} />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {funnelStages.map((stage) => (
                <div
                  key={stage.id}
                  className="p-3 rounded-lg bg-stone-950/80 border border-stone-800 flex flex-col items-center text-center"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full mb-1.5"
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className="text-xs font-semibold text-stone-300 line-clamp-1">
                    {stage.name}
                  </span>
                  <span className="text-lg font-bold text-amber-300 mt-1">
                    {stage.contact_count || 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): Upcoming Events & Pending Rituals */}
        <div className="space-y-6">
          {/* Upcoming Events / Giras */}
          <div className="p-5 rounded-xl bg-stone-900 border border-emerald-900/40 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-stone-100 flex items-center gap-2">
                <Calendar size={16} className="text-emerald-400" />
                Próximas Giras e Atividades
              </h3>
              <button
                onClick={() => onNavigate('calendar')}
                className="text-xs text-amber-400 hover:underline"
              >
                Ver Todas
              </button>
            </div>

            {upcomingEvents.length === 0 ? (
              <p className="text-xs text-stone-500 py-4">Nenhum evento agendado para os próximos dias.</p>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((evt) => {
                  const date = new Date(evt.start_time);
                  return (
                    <div
                      key={evt.id}
                      className="p-3 rounded-lg bg-stone-950/80 border border-stone-800 hover:border-emerald-700/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="truncate">
                          <h4 className="text-xs font-bold text-stone-200 truncate">{evt.title}</h4>
                          <div className="flex items-center gap-1.5 text-[11px] text-amber-300/80 mt-1">
                            <Clock size={11} />
                            <span>
                              {date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às{' '}
                              {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                          {evt.is_public ? 'Pública' : 'Fechada'}
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-400 mt-2 truncate">
                        Local: {evt.location || 'Templo Principal'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pending Ritual Reviews Card */}
          <div className="p-5 rounded-xl bg-stone-900 border border-emerald-900/40 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-stone-100 flex items-center gap-2">
                <Sparkles size={16} className="text-amber-400" />
                Comprovantes a Conferir
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                {pendingReviews.length}
              </span>
            </div>

            {pendingReviews.length === 0 ? (
              <div className="text-center py-6 text-xs text-stone-400 flex flex-col items-center">
                <CheckCircle2 size={24} className="text-emerald-400 mb-2" />
                Todos os comprovantes estão em dia!
              </div>
            ) : (
              <div className="space-y-2.5">
                {pendingReviews.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg bg-stone-950 border border-amber-600/30 flex items-center justify-between gap-2"
                  >
                    <div className="truncate">
                      <div className="text-xs font-bold text-stone-200 truncate">
                        {item.participant_name}
                      </div>
                      <div className="text-[11px] text-amber-300 font-medium">
                        {formatBRL(item.amount_paid)} • {item.registration_code}
                      </div>
                    </div>
                    <button
                      onClick={() => onNavigate('rituals')}
                      className="px-2.5 py-1 text-xs font-bold rounded bg-amber-500 hover:bg-amber-400 text-stone-950 shrink-0"
                    >
                      Aprovar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
