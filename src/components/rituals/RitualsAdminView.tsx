import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Ritual, RitualRegistration } from '../../types';
import {
  Sparkles,
  Plus,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  AlertCircle,
  X,
  FileText,
  User,
  DollarSign
} from 'lucide-react';

export const RitualsAdminView: React.FC<{ onPreviewPublic: (slug: string) => void }> = ({ onPreviewPublic }) => {
  const { token, activeTenantId, hasRole } = useAuth();
  const [rituals, setRituals] = useState<Ritual[]>([]);
  const [selectedRitual, setSelectedRitual] = useState<Ritual | null>(null);
  const [registrations, setRegistrations] = useState<RitualRegistration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewRitualModalOpen, setIsNewRitualModalOpen] = useState(false);
  const [reviewModalReg, setReviewModalReg] = useState<RitualRegistration | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [cancelModalReg, setCancelModalReg] = useState<RitualRegistration | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Ritual Form
  const [newRitualForm, setNewRitualForm] = useState({
    title: '',
    subtitle: '',
    description: '',
    spiritual_guidance: '',
    ritual_date: '',
    cutoff_date: '',
    is_paid: true,
    price: 54.00,
    max_participants: 100,
    status: 'published' as const
  });

  const fetchRituals = async () => {
    if (!token || !activeTenantId) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/rituals', {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        }
      });
      if (res.ok) {
        const data = await res.json();
        setRituals(data);
        if (data.length > 0 && !selectedRitual) {
          setSelectedRitual(data[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching rituals:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRegistrations = async (ritualId: string) => {
    if (!token || !activeTenantId) return;
    try {
      const res = await fetch(`/api/rituals/${ritualId}/registrations`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        }
      });
      if (res.ok) {
        const data = await res.json();
        setRegistrations(data);
      }
    } catch (err) {
      console.error('Error fetching registrations:', err);
    }
  };

  useEffect(() => {
    fetchRituals();
  }, [token, activeTenantId]);

  useEffect(() => {
    if (selectedRitual) {
      fetchRegistrations(selectedRitual.id);
    }
  }, [selectedRitual]);

  const handleCreateRitual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeTenantId) return;

    try {
      const res = await fetch('/api/rituals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        },
        body: JSON.stringify(newRitualForm)
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', text: 'Ritual criado e publicado com sucesso!' });
        setIsNewRitualModalOpen(false);
        fetchRituals();
      } else {
        setFeedback({ type: 'error', text: data.error || 'Erro ao criar ritual.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: 'Erro de conexão: ' + err.message });
    }
  };

  const handleReviewPayment = async (action: 'approve' | 'reject') => {
    if (!token || !activeTenantId || !reviewModalReg) return;

    try {
      const res = await fetch(`/api/rituals/registrations/${reviewModalReg.id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        },
        body: JSON.stringify({ action, review_notes: reviewNotes })
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: 'success',
          text: action === 'approve' ? 'Comprovante aprovado e receita lançada no financeiro!' : 'Inscrição rejeitada.'
        });
        setReviewModalReg(null);
        setReviewNotes('');
        if (selectedRitual) {
          fetchRegistrations(selectedRitual.id);
          fetchRituals();
        }
      } else {
        setFeedback({ type: 'error', text: data.error || 'Erro ao processar conferência.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: 'Erro: ' + err.message });
    }
  };

  const handleCancelRegistration = async () => {
    if (!token || !activeTenantId || !cancelModalReg) return;
    try {
      const res = await fetch(`/api/rituals/registrations/${cancelModalReg.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        },
        body: JSON.stringify({ reason: cancelReason || 'Cancelamento solicitado pelo dirigente/financeiro' })
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', text: 'Inscrição cancelada, vaga liberada e financeiro estornado!' });
        setCancelModalReg(null);
        setCancelReason('');
        if (selectedRitual) {
          fetchRegistrations(selectedRitual.id);
          fetchRituals();
        }
      } else {
        setFeedback({ type: 'error', text: data.error || 'Erro ao cancelar inscrição.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: 'Erro: ' + err.message });
    }
  };

  const statusBadges: Record<string, { label: string; color: string }> = {
    pending: { label: 'Aguardando Pagamento', color: 'bg-stone-800 text-stone-300 border-stone-700' },
    under_review: { label: 'Comprovante Anexado', color: 'bg-amber-950 text-amber-300 border-amber-600/50 animate-pulse' },
    confirmed: { label: 'Vaga Confirmada', color: 'bg-emerald-950 text-emerald-300 border-emerald-700/50' },
    rejected: { label: 'Rejeitado / Cancelado', color: 'bg-red-950 text-red-300 border-red-800/50' }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-stone-100 flex items-center gap-2">
            <Sparkles className="text-amber-400" />
            Rituais Coletivos a Distância
          </h1>
          <p className="text-xs md:text-sm text-stone-400 mt-1">
            Administração de trabalhos espirituais à distância, inscrições públicas, conferência de PIX e controle de vagas.
          </p>
        </div>

        {hasRole(['dirigente', 'admin_casa', 'responsavel_rituais']) && (
          <button
            onClick={() => setIsNewRitualModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-800 hover:bg-emerald-700 text-amber-300 border border-amber-500/40 transition-colors shadow-sm self-start sm:self-auto"
          >
            <Plus size={16} /> Novo Trabalho Coletivo
          </button>
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

      {/* Rituals Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rituals.map((r) => {
          const isSelected = selectedRitual?.id === r.id;
          return (
            <div
              key={r.id}
              onClick={() => setSelectedRitual(r)}
              className={`p-5 rounded-xl border cursor-pointer transition-all shadow-md flex flex-col justify-between ${
                isSelected
                  ? 'bg-[#0c2f24] border-amber-500/60 ring-1 ring-amber-500/30'
                  : 'bg-stone-900 border-emerald-950 hover:border-emerald-800'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/50">
                    {r.status === 'published' ? 'Inscrições Abertas' : r.status}
                  </span>
                  <span className="text-xs font-bold text-amber-300">
                    {r.is_paid ? `R$ ${Number(r.price).toFixed(2)}` : 'Gratuito'}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-stone-100 line-clamp-2">{r.title}</h3>
                <p className="text-xs text-stone-400 line-clamp-2 mt-1">{r.description}</p>
              </div>

              <div className="pt-4 mt-4 border-t border-stone-800/80 flex items-center justify-between text-xs">
                <span className="text-stone-400">
                  Vagas: <strong>{r.current_participants}</strong> / {r.max_participants}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPreviewPublic(r.slug);
                  }}
                  className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-semibold"
                >
                  <span>Página Pública</span>
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Registrations List for Selected Ritual */}
      {selectedRitual && (
        <div className="p-5 rounded-2xl bg-stone-900 border border-emerald-900/40 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-800 pb-4">
            <div>
              <span className="text-xs text-amber-400 font-semibold uppercase tracking-wider">
                Inscrições & Comprovantes
              </span>
              <h2 className="text-base font-bold text-stone-100">{selectedRitual.title}</h2>
            </div>
            <div className="text-xs text-stone-400">
              Total de inscritos: <strong>{registrations.length}</strong>
            </div>
          </div>

          {registrations.length === 0 ? (
            <div className="py-12 text-center text-xs text-stone-500">
              Nenhuma inscrição recebida ainda para este ritual coletivo.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead className="bg-[#09231b] border-b border-emerald-900/50 text-emerald-300 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Código / Participante</th>
                    <th className="py-3 px-4">Contato</th>
                    <th className="py-3 px-4">Método / Valor</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Intenções / Pedidos</th>
                    <th className="py-3 px-4 text-right">Conferência</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800">
                  {registrations.map((reg) => {
                    const statusInfo = statusBadges[reg.payment_status] || {
                      label: reg.payment_status,
                      color: 'bg-stone-800 text-stone-300'
                    };

                    return (
                      <tr key={reg.id} className="hover:bg-emerald-950/20 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-stone-100">{reg.participant_name}</div>
                          <div className="text-xs text-amber-400 font-mono font-medium">
                            {reg.registration_code}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-stone-300">
                          <div>{reg.participant_phone}</div>
                          <div className="text-stone-500 text-[11px]">{reg.participant_email}</div>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <span className="font-bold text-stone-200">
                            R$ {Number(reg.amount_paid).toFixed(2)}
                          </span>
                          <div className="text-[11px] text-stone-400 uppercase">{reg.payment_method}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusInfo.color}`}
                          >
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <p className="text-xs text-stone-300 line-clamp-2 italic">
                            "{reg.intentions_text || 'Sem intenções informadas'}"
                          </p>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {reg.payment_status === 'under_review' ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setReviewModalReg(reg);
                                  setReviewNotes('');
                                }}
                                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 transition-colors shadow-xs animate-pulse"
                              >
                                Conferir
                              </button>
                              <button
                                onClick={() => {
                                  setCancelModalReg(reg);
                                  setCancelReason('');
                                }}
                                className="px-2 py-1 text-[11px] rounded bg-stone-800 hover:bg-red-950 text-stone-400 hover:text-red-300"
                              >
                                Rejeitar
                              </button>
                            </div>
                          ) : reg.payment_status === 'confirmed' ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-emerald-400 font-semibold inline-flex items-center gap-1">
                                <CheckCircle size={14} /> Vaga Confirmada
                              </span>
                              <button
                                onClick={() => {
                                  setCancelModalReg(reg);
                                  setCancelReason('');
                                }}
                                className="px-2 py-1 text-[11px] font-medium rounded bg-red-950/70 hover:bg-red-900 text-red-300 border border-red-800/50"
                                title="Cancelar inscrição e estornar vaga"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : reg.payment_status === 'rejected' ? (
                            <span className="text-[11px] text-stone-500 italic">Cancelado</span>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setReviewModalReg(reg);
                                  setReviewNotes('');
                                }}
                                className="px-2.5 py-1 text-xs rounded bg-stone-800 hover:bg-stone-700 text-stone-300"
                              >
                                Revisar
                              </button>
                              <button
                                onClick={() => {
                                  setCancelModalReg(reg);
                                  setCancelReason('');
                                }}
                                className="px-2 py-1 text-[11px] rounded bg-stone-900 hover:bg-red-950 text-stone-400 hover:text-red-300"
                              >
                                Cancelar
                              </button>
                            </div>
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
      )}

      {/* Review Payment Modal */}
      {reviewModalReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-stone-900 border border-emerald-800/60 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 bg-[#09231b] border-b border-emerald-900/50 flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-100 flex items-center gap-2">
                <CheckCircle size={18} className="text-amber-400" />
                Conferência de Comprovante PIX
              </h3>
              <button
                onClick={() => setReviewModalReg(null)}
                className="text-stone-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs md:text-sm">
              <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-400">Participante:</span>
                  <span className="font-bold text-stone-100">{reviewModalReg.participant_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Código de Inscrição:</span>
                  <span className="font-mono text-amber-400 font-bold">{reviewModalReg.registration_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Valor da Inscrição:</span>
                  <span className="font-bold text-emerald-400">R$ {Number(reviewModalReg.amount_paid).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">WhatsApp:</span>
                  <span className="text-stone-200">{reviewModalReg.participant_phone}</span>
                </div>
              </div>

              {/* Receipt preview box */}
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">
                  Comprovante Enviado
                </label>
                <div className="p-4 rounded-xl bg-stone-950 border border-emerald-900/50 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-amber-300">
                    <FileText size={18} />
                    <span className="font-medium truncate max-w-xs">
                      {reviewModalReg.manual_receipt_url || 'Comprovante anexado pelo participante'}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                    Conferível
                  </span>
                </div>
              </div>

              {/* Intentions Text */}
              {reviewModalReg.intentions_text && (
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1">
                    Pedidos / Intenções do Participante para o Congá
                  </label>
                  <div className="p-3 rounded-lg bg-stone-950 border border-stone-800 text-xs text-stone-300 italic">
                    "{reviewModalReg.intentions_text}"
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">
                  Notas de Conferência do Financeiro
                </label>
                <input
                  type="text"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Ex: Conferido no extrato do Banco Inter / Nubank"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-100"
                />
              </div>

              <div className="pt-3 border-t border-stone-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => handleReviewPayment('reject')}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-red-950 hover:bg-red-900 text-red-200 border border-red-800"
                >
                  Rejeitar Pagamento
                </button>
                <button
                  type="button"
                  onClick={() => handleReviewPayment('approve')}
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-600 text-amber-300 border border-amber-500/40 shadow-sm"
                >
                  Aprovar & Confirmar Vaga
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Ritual Modal */}
      {isNewRitualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-stone-900 border border-emerald-800/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-[#09231b] border-b border-emerald-900/50 flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-100 flex items-center gap-2">
                <Sparkles size={18} className="text-amber-400" />
                Cadastrar Ritual Coletivo a Distância
              </h3>
              <button
                onClick={() => setIsNewRitualModalOpen(false)}
                className="text-stone-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRitual} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Título do Trabalho *</label>
                <input
                  type="text"
                  required
                  value={newRitualForm.title}
                  onChange={(e) => setNewRitualForm({ ...newRitualForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                  placeholder="Ex: Trabalho Coletivo de Prosperidade com Mamãe Oxum"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Subtítulo ou Resumo</label>
                <input
                  type="text"
                  value={newRitualForm.subtitle}
                  onChange={(e) => setNewRitualForm({ ...newRitualForm, subtitle: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                  placeholder="Firmeza sagrada no congá para abertura de caminhos"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Descrição Detalhada *</label>
                <textarea
                  rows={3}
                  required
                  value={newRitualForm.description}
                  onChange={(e) => setNewRitualForm({ ...newRitualForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                  placeholder="Explique como será realizado o trabalho litúrgico pelo corpo sacerdotal..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">
                  Orientações Espirituais para os Participantes
                </label>
                <textarea
                  rows={2}
                  value={newRitualForm.spiritual_guidance}
                  onChange={(e) => setNewRitualForm({ ...newRitualForm, spiritual_guidance: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                  placeholder="Ex: No dia às 20h, acender vela branca e manter um copo com água para imantação."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Data e Hora do Trabalho *</label>
                  <input
                    type="datetime-local"
                    required
                    value={newRitualForm.ritual_date}
                    onChange={(e) => setNewRitualForm({ ...newRitualForm, ritual_date: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Encerramento Inscrições</label>
                  <input
                    type="datetime-local"
                    value={newRitualForm.cutoff_date}
                    onChange={(e) => setNewRitualForm({ ...newRitualForm, cutoff_date: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Valor da Inscrição (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newRitualForm.price}
                    onChange={(e) => setNewRitualForm({ ...newRitualForm, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Limite Máximo de Vagas</label>
                  <input
                    type="number"
                    value={newRitualForm.max_participants}
                    onChange={(e) => setNewRitualForm({ ...newRitualForm, max_participants: parseInt(e.target.value, 10) || 50 })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-stone-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewRitualModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-stone-800 text-stone-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-emerald-800 hover:bg-emerald-700 text-amber-300 border border-amber-500/40 shadow-sm"
                >
                  Publicar Ritual
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Registration Modal */}
      {cancelModalReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-stone-900 border border-red-900/60 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-4 bg-red-950/50 border-b border-red-900/40 flex items-center justify-between">
              <h3 className="text-sm font-bold text-red-200 flex items-center gap-2">
                <AlertCircle size={16} className="text-red-400" />
                Cancelar Inscrição no Ritual
              </h3>
              <button
                onClick={() => setCancelModalReg(null)}
                className="text-stone-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-stone-950 rounded-xl border border-stone-800 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-stone-400">Participante:</span>
                  <span className="font-semibold text-stone-100">{cancelModalReg.participant_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Código:</span>
                  <span className="font-mono text-amber-400">{cancelModalReg.registration_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Status Atual:</span>
                  <span className="font-semibold text-stone-200">{cancelModalReg.payment_status}</span>
                </div>
              </div>

              <p className="text-stone-300 text-xs leading-relaxed">
                Esta ação cancelará a inscrição do participante, <strong>decrementará o contador de vagas</strong> e, se a inscrição já estiver confirmada, <strong>estornará a receita associada no financeiro</strong>.
              </p>

              <div>
                <label className="block text-stone-300 font-medium mb-1">
                  Motivo do cancelamento:
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ex: Desistência a pedido do participante / Erro no pagamento"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-stone-100"
                />
              </div>

              <div className="pt-3 border-t border-stone-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCancelModalReg(null)}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 text-stone-300"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleCancelRegistration}
                  className="px-4 py-1.5 font-bold rounded-lg bg-red-800 hover:bg-red-700 text-white shadow-sm"
                >
                  Confirmar Cancelamento & Estorno
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
