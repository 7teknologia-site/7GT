import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FinancialAccount, FinancialCategory, FinancialTransaction } from '../../types';
import {
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  ArrowLeftRight,
  Download,
  Filter,
  CheckCircle,
  AlertCircle,
  Clock,
  X,
  CreditCard,
  Building
} from 'lucide-react';

export const FinancialView: React.FC = () => {
  const { token, activeTenantId, hasRole } = useAuth();
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [reportSummary, setReportSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Modals
  const [isTxnModalOpen, setIsTxnModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [partialModalTxn, setPartialModalTxn] = useState<FinancialTransaction | null>(null);
  const [partialAmountInput, setPartialAmountInput] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Transaction Form
  const [txnForm, setTxnForm] = useState({
    account_id: '',
    category_id: '',
    type: 'revenue' as 'revenue' | 'expense',
    amount: '',
    description: '',
    due_date: new Date().toISOString().slice(0, 10),
    payment_date: new Date().toISOString().slice(0, 10),
    status: 'completed' as 'pending' | 'completed',
    payment_method: 'pix',
    payer_or_payee: '',
    notes: ''
  });

  // Transfer Form
  const [transferForm, setTransferForm] = useState({
    source_account_id: '',
    destination_account_id: '',
    amount: '',
    description: 'Transferência de saldo interna'
  });

  const fetchData = async () => {
    if (!token || !activeTenantId) return;
    setIsLoading(true);
    try {
      const [accRes, catRes, sumRes] = await Promise.all([
        fetch('/api/financial/accounts', { headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Id': activeTenantId } }),
        fetch('/api/financial/categories', { headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Id': activeTenantId } }),
        fetch('/api/financial/reports/summary', { headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Id': activeTenantId } })
      ]);

      if (accRes.ok) {
        const accData = await accRes.json();
        setAccounts(accData);
        if (accData.length > 0 && !txnForm.account_id) {
          setTxnForm((prev) => ({ ...prev, account_id: accData[0].id }));
        }
      }

      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData);
        if (catData.length > 0 && !txnForm.category_id) {
          setTxnForm((prev) => ({ ...prev, category_id: catData[0].id }));
        }
      }

      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setReportSummary(sumData);
      }

      await fetchTransactions();
    } catch (err) {
      console.error('Error fetching financial data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTransactions = async () => {
    if (!token || !activeTenantId) return;
    const queryParams = new URLSearchParams();
    if (typeFilter !== 'all') queryParams.append('type', typeFilter);
    if (statusFilter !== 'all') queryParams.append('status', statusFilter);
    if (search) queryParams.append('search', search);

    const res = await fetch(`/api/financial/transactions?${queryParams.toString()}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Id': activeTenantId }
    });
    if (res.ok) {
      const data = await res.json();
      setTransactions(data);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, activeTenantId]);

  useEffect(() => {
    fetchTransactions();
  }, [typeFilter, statusFilter, search]);

  const handleCreateTxn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeTenantId) return;

    try {
      const res = await fetch('/api/financial/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        },
        body: JSON.stringify(txnForm)
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', text: 'Lançamento financeiro registrado com sucesso!' });
        setIsTxnModalOpen(false);
        setTxnForm({
          account_id: accounts[0]?.id || '',
          category_id: categories[0]?.id || '',
          type: 'revenue',
          amount: '',
          description: '',
          due_date: new Date().toISOString().slice(0, 10),
          payment_date: new Date().toISOString().slice(0, 10),
          status: 'completed',
          payment_method: 'pix',
          payer_or_payee: '',
          notes: ''
        });
        fetchData();
      } else {
        setFeedback({ type: 'error', text: data.error || 'Erro ao criar lançamento.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: 'Erro: ' + err.message });
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeTenantId) return;

    try {
      const res = await fetch('/api/financial/transfers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        },
        body: JSON.stringify(transferForm)
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', text: 'Transferência entre contas realizada!' });
        setIsTransferModalOpen(false);
        setTransferForm({ source_account_id: '', destination_account_id: '', amount: '', description: '' });
        fetchData();
      } else {
        setFeedback({ type: 'error', text: data.error || 'Erro ao transferir.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: 'Erro: ' + err.message });
    }
  };

  const handleSettle = async (id: string) => {
    if (!token || !activeTenantId) return;
    try {
      const res = await fetch(`/api/financial/transactions/${id}/settle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        },
        body: JSON.stringify({ payment_date: new Date().toISOString().slice(0, 10) })
      });

      if (res.ok) {
        setFeedback({ type: 'success', text: 'Lançamento baixado com sucesso!' });
        fetchData();
      }
    } catch (err) {
      console.error('Settle error:', err);
    }
  };

  const handleReverseTxn = async (id: string) => {
    if (!token || !activeTenantId) return;
    const reason = window.prompt('Informe a justificativa do estorno / cancelamento contábil:');
    if (!reason) return;

    try {
      const res = await fetch(`/api/financial/transactions/${id}/reverse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        },
        body: JSON.stringify({ reason })
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', text: 'Lançamento estornado e saldo reajustado no banco!' });
        fetchData();
      } else {
        setFeedback({ type: 'error', text: data.error || 'Erro ao estornar.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: 'Erro de conexão: ' + err.message });
    }
  };

  const handlePartialSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeTenantId || !partialModalTxn) return;

    try {
      const res = await fetch(`/api/financial/transactions/${partialModalTxn.id}/partial-settle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        },
        body: JSON.stringify({
          partial_amount: partialAmountInput,
          payment_date: new Date().toISOString().slice(0, 10)
        })
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', text: data.message });
        setPartialModalTxn(null);
        setPartialAmountInput('');
        fetchData();
      } else {
        setFeedback({ type: 'error', text: data.error || 'Erro na baixa parcial.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: 'Erro: ' + err.message });
    }
  };

  const formatBRL = (val: number = 0) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-stone-100 flex items-center gap-2">
            <DollarSign className="text-emerald-400" />
            Gestão Financeira & Livro Caixa
          </h1>
          <p className="text-xs md:text-sm text-stone-400 mt-1">
            Controle de contribuições, mensalidades da corrente, doações, despesas do templo e prestação de contas.
          </p>
        </div>

        {hasRole(['dirigente', 'admin_casa', 'financeiro']) && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsTransferModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-700 shadow-xs"
            >
              <ArrowLeftRight size={14} /> Transferência Interna
            </button>
            <button
              onClick={() => setIsTxnModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-800 hover:bg-emerald-700 text-amber-300 border border-amber-500/40 shadow-sm"
            >
              <Plus size={16} /> Novo Lançamento
            </button>
          </div>
        )}
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
              : 'bg-red-950/60 text-red-300 border border-red-800/40'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-stone-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Financial Accounts Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="p-5 rounded-xl bg-stone-900 border border-emerald-900/40 shadow-md flex items-center justify-between"
          >
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                {acc.type === 'bank' ? 'Conta Bancária' : acc.type === 'cash' ? 'Caixa Físico' : 'Conta PIX'}
              </span>
              <h3 className="text-sm font-bold text-stone-100 mt-0.5">{acc.name}</h3>
              <div className="text-xs text-stone-400 mt-1">{acc.bank_name || 'Tesouraria da Casa'}</div>
            </div>
            <div className="text-right">
              <span className="text-xs text-stone-400 block">Saldo Real</span>
              <span className="text-lg font-bold text-emerald-400">{formatBRL(acc.current_balance)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Summary KPI Strip */}
      {reportSummary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-stone-900 border border-emerald-900/40 flex items-center justify-between">
            <div>
              <span className="text-xs text-stone-400">Total de Entradas (Receitas)</span>
              <div className="text-xl font-bold text-emerald-400 mt-1">
                {formatBRL(reportSummary.totals?.revenue)}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-950 text-emerald-400">
              <ArrowUpRight size={20} />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-stone-900 border border-emerald-900/40 flex items-center justify-between">
            <div>
              <span className="text-xs text-stone-400">Total de Saídas (Despesas)</span>
              <div className="text-xl font-bold text-red-400 mt-1">
                {formatBRL(reportSummary.totals?.expense)}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-red-950/60 text-red-400">
              <ArrowDownRight size={20} />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-stone-900 border border-emerald-900/40 flex items-center justify-between">
            <div>
              <span className="text-xs text-stone-400">Resultado Líquido do Período</span>
              <div
                className={`text-xl font-bold mt-1 ${
                  reportSummary.totals?.net >= 0 ? 'text-amber-300' : 'text-red-400'
                }`}
              >
                {formatBRL(reportSummary.totals?.net)}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-950/60 text-amber-400">
              <DollarSign size={20} />
            </div>
          </div>
        </div>
      )}

      {/* Filters Strip */}
      <div className="p-4 rounded-xl bg-stone-900 border border-emerald-900/40 shadow-md flex flex-col md:flex-row items-center gap-3">
        <div className="flex-1 w-full">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por descrição ou pagador/fornecedor..."
            className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs md:text-sm text-stone-100 placeholder-stone-500 focus:outline-hidden focus:border-emerald-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-300"
          >
            <option value="all">Todas as Operações</option>
            <option value="revenue">Apenas Receitas (+)</option>
            <option value="expense">Apenas Despesas (-)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-300"
          >
            <option value="all">Todos os Status</option>
            <option value="completed">Baixados / Pagos</option>
            <option value="pending">Pendentes</option>
          </select>
        </div>
      </div>

      {/* Transactions Ledger */}
      <div className="rounded-xl bg-stone-900 border border-emerald-900/40 overflow-hidden shadow-lg">
        {transactions.length === 0 ? (
          <div className="py-12 text-center text-xs text-stone-500">
            Nenhum lançamento financeiro encontrado com os filtros atuais.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-[#09231b] border-b border-emerald-900/50 text-emerald-300 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Data Venc.</th>
                  <th className="py-3 px-4">Descrição & Categoria</th>
                  <th className="py-3 px-4">Conta</th>
                  <th className="py-3 px-4">Pagador / Favorecido</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800">
                {transactions.map((t) => {
                  const isRevenue = t.type === 'revenue';
                  return (
                    <tr key={t.id} className="hover:bg-emerald-950/20 transition-colors">
                      <td className="py-3 px-4 text-stone-300 font-mono">
                        {new Date(t.due_date).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-stone-100">{t.description}</div>
                        <div className="text-xs text-amber-300/80">{t.category_name}</div>
                      </td>
                      <td className="py-3 px-4 text-stone-300 text-xs">{t.account_name}</td>
                      <td className="py-3 px-4 text-stone-400 text-xs">{t.payer_or_payee || '-'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            t.status === 'completed'
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-700/50'
                              : 'bg-amber-950 text-amber-300 border-amber-600/50'
                          }`}
                        >
                          {t.status === 'completed' ? 'Baixado' : 'Pendente'}
                        </span>
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-bold font-mono text-sm ${
                          isRevenue ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {isRevenue ? '+' : '-'} {formatBRL(t.amount)}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {t.status === 'pending' && hasRole(['dirigente', 'admin_casa', 'financeiro']) && (
                          <>
                            <button
                              onClick={() => handleSettle(t.id)}
                              className="px-2 py-1 text-xs font-bold rounded bg-emerald-800 hover:bg-emerald-700 text-amber-300 border border-amber-500/30"
                              title="Baixar valor integral"
                            >
                              Baixar
                            </button>
                            <button
                              onClick={() => {
                                setPartialModalTxn(t);
                                setPartialAmountInput('');
                              }}
                              className="px-2 py-1 text-xs font-semibold rounded bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700"
                              title="Baixa parcial de valor"
                            >
                              Parcial
                            </button>
                          </>
                        )}
                        {t.status !== 'cancelled' && hasRole(['dirigente', 'admin_casa', 'financeiro']) && (
                          <button
                            onClick={() => handleReverseTxn(t.id)}
                            className="px-2 py-1 text-xs font-semibold rounded bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800/50"
                            title="Estornar e cancelar lançamento"
                          >
                            Estornar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Transaction Modal */}
      {isTxnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-stone-900 border border-emerald-800/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-[#09231b] border-b border-emerald-900/50 flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-100 flex items-center gap-2">
                <DollarSign size={18} className="text-amber-400" />
                Registrar Lançamento Financeiro
              </h3>
              <button onClick={() => setIsTxnModalOpen(false)} className="text-stone-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTxn} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTxnForm({ ...txnForm, type: 'revenue' })}
                  className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                    txnForm.type === 'revenue'
                      ? 'bg-emerald-800 border-emerald-500 text-stone-100'
                      : 'bg-stone-950 border-stone-800 text-stone-400'
                  }`}
                >
                  Receita (+)
                </button>
                <button
                  type="button"
                  onClick={() => setTxnForm({ ...txnForm, type: 'expense' })}
                  className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                    txnForm.type === 'expense'
                      ? 'bg-red-900 border-red-500 text-stone-100'
                      : 'bg-stone-950 border-stone-800 text-stone-400'
                  }`}
                >
                  Despesa (-)
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Descrição *</label>
                <input
                  type="text"
                  required
                  value={txnForm.description}
                  onChange={(e) => setTxnForm({ ...txnForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                  placeholder="Ex: Mensalidades da corrente ou Conta de Energia"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Valor (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={txnForm.amount}
                    onChange={(e) => setTxnForm({ ...txnForm, amount: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Data Vencimento *</label>
                  <input
                    type="date"
                    required
                    value={txnForm.due_date}
                    onChange={(e) => setTxnForm({ ...txnForm, due_date: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Conta Bancária / Caixa</label>
                  <select
                    value={txnForm.account_id}
                    onChange={(e) => setTxnForm({ ...txnForm, account_id: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-100"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Categoria Financeira</label>
                  <select
                    value={txnForm.category_id}
                    onChange={(e) => setTxnForm({ ...txnForm, category_id: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-100"
                  >
                    {categories
                      .filter((c) => c.type === txnForm.type)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Pagador ou Fornecedor</label>
                  <input
                    type="text"
                    value={txnForm.payer_or_payee}
                    onChange={(e) => setTxnForm({ ...txnForm, payer_or_payee: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-100"
                    placeholder="Nome da pessoa ou empresa"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Status da Operação</label>
                  <select
                    value={txnForm.status}
                    onChange={(e: any) => setTxnForm({ ...txnForm, status: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-100"
                  >
                    <option value="completed">Já Realizado / Baixado</option>
                    <option value="pending">Pendente / A Vencer</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsTxnModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-stone-800 text-stone-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-emerald-800 hover:bg-emerald-700 text-amber-300 border border-amber-500/40 shadow-sm"
                >
                  Salvar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Internal Transfer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-stone-900 border border-emerald-800/60 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 bg-[#09231b] border-b border-emerald-900/50 flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-100 flex items-center gap-2">
                <ArrowLeftRight size={18} className="text-amber-400" />
                Transferência Entre Contas da Casa
              </h3>
              <button onClick={() => setIsTransferModalOpen(false)} className="text-stone-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleTransfer} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Conta de Origem (Saída)</label>
                <select
                  required
                  value={transferForm.source_account_id}
                  onChange={(e) => setTransferForm({ ...transferForm, source_account_id: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-100"
                >
                  <option value="">Selecione a conta...</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} (Saldo: {formatBRL(a.current_balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Conta de Destino (Entrada)</label>
                <select
                  required
                  value={transferForm.destination_account_id}
                  onChange={(e) => setTransferForm({ ...transferForm, destination_account_id: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-100"
                >
                  <option value="">Selecione a conta...</option>
                  {accounts
                    .filter((a) => a.id !== transferForm.source_account_id)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Valor da Transferência (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={transferForm.amount}
                  onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                  placeholder="0.00"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-3 py-1.5 text-xs bg-stone-800 text-stone-300 rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-emerald-800 hover:bg-emerald-700 text-amber-300 rounded border border-amber-500/40"
                >
                  Transferir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Partial Settlement Modal */}
      {partialModalTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-stone-900 border border-emerald-800/60 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 bg-[#09231b] border-b border-emerald-900/50 flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-100 flex items-center gap-2">
                <DollarSign size={18} className="text-amber-400" />
                Registrar Baixa Parcial
              </h3>
              <button onClick={() => setPartialModalTxn(null)} className="text-stone-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handlePartialSettleSubmit} className="p-5 space-y-4">
              <div className="p-3 rounded-lg bg-stone-950 border border-stone-800 space-y-1 text-xs">
                <div className="text-stone-400">Lançamento: <strong className="text-stone-200">{partialModalTxn.description}</strong></div>
                <div className="text-stone-400">Valor Total Pendente: <strong className="text-amber-300">{formatBRL(partialModalTxn.amount)}</strong></div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">
                  Valor Pago Nesta Parcela (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={partialAmountInput}
                  onChange={(e) => setPartialAmountInput(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100 font-bold"
                  placeholder="0.00"
                />
                <span className="text-[10px] text-stone-500 mt-1 block">
                  O valor restante permanecerá em aberto automaticamente.
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPartialModalTxn(null)}
                  className="px-3 py-1.5 text-xs bg-stone-800 text-stone-300 rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-emerald-800 hover:bg-emerald-700 text-amber-300 rounded border border-amber-500/40"
                >
                  Confirmar Baixa Parcial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
