import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { CrmPipelineStage, CrmContact, CrmActivity } from '../../types';
import {
  Kanban,
  Plus,
  Phone,
  Mail,
  Clock,
  ChevronRight,
  User,
  CheckCircle2,
  Calendar,
  X,
  MessageSquare,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export const CrmView: React.FC = () => {
  const { token, activeTenantId, user } = useAuth();
  const [board, setBoard] = useState<CrmPipelineStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [contact360, setContact360] = useState<{ contact: CrmContact; activities: CrmActivity[] } | null>(null);
  const [isNewContactModalOpen, setIsNewContactModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);

  // New Contact Form
  const [contactForm, setContactForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    relationship_type: 'visitante',
    source: 'indicacao',
    notes: ''
  });

  // New Activity Form
  const [activityForm, setActivityForm] = useState({
    type: 'conversa_whatsapp' as const,
    title: '',
    description: '',
    due_date: ''
  });

  const fetchBoard = async () => {
    if (!token || !activeTenantId) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/crm/board', {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        }
      });
      if (res.ok) {
        const data = await res.json();
        setBoard(data);
      }
    } catch (err) {
      console.error('Error fetching CRM board:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBoard();
  }, [token, activeTenantId]);

  const loadContact360 = async (id: string) => {
    if (!token || !activeTenantId) return;
    try {
      const res = await fetch(`/api/crm/contacts/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        }
      });
      if (res.ok) {
        const data = await res.json();
        setContact360(data);
        setSelectedContactId(id);
      }
    } catch (err) {
      console.error('Error fetching contact 360:', err);
    }
  };

  const handleMoveContact = async (contactId: string, targetStageId: string) => {
    if (!token || !activeTenantId) return;
    try {
      const res = await fetch(`/api/crm/contacts/${contactId}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        },
        body: JSON.stringify({ targetStageId })
      });

      if (res.ok) {
        fetchBoard();
        if (selectedContactId === contactId) {
          loadContact360(contactId);
        }
      }
    } catch (err) {
      console.error('Error moving contact:', err);
    }
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeTenantId) return;
    try {
      const res = await fetch('/api/crm/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        },
        body: JSON.stringify(contactForm)
      });
      if (res.ok) {
        setIsNewContactModalOpen(false);
        setContactForm({
          full_name: '',
          email: '',
          phone: '',
          relationship_type: 'visitante',
          source: 'indicacao',
          notes: ''
        });
        fetchBoard();
      }
    } catch (err) {
      console.error('Error creating contact:', err);
    }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeTenantId || !selectedContactId) return;
    try {
      const res = await fetch(`/api/crm/contacts/${selectedContactId}/activities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        },
        body: JSON.stringify(activityForm)
      });
      if (res.ok) {
        setIsActivityModalOpen(false);
        setActivityForm({ type: 'conversa_whatsapp', title: '', description: '', due_date: '' });
        loadContact360(selectedContactId);
      }
    } catch (err) {
      console.error('Error adding activity:', err);
    }
  };

  const relationshipLabels: Record<string, string> = {
    visitante: 'Visitante',
    interessado: 'Interessado na Casa',
    inscrito_evento: 'Inscrito em Evento',
    participante_ritual: 'Participante de Ritual',
    em_ingresso: 'Em Processo de Ingresso',
    membro_ativo: 'Membro Ativo'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-stone-100 flex items-center gap-2">
            <Kanban className="text-amber-400" />
            CRM de Acolhimento & Visitantes
          </h1>
          <p className="text-xs md:text-sm text-stone-400 mt-1">
            Organize o contato respeitoso com frequentadores, interessados e participantes de rituais.
          </p>
        </div>

        <button
          onClick={() => setIsNewContactModalOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus size={16} /> Novo Contato
        </button>
      </div>

      {/* Kanban Board Container */}
      <div className="overflow-x-auto pb-6">
        <div className="flex gap-4 min-w-[1100px]">
          {board.map((stage, idx) => (
            <div
              key={stage.id}
              className="w-72 shrink-0 rounded-xl bg-stone-900 border border-emerald-950 flex flex-col max-h-[75vh] shadow-md"
            >
              {/* Stage Header */}
              <div className="p-3.5 border-b border-stone-800 flex items-center justify-between bg-[#081e17] rounded-t-xl">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                  <span className="text-xs font-bold text-stone-200">{stage.name}</span>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-stone-950 text-amber-300 border border-stone-800">
                  {stage.contacts?.length || 0}
                </span>
              </div>

              {/* Contact Cards in Stage */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {stage.contacts?.length === 0 ? (
                  <div className="py-8 text-center text-[11px] text-stone-600">Nenhum contato nesta etapa</div>
                ) : (
                  stage.contacts?.map((contact) => (
                    <div
                      key={contact.id}
                      onClick={() => loadContact360(contact.id)}
                      className="p-3.5 rounded-lg bg-stone-950 border border-stone-800 hover:border-amber-500/50 cursor-pointer transition-all shadow-xs group"
                    >
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <span className="text-xs font-bold text-stone-100 group-hover:text-amber-300 transition-colors truncate">
                          {contact.full_name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40 shrink-0">
                          {relationshipLabels[contact.relationship_type] || contact.relationship_type}
                        </span>
                      </div>

                      {contact.phone && (
                        <div className="text-[11px] text-stone-400 flex items-center gap-1.5 mb-1">
                          <Phone size={11} className="text-emerald-500" />
                          <span>{contact.phone}</span>
                        </div>
                      )}

                      {contact.notes && (
                        <p className="text-[11px] text-stone-400 line-clamp-2 mt-1.5 bg-stone-900/60 p-1.5 rounded border border-stone-800/60">
                          {contact.notes}
                        </p>
                      )}

                      {/* Quick Move Button to Next Stage */}
                      {idx < board.length - 1 && (
                        <div className="pt-2 mt-2 border-t border-stone-800/80 flex justify-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveContact(contact.id, board[idx + 1].id);
                            }}
                            className="inline-flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 font-semibold px-2 py-0.5 rounded hover:bg-stone-800 transition-colors"
                          >
                            <span>Avançar para {board[idx + 1].name}</span>
                            <ArrowRight size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contact 360 Drawer / Modal */}
      {selectedContactId && contact360 && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md h-full bg-stone-900 border-l border-emerald-900/50 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 bg-[#09231b] border-b border-emerald-900/50 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                  Ficha 360° de Relacionamento
                </span>
                <h3 className="text-base font-bold text-stone-100">{contact360.contact.full_name}</h3>
              </div>
              <button
                onClick={() => setSelectedContactId(null)}
                className="text-stone-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Contact Details Card */}
              <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-400">Tipo de Relação:</span>
                  <span className="font-semibold text-amber-300">
                    {relationshipLabels[contact360.contact.relationship_type] || contact360.contact.relationship_type}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Origem:</span>
                  <span className="text-stone-200 capitalize">{contact360.contact.source}</span>
                </div>
                {contact360.contact.phone && (
                  <div className="flex justify-between">
                    <span className="text-stone-400">Telefone:</span>
                    <span className="text-emerald-400 font-mono">{contact360.contact.phone}</span>
                  </div>
                )}
                {contact360.contact.email && (
                  <div className="flex justify-between">
                    <span className="text-stone-400">E-mail:</span>
                    <span className="text-stone-300">{contact360.contact.email}</span>
                  </div>
                )}
              </div>

              {/* Move Stage Selector */}
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                  Etapa Atual no Funil
                </label>
                <select
                  value={contact360.contact.stage_id || ''}
                  onChange={(e) => handleMoveContact(contact360.contact.id, e.target.value)}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-amber-300 font-medium focus:outline-hidden focus:border-amber-500"
                >
                  {board.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Activities Timeline */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-stone-200 flex items-center gap-1.5">
                    <Clock size={14} className="text-emerald-400" />
                    Histórico de Interações & Acompanhamento
                  </h4>
                  <button
                    onClick={() => setIsActivityModalOpen(true)}
                    className="text-[11px] font-semibold text-amber-400 hover:underline"
                  >
                    + Registrar Ação
                  </button>
                </div>

                {contact360.activities?.length === 0 ? (
                  <div className="py-6 text-center text-xs text-stone-500">
                    Nenhuma atividade registrada ainda.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {contact360.activities.map((act) => (
                      <div
                        key={act.id}
                        className="p-3 rounded-lg bg-stone-950 border border-stone-800 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-stone-400 text-[10px]">
                          <span className="capitalize font-medium text-emerald-400">{act.type.replace('_', ' ')}</span>
                          <span>{new Date(act.created_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <div className="font-semibold text-stone-200">{act.title}</div>
                        {act.description && <p className="text-stone-400 text-[11px]">{act.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Contact Modal */}
      {isNewContactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-stone-900 border border-emerald-800/60 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 bg-[#09231b] border-b border-emerald-900/50 flex items-center justify-between">
              <h2 className="text-base font-bold text-stone-100 flex items-center gap-2">
                <User size={18} className="text-amber-400" />
                Cadastrar Contato no CRM
              </h2>
              <button
                onClick={() => setIsNewContactModalOpen(false)}
                className="text-stone-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateContact} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={contactForm.full_name}
                  onChange={(e) => setContactForm({ ...contactForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                  placeholder="Nome do visitante ou interessado"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                    placeholder="(11) 98765-4321"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Tipo de Relacionamento</label>
                  <select
                    value={contactForm.relationship_type}
                    onChange={(e) => setContactForm({ ...contactForm, relationship_type: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                  >
                    <option value="visitante">Visitante em Gira</option>
                    <option value="interessado">Interessado em Conhecer</option>
                    <option value="inscrito_evento">Inscrito em Evento/Festa</option>
                    <option value="em_ingresso">Em Processo de Ingresso</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Origem do Contato</label>
                  <select
                    value={contactForm.source}
                    onChange={(e) => setContactForm({ ...contactForm, source: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                  >
                    <option value="indicacao">Indicação de Irmão</option>
                    <option value="redes_sociais">Redes Sociais / Instagram</option>
                    <option value="whatsapp">Mensagem no WhatsApp</option>
                    <option value="formulario">Formulário do Site</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Observações Respeitosas</label>
                <textarea
                  rows={2}
                  value={contactForm.notes}
                  onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                  placeholder="Ex: Assistiu à gira de Caboclos, pediu orientações sobre o passe."
                />
              </div>

              <div className="pt-3 border-t border-stone-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewContactModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-stone-800 text-stone-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 shadow-sm"
                >
                  Salvar Contato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Activity Modal */}
      {isActivityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-stone-900 border border-emerald-800/60 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-4 bg-[#09231b] border-b border-emerald-900/50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-100">Registrar Interação</h3>
              <button
                onClick={() => setIsActivityModalOpen(false)}
                className="text-stone-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAddActivity} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Canal / Tipo</label>
                <select
                  value={activityForm.type}
                  onChange={(e: any) => setActivityForm({ ...activityForm, type: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-100"
                >
                  <option value="conversa_whatsapp">Conversa pelo WhatsApp</option>
                  <option value="ligacao">Ligação Telefônica</option>
                  <option value="atendimento">Atendimento Presencial no Terreiro</option>
                  <option value="visita">Visita à Casa</option>
                  <option value="tarefa_followup">Tarefa de Acompanhamento</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Resumo *</label>
                <input
                  type="text"
                  required
                  value={activityForm.title}
                  onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-100"
                  placeholder="Ex: Enviado cronograma de giras do mês"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Detalhes (Opcional)</label>
                <textarea
                  rows={2}
                  value={activityForm.description}
                  onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-100"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsActivityModalOpen(false)}
                  className="px-3 py-1.5 text-xs bg-stone-800 text-stone-300 rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-emerald-800 hover:bg-emerald-700 text-amber-300 rounded border border-amber-500/30"
                >
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
