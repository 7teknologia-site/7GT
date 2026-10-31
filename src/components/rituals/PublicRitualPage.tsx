import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Calendar,
  Clock,
  CheckCircle2,
  Copy,
  MessageCircle,
  Upload,
  ArrowLeft,
  Check,
  AlertCircle
} from 'lucide-react';

interface PublicRitualPageProps {
  slug?: string;
  onBackToApp?: () => void;
}

export const PublicRitualPage: React.FC<PublicRitualPageProps> = ({
  slug = 'trabalho-prosperidade-oxum-2026',
  onBackToApp
}) => {
  const [ritual, setRitual] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState(false);
  const [regSuccessData, setRegSuccessData] = useState<any>(null);
  const [isReceiptSubmitted, setIsReceiptSubmitted] = useState(false);
  const [receiptUrlInput, setReceiptUrlInput] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    participant_name: '',
    participant_email: '',
    participant_phone: '',
    intentions_text: '',
    payment_method: 'pix_manual'
  });

  const fetchPublicRitual = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/rituals/public/${slug}`);
      if (res.ok) {
        const data = await res.json();
        setRitual(data.ritual);
      }
    } catch (err) {
      console.error('Error fetching public ritual:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPublicRitual();
  }, [slug]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/rituals/public/${slug}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (res.ok) {
        setRegSuccessData(data);
      } else {
        alert(data.error || 'Erro ao realizar inscrição.');
      }
    } catch (err: any) {
      alert('Erro de conexão: ' + err.message);
    }
  };

  const handleCopyPix = () => {
    const pixKey = ritual?.pix_key || ritual?.default_pix_key || '45.892.123/0001-90';
    navigator.clipboard.writeText(pixKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const handleSubmitReceipt = async () => {
    if (!regSuccessData?.registrationCode) return;
    try {
      const res = await fetch('/api/rituals/public/receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationCode: regSuccessData.registrationCode,
          receiptUrl: receiptUrlInput || 'https://storage.7teknologia.com/demo-comprovante-pix.pdf',
          notes: 'Comprovante anexado pelo participante na página pública'
        })
      });

      if (res.ok) {
        setIsReceiptSubmitted(true);
      }
    } catch (err) {
      console.error('Submit receipt error:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center text-stone-400">
        <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-3" />
        <p className="text-sm">Carregando informações do ritual...</p>
      </div>
    );
  }

  if (!ritual) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-4 text-center text-stone-300">
        <AlertCircle size={40} className="text-amber-500 mb-3" />
        <h2 className="text-lg font-bold">Ritual não encontrado</h2>
        <p className="text-sm text-stone-400 mt-1 max-w-sm">
          Este trabalho coletivo pode ter sido encerrado ou o link informado está incorreto.
        </p>
        {onBackToApp && (
          <button
            onClick={onBackToApp}
            className="mt-6 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-800 text-stone-100"
          >
            Voltar ao Painel
          </button>
        )}
      </div>
    );
  }

  const ritualDate = new Date(ritual.ritual_date);
  const cutoffDate = new Date(ritual.cutoff_date);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-sans">
      {/* Top Bar with Back Button */}
      {onBackToApp && (
        <div className="bg-[#061913] border-b border-emerald-900/40 px-4 py-2.5 flex items-center justify-between">
          <button
            onClick={onBackToApp}
            className="inline-flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200 font-semibold"
          >
            <ArrowLeft size={14} /> Voltar ao Painel de Gestão
          </button>
          <span className="text-[11px] text-stone-400">
            Pré-visualização da Página Pública de Inscrição (/r/{slug})
          </span>
        </div>
      )}

      {/* Hero Section */}
      <div className="relative bg-gradient-to-b from-[#09231b] via-[#0c2f24] to-stone-950 border-b border-emerald-900/40 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-700/50 text-xs text-amber-300 font-semibold shadow-xs">
            <Sparkles size={13} className="text-amber-400" />
            <span>{ritual.terreiro_name}</span>
            <span className="text-stone-400">• {ritual.house_tradition}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-stone-100 tracking-tight leading-tight">
            {ritual.title}
          </h1>

          {ritual.subtitle && (
            <p className="text-sm sm:text-base text-amber-200/90 font-medium max-w-2xl mx-auto">
              {ritual.subtitle}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs sm:text-sm text-stone-300 pt-2">
            <div className="flex items-center gap-1.5 bg-stone-900/80 px-3 py-1.5 rounded-lg border border-stone-800">
              <Calendar size={15} className="text-amber-400" />
              <span>
                {ritualDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-stone-900/80 px-3 py-1.5 rounded-lg border border-stone-800">
              <Clock size={15} className="text-emerald-400" />
              <span>
                Início às {ritualDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-amber-950/50 px-3 py-1.5 rounded-lg border border-amber-600/40 font-bold text-amber-300">
              <span>{ritual.is_paid ? `Contribuição: R$ ${Number(ritual.price).toFixed(2)}` : 'Participação Gratuita'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6 grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Column (Details & Guidelines) */}
        <div className="md:col-span-7 space-y-6">
          <div className="p-6 rounded-2xl bg-stone-900/80 border border-emerald-900/40 shadow-lg space-y-4">
            <h2 className="text-base font-bold text-stone-100 flex items-center gap-2">
              <Sparkles size={16} className="text-amber-400" />
              Sobre o Trabalho Coletivo
            </h2>
            <p className="text-xs sm:text-sm text-stone-300 leading-relaxed whitespace-pre-line">
              {ritual.description}
            </p>
          </div>

          {ritual.spiritual_guidance && (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0c2f24] to-stone-900 border border-amber-500/30 shadow-lg space-y-3">
              <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                Orientações Espirituais para o Dia do Trabalho
              </h3>
              <p className="text-xs sm:text-sm text-stone-200 leading-relaxed italic">
                "{ritual.spiritual_guidance}"
              </p>
            </div>
          )}

          {/* House Contacts & Guarantee */}
          <div className="p-5 rounded-xl bg-stone-900/60 border border-stone-800 text-xs text-stone-400 space-y-2">
            <div className="font-semibold text-stone-300">Dúvidas sobre o trabalho ou confirmação?</div>
            <div>
              Entre em contato direto com a secretaria do terreiro pelo WhatsApp:{' '}
              <strong className="text-emerald-400">{ritual.whatsapp_phone || ritual.whatsapp_contact || '(11) 98765-4321'}</strong>
            </div>
            <div className="text-[11px] text-stone-500 pt-1">
              Seus dados pessoais são protegidos pela LGPD e utilizados exclusivamente para inclusão do seu nome nas preces do congá.
            </div>
          </div>
        </div>

        {/* Right Column (Registration Card) */}
        <div className="md:col-span-5">
          {regSuccessData ? (
            /* Success & Payment Step */
            <div className="p-6 rounded-2xl bg-stone-900 border border-emerald-700/60 shadow-2xl space-y-5 animate-in fade-in duration-300">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-emerald-950 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-600/40">
                  <CheckCircle2 size={24} />
                </div>
                <h3 className="text-base font-bold text-stone-100">Inscrição Registrada!</h3>
                <p className="text-xs text-stone-400">
                  Guarde seu código exclusivo de identificação no congá:
                </p>
                <div className="inline-block px-4 py-2 rounded-lg bg-stone-950 border border-amber-500/50 font-mono text-base font-bold text-amber-400 shadow-inner">
                  {regSuccessData.registrationCode}
                </div>
              </div>

              {ritual.is_paid && (
                <div className="space-y-4 pt-2 border-t border-stone-800">
                  <div className="text-xs font-semibold text-stone-300">
                    Instruções para Pagamento via PIX:
                  </div>

                  <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2.5">
                    <div className="text-xs text-stone-400 flex justify-between">
                      <span>Favorecido:</span>
                      <strong className="text-stone-200">{regSuccessData.pixRecipient || 'Terreiro'}</strong>
                    </div>
                    <div className="text-xs text-stone-400 flex justify-between">
                      <span>Valor:</span>
                      <strong className="text-emerald-400">R$ {Number(regSuccessData.price).toFixed(2)}</strong>
                    </div>

                    <div className="pt-2">
                      <span className="text-[11px] text-stone-400 block mb-1">Chave PIX:</span>
                      <div className="flex items-center justify-between p-2 rounded bg-stone-900 border border-stone-700 text-xs text-amber-300 font-mono">
                        <span className="truncate pr-2">{regSuccessData.pixKey || '45.892.123/0001-90'}</span>
                        <button
                          onClick={handleCopyPix}
                          className="px-2 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 rounded text-[10px] font-bold shrink-0 flex items-center gap-1"
                        >
                          {copiedKey ? <Check size={12} /> : <Copy size={12} />}
                          {copiedKey ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* WhatsApp Quick Confirm Button */}
                  <a
                    href={`https://wa.me/55${(regSuccessData.whatsappContact || '11987654321').replace(/\D/g, '')}?text=${encodeURIComponent(
                      `Olá! Acabei de me inscrever no ritual "${ritual.title}". Meu código é ${regSuccessData.registrationCode}. Segue o comprovante!`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-stone-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <MessageCircle size={16} />
                    Enviar Comprovante pelo WhatsApp
                  </a>

                  {/* Or attach receipt directly */}
                  <div className="pt-2 space-y-2">
                    <div className="text-[11px] text-stone-400">
                      Ou anexe o link / comprovante para conferência pelo painel:
                    </div>
                    {isReceiptSubmitted ? (
                      <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/40 text-emerald-300 text-xs flex items-center gap-2">
                        <CheckCircle2 size={16} /> Comprovante enviado para análise do terreiro!
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={receiptUrlInput}
                          onChange={(e) => setReceiptUrlInput(e.target.value)}
                          placeholder="Link ou nome do comprovante..."
                          className="flex-1 px-3 py-1.5 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-200"
                        />
                        <button
                          onClick={handleSubmitReceipt}
                          className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-semibold shrink-0"
                        >
                          Enviar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Registration Form */
            <div className="p-6 rounded-2xl bg-stone-900 border border-emerald-900/40 shadow-xl space-y-5">
              <div className="border-b border-stone-800 pb-3">
                <h3 className="text-base font-bold text-stone-100">Formulário de Inscrição</h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Preencha seus dados para inclusão das suas intenções no congá.
                </p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">
                    Seu Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.participant_name}
                    onChange={(e) => setFormData({ ...formData, participant_name: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs sm:text-sm text-stone-100 focus:outline-hidden focus:border-amber-500"
                    placeholder="Nome completo para as preces"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">
                    WhatsApp para Confirmação *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.participant_phone}
                    onChange={(e) => setFormData({ ...formData, participant_phone: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs sm:text-sm text-stone-100 focus:outline-hidden focus:border-amber-500"
                    placeholder="(11) 98765-4321"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">
                    E-mail para Notificações *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.participant_email}
                    onChange={(e) => setFormData({ ...formData, participant_email: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs sm:text-sm text-stone-100 focus:outline-hidden focus:border-amber-500"
                    placeholder="seu.email@exemplo.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">
                    Seus Pedidos / Intenções para a Firmeza
                  </label>
                  <textarea
                    rows={3}
                    value={formData.intentions_text}
                    onChange={(e) => setFormData({ ...formData, intentions_text: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs sm:text-sm text-stone-100 focus:outline-hidden focus:border-amber-500"
                    placeholder="Ex: Abertura de caminhos financeiros, saúde para a família, proteção espiritual..."
                  />
                </div>

                {ritual.is_paid && (
                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">Forma de Pagamento</label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <label className="p-2.5 rounded-lg border border-amber-500/50 bg-stone-950 flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="payment_method"
                          value="pix_manual"
                          checked={formData.payment_method === 'pix_manual'}
                          onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                          className="text-amber-500"
                        />
                        <span className="font-semibold text-stone-200">PIX Oficial</span>
                      </label>
                      <label className="p-2.5 rounded-lg border border-stone-800 bg-stone-950 flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="payment_method"
                          value="gateway_card"
                          checked={formData.payment_method === 'gateway_card'}
                          onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                          className="text-amber-500"
                        />
                        <span className="font-semibold text-stone-200">Cartão / Gateway</span>
                      </label>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-bold text-sm shadow-lg shadow-amber-950/40 transition-all"
                >
                  Concluir Inscrição
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
