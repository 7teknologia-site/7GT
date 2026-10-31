import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { CalendarEvent } from '../../types';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Plus,
  CheckCircle,
  X,
  AlertCircle
} from 'lucide-react';

export const CalendarView: React.FC = () => {
  const { token, activeTenantId, hasRole } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [checkinEvent, setCheckinEvent] = useState<CalendarEvent | null>(null);
  const [attendeeName, setAttendeeName] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [eventForm, setEventForm] = useState({
    title: '',
    type: 'gira_publica' as const,
    description: '',
    start_time: '',
    end_time: '',
    location: 'Templo Principal',
    max_attendees: 80,
    is_public: true
  });

  const fetchEvents = async () => {
    if (!token || !activeTenantId) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/events', {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        }
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [token, activeTenantId]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeTenantId) return;

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        },
        body: JSON.stringify(eventForm)
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', text: 'Atividade agendada com sucesso!' });
        setIsModalOpen(false);
        fetchEvents();
      } else {
        setFeedback({ type: 'error', text: data.error || 'Erro ao agendar atividade.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: 'Erro: ' + err.message });
    }
  };

  const handleCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeTenantId || !checkinEvent) return;

    try {
      const res = await fetch(`/api/events/${checkinEvent.id}/checkin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        },
        body: JSON.stringify({ name: attendeeName })
      });

      if (res.ok) {
        setFeedback({ type: 'success', text: `Presença confirmada para ${attendeeName}!` });
        setCheckinEvent(null);
        setAttendeeName('');
        fetchEvents();
      }
    } catch (err) {
      console.error('Checkin error:', err);
    }
  };

  const eventTypeLabels: Record<string, string> = {
    gira_publica: 'Gira Pública com Passes',
    gira_fechada: 'Sessão Fechada de Corrente',
    festa_anual: 'Festa Sagrada & Louvação',
    sessao_cura: 'Sessão de Cura Espiritual',
    estudo: 'Estudo Doutrinário',
    mutirao: 'Mutirão Comunitário',
    reuniao_admin: 'Reunião Administrativa'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-stone-100 flex items-center gap-2">
            <Calendar className="text-emerald-400" />
            Calendário Litúrgico & Giras
          </h1>
          <p className="text-xs md:text-sm text-stone-400 mt-1">
            Programação de giras públicas, sessões de desenvolvimento, festas tradicionais e mutirões.
          </p>
        </div>

        {hasRole(['dirigente', 'admin_casa', 'responsavel_area']) && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-800 hover:bg-emerald-700 text-amber-300 border border-amber-500/40 shadow-sm self-start sm:self-auto"
          >
            <Plus size={16} /> Agendar Nova Gira / Evento
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

      {/* Events Timeline / List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-stone-400">Carregando calendário...</div>
        ) : events.length === 0 ? (
          <div className="py-12 text-center text-stone-500 rounded-xl bg-stone-900 border border-emerald-950">
            Nenhuma atividade cadastrada. Agende a primeira gira!
          </div>
        ) : (
          events.map((evt) => {
            const start = new Date(evt.start_time);
            const end = new Date(evt.end_time);

            return (
              <div
                key={evt.id}
                className="p-5 rounded-2xl bg-stone-900 border border-emerald-900/40 hover:border-emerald-600/40 transition-all shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4">
                  {/* Date badge */}
                  <div className="w-16 h-16 rounded-xl bg-emerald-950 border border-emerald-700/40 flex flex-col items-center justify-center text-center shrink-0">
                    <span className="text-[10px] uppercase font-bold text-emerald-400">
                      {start.toLocaleDateString('pt-BR', { month: 'short' })}
                    </span>
                    <span className="text-xl font-bold text-amber-300 leading-none">
                      {start.toLocaleDateString('pt-BR', { day: '2-digit' })}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-stone-950 text-amber-300 border border-stone-800">
                        {eventTypeLabels[evt.type] || evt.type}
                      </span>
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                        {evt.is_public ? 'Aberta ao Público' : 'Privada à Corrente'}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-stone-100">{evt.title}</h3>
                    {evt.description && (
                      <p className="text-xs text-stone-400 line-clamp-2">{evt.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-xs text-stone-400 pt-1">
                      <div className="flex items-center gap-1.5">
                        <Clock size={13} className="text-emerald-400" />
                        <span>
                          {start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} às{' '}
                          {end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin size={13} className="text-amber-400" />
                        <span>{evt.location || 'Templo Principal'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-center border-t md:border-t-0 pt-3 md:pt-0 border-stone-800">
                  <div className="text-right text-xs text-stone-400 hidden sm:block">
                    <div>Presenças registradas:</div>
                    <strong className="text-stone-200">{evt.checkedin_count || 0} confirmadas</strong>
                  </div>
                  <button
                    onClick={() => setCheckinEvent(evt)}
                    className="px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-800 hover:bg-emerald-700 text-stone-100 border border-emerald-600/40 transition-colors shadow-xs"
                  >
                    Registrar Presença
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Check-in Modal */}
      {checkinEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-stone-900 border border-emerald-800/60 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 bg-[#09231b] border-b border-emerald-900/50 flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-100 flex items-center gap-2">
                <CheckCircle size={18} className="text-amber-400" />
                Confirmar Presença na Gira
              </h3>
              <button onClick={() => setCheckinEvent(null)} className="text-stone-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCheckin} className="p-5 space-y-4">
              <div className="text-xs text-stone-300">
                Gira: <strong className="text-amber-300">{checkinEvent.title}</strong>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">
                  Nome do Médium ou Assistente *
                </label>
                <input
                  type="text"
                  required
                  value={attendeeName}
                  onChange={(e) => setAttendeeName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                  placeholder="Nome completo"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCheckinEvent(null)}
                  className="px-3 py-1.5 text-xs bg-stone-800 text-stone-300 rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-emerald-800 hover:bg-emerald-700 text-amber-300 rounded border border-amber-500/30"
                >
                  Confirmar Presença
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-stone-900 border border-emerald-800/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-[#09231b] border-b border-emerald-900/50 flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-100 flex items-center gap-2">
                <Calendar size={18} className="text-amber-400" />
                Agendar Atividade / Gira
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Título da Gira / Evento *</label>
                <input
                  type="text"
                  required
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                  placeholder="Ex: Gira Pública de Caboclos e Boiadeiros"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Tipo de Atividade</label>
                  <select
                    value={eventForm.type}
                    onChange={(e: any) => setEventForm({ ...eventForm, type: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-100"
                  >
                    <option value="gira_publica">Gira Pública com Passes</option>
                    <option value="gira_fechada">Sessão Fechada de Corrente</option>
                    <option value="festa_anual">Festa Anual & Louvação</option>
                    <option value="sessao_cura">Sessão de Cura Espiritual</option>
                    <option value="estudo">Estudo Doutrinário</option>
                    <option value="mutirao">Mutirão Comunitário</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Público</label>
                  <select
                    value={eventForm.is_public ? 'public' : 'private'}
                    onChange={(e) => setEventForm({ ...eventForm, is_public: e.target.value === 'public' })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-100"
                  >
                    <option value="public">Aberta à Assistência Externa</option>
                    <option value="private">Privada aos Filhos da Casa</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Início *</label>
                  <input
                    type="datetime-local"
                    required
                    value={eventForm.start_time}
                    onChange={(e) => setEventForm({ ...eventForm, start_time: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Término Previsto *</label>
                  <input
                    type="datetime-local"
                    required
                    value={eventForm.end_time}
                    onChange={(e) => setEventForm({ ...eventForm, end_time: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Local / Espaço</label>
                <input
                  type="text"
                  value={eventForm.location}
                  onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Descrição & Orientações</label>
                <textarea
                  rows={2}
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-100"
                  placeholder="Orientações sobre vestimenta branca, senhas de atendimento, etc."
                />
              </div>

              <div className="pt-3 border-t border-stone-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-stone-800 text-stone-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-emerald-800 hover:bg-emerald-700 text-amber-300 border border-amber-500/40 shadow-sm"
                >
                  Confirmar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
