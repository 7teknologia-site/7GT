import { Router } from 'express';
import crypto from 'crypto';
import { query, queryOne } from '../db.js';
import { AuthenticatedRequest, authenticateToken, verifyTenantAccess, requireRole } from '../auth.js';
import { recordAuditLog } from '../audit.js';

export const ritualsRouter = Router();

// ==========================================
// 1. PUBLIC ROUTES (No login required)
// ==========================================

// Get published ritual by slug
ritualsRouter.get('/public/:slug', async (req, res) => {
  const { slug } = req.params;

  try {
    const ritual = await queryOne<any>(
      `SELECT r.*, 
              t.name as terreiro_name, t.slug as terreiro_slug, t.phone as terreiro_phone,
              s.default_pix_key, s.pix_key_type, s.pix_recipient_name, s.whatsapp_contact,
              b.primary_color, b.secondary_color, b.accent_color, b.logo_url, b.house_tradition, b.tagline
       FROM rituals r
       JOIN tenants t ON t.id = r.tenant_id
       LEFT JOIN tenant_settings s ON s.tenant_id = t.id
       LEFT JOIN tenant_branding b ON b.tenant_id = t.id
       WHERE r.slug = $1 AND r.status = 'published'`,
      [slug]
    );

    if (!ritual) {
      return res.status(404).json({ error: 'Ritual não encontrado ou inscrições encerradas.' });
    }

    const spotsRemaining = Math.max(0, ritual.max_participants - ritual.current_participants);

    res.json({
      ritual: {
        ...ritual,
        spotsRemaining,
        isSoldOut: spotsRemaining <= 0
      }
    });
  } catch (err: any) {
    console.error('Public ritual error:', err);
    res.status(500).json({ error: 'Erro ao carregar detalhes do ritual.' });
  }
});

// Register participant in ritual (Public)
ritualsRouter.post('/public/:slug/register', async (req, res) => {
  const { slug } = req.params;
  const {
    participant_name,
    participant_email,
    participant_phone,
    intentions_text,
    payment_method = 'pix_manual'
  } = req.body;

  if (!participant_name || !participant_email || !participant_phone) {
    return res.status(400).json({ error: 'Nome, e-mail e telefone são obrigatórios.' });
  }

  try {
    const ritual = await queryOne<any>(
      `SELECT r.*, s.default_pix_key, s.pix_recipient_name, s.whatsapp_contact
       FROM rituals r
       LEFT JOIN tenant_settings s ON s.tenant_id = r.tenant_id
       WHERE r.slug = $1 AND r.status = 'published'`,
      [slug]
    );

    if (!ritual) {
      return res.status(404).json({ error: 'Ritual não encontrado ou inscrições encerradas.' });
    }

    if (ritual.current_participants >= ritual.max_participants) {
      return res.status(400).json({ error: 'Vagas esgotadas para este ritual coletivo.' });
    }

    // AUDIT RULE: Check for duplicate active registration with same email
    const duplicateReg = await queryOne<any>(
      `SELECT id, registration_code, payment_status FROM ritual_registrations 
       WHERE ritual_id = $1 AND LOWER(participant_email) = LOWER($2) AND payment_status IN ('pending', 'under_review', 'confirmed')`,
      [ritual.id, participant_email]
    );

    if (duplicateReg) {
      return res.status(409).json({
        error: `Já existe uma inscrição ativa para este e-mail neste ritual (Código: ${duplicateReg.registration_code}).`,
        existingCode: duplicateReg.registration_code,
        status: duplicateReg.payment_status
      });
    }

    const regId = `reg_${crypto.randomUUID().slice(0, 8)}`;
    const randomHex = Math.floor(1000 + Math.random() * 9000);
    const regCode = `REG-${ritual.slug.slice(0, 4).toUpperCase()}-${randomHex}`;

    const isFree = !ritual.is_paid || Number(ritual.price) === 0;
    const initialStatus = isFree ? 'confirmed' : 'pending';

    await query('BEGIN');
    try {
      await query(
        `INSERT INTO ritual_registrations (
          id, tenant_id, ritual_id, registration_code, participant_name, participant_email,
          participant_phone, intentions_text, payment_method, payment_status, amount_paid
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          regId,
          ritual.tenant_id,
          ritual.id,
          regCode,
          participant_name,
          participant_email,
          participant_phone,
          intentions_text || null,
          isFree ? 'gratuito' : payment_method,
          initialStatus,
          ritual.price || 0.00
        ]
      );

      // If free, increment current participants atomically with condition
      if (isFree) {
        const updated = await queryOne<any>(
          `UPDATE rituals SET current_participants = current_participants + 1 
           WHERE id = $1 AND current_participants < max_participants
           RETURNING current_participants`,
          [ritual.id]
        );
        if (!updated) {
          throw new Error('Vagas esgotadas no momento da confirmação.');
        }
      }

      await query('COMMIT');
    } catch (txErr: any) {
      await query('ROLLBACK');
      return res.status(400).json({ error: txErr.message || 'Erro ao registrar vaga.' });
    }

    // Auto-create or link CRM contact so the house remembers the visitor
    const existingCrm = await queryOne<any>(
      'SELECT id FROM crm_contacts WHERE tenant_id = $1 AND LOWER(email) = LOWER($2)',
      [ritual.tenant_id, participant_email]
    );

    if (!existingCrm) {
      await query(
        `INSERT INTO crm_contacts (id, tenant_id, full_name, email, phone, relationship_type, source, notes)
         VALUES ($1, $2, $3, $4, $5, 'participante_ritual', 'ritual_coletivo', $6)`,
        [
          `crm_${crypto.randomUUID().slice(0, 8)}`,
          ritual.tenant_id,
          participant_name,
          participant_email,
          participant_phone,
          `Inscrito no ritual: ${ritual.title} (Código: ${regCode})`
        ]
      );
    }

    res.status(201).json({
      success: true,
      registrationCode: regCode,
      registrationId: regId,
      ritualTitle: ritual.title,
      price: ritual.price,
      pixKey: ritual.pix_key || ritual.default_pix_key,
      pixRecipient: ritual.pix_recipient_name || ritual.default_pix_recipient_name,
      whatsappContact: ritual.whatsapp_phone || ritual.whatsapp_contact,
      status: initialStatus
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Erro ao processar inscrição: ' + err.message });
  }
});

// Submit receipt for manual PIX (Public)
ritualsRouter.post('/public/receipt', async (req, res) => {
  const { registrationCode, receiptUrl, notes } = req.body;
  if (!registrationCode) {
    return res.status(400).json({ error: 'Código de inscrição é obrigatório.' });
  }

  try {
    const reg = await queryOne<any>(
      'SELECT id, tenant_id, participant_name, ritual_id, payment_status FROM ritual_registrations WHERE registration_code = $1',
      [registrationCode]
    );

    if (!reg) {
      return res.status(404).json({ error: 'Inscrição não encontrada.' });
    }

    // AUDIT RULE: Protect against altering already confirmed or closed registrations
    if (reg.payment_status === 'confirmed') {
      return res.status(400).json({
        error: 'Esta inscrição já se encontra confirmada. Não é necessário enviar novo comprovante.'
      });
    }

    if (reg.payment_status === 'rejected') {
      return res.status(400).json({
        error: 'Esta inscrição foi cancelada ou rejeitada anteriormente. Entre em contato com o terreiro.'
      });
    }

    await query(
      `UPDATE ritual_registrations SET
         manual_receipt_url = $1,
         review_notes = $2,
         payment_status = 'under_review'
       WHERE id = $3`,
      [receiptUrl || 'https://comprovantes.7teknologia.com/demo-receipt.pdf', notes || 'Enviado pelo participante', reg.id]
    );

    res.json({
      success: true,
      message: 'Comprovante recebido com sucesso! A equipe do terreiro irá conferir e confirmar sua vaga.'
    });
  } catch (err: any) {
    console.error('Receipt submit error:', err);
    res.status(500).json({ error: 'Erro ao registrar comprovante.' });
  }
});

// ==========================================
// 2. ADMIN PROTECTED ROUTES
// ==========================================

ritualsRouter.use(authenticateToken);
ritualsRouter.use(verifyTenantAccess);

// List rituals for active tenant
ritualsRouter.get('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;

  try {
    const rituals = await query<any>(
      `SELECT r.*,
              (SELECT COUNT(*) FROM ritual_registrations reg WHERE reg.ritual_id = r.id AND reg.payment_status = 'confirmed') as confirmed_count,
              (SELECT COUNT(*) FROM ritual_registrations reg WHERE reg.ritual_id = r.id AND reg.payment_status = 'under_review') as pending_review_count
       FROM rituals r
       WHERE r.tenant_id = $1
       ORDER BY r.ritual_date DESC`,
      [tenantId]
    );

    res.json(rituals);
  } catch (err: any) {
    console.error('List rituals error:', err);
    res.status(500).json({ error: 'Erro ao listar rituais.' });
  }
});

// Create new ritual
ritualsRouter.post('/', requireRole(['dirigente', 'admin_casa', 'responsavel_rituais']), async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const user = req.user!;
  const {
    title,
    subtitle,
    description,
    spiritual_guidance,
    ritual_date,
    cutoff_date,
    is_paid = true,
    price = 0.00,
    max_participants = 100,
    status = 'published',
    pix_key,
    pix_recipient_name,
    whatsapp_phone
  } = req.body;

  if (!title || !description || !ritual_date) {
    return res.status(400).json({ error: 'Título, descrição e data do ritual são obrigatórios.' });
  }

  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') + `-${Math.floor(100 + Math.random() * 900)}`;

  const id = `rtl_${crypto.randomUUID().slice(0, 8)}`;

  try {
    await query(
      `INSERT INTO rituals (
        id, tenant_id, slug, title, subtitle, description, spiritual_guidance,
        ritual_date, cutoff_date, is_paid, price, max_participants, status,
        pix_key, pix_recipient_name, whatsapp_phone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        id,
        tenantId,
        slug,
        title,
        subtitle || null,
        description,
        spiritual_guidance || null,
        ritual_date,
        cutoff_date || ritual_date,
        is_paid,
        price,
        max_participants,
        status,
        pix_key || null,
        pix_recipient_name || null,
        whatsapp_phone || null
      ]
    );

    await recordAuditLog({
      tenantId,
      actorId: user.id,
      actorName: user.full_name,
      action: 'RITUAL_CREATED',
      entityType: 'rituals',
      entityId: id,
      details: { title, slug, price }
    });

    const newRitual = await queryOne('SELECT * FROM rituals WHERE id = $1', [id]);
    res.status(201).json(newRitual);
  } catch (err: any) {
    console.error('Create ritual error:', err);
    res.status(500).json({ error: 'Erro ao cadastrar ritual: ' + err.message });
  }
});

// List registrations for ritual
ritualsRouter.get('/:id/registrations', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const { id } = req.params;

  try {
    const registrations = await query<any>(
      `SELECT reg.*, u.full_name as reviewer_name
       FROM ritual_registrations reg
       LEFT JOIN users u ON u.id = reg.reviewed_by
       WHERE reg.ritual_id = $1 AND reg.tenant_id = $2
       ORDER BY reg.created_at DESC`,
      [id, tenantId]
    );

    res.json(registrations);
  } catch (err: any) {
    console.error('List registrations error:', err);
    res.status(500).json({ error: 'Erro ao listar inscrições.' });
  }
});

// Review manual payment (Approve or Reject with audit trail and financial integration)
ritualsRouter.post('/registrations/:regId/review', requireRole(['dirigente', 'admin_casa', 'financeiro']), async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const { regId } = req.params;
  const { action, review_notes } = req.body; // action: 'approve' | 'reject'
  const user = req.user!;

  if (!action || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: "Ação inválida. Escolha 'approve' ou 'reject'." });
  }

  try {
    const reg = await queryOne<any>(
      `SELECT reg.*, r.title as ritual_title, r.price, r.current_participants
       FROM ritual_registrations reg
       JOIN rituals r ON r.id = reg.ritual_id
       WHERE reg.id = $1 AND reg.tenant_id = $2`,
      [regId, tenantId]
    );

    if (!reg) {
      return res.status(404).json({ error: 'Inscrição não encontrada.' });
    }

    // AUDIT RULE: Prevent repeated approval that duplicates revenue or spots
    if (reg.payment_status === 'confirmed') {
      return res.status(400).json({
        error: 'Esta inscrição já foi aprovada e confirmada anteriormente. Não é permitida aprovação duplicada.'
      });
    }

    if (action === 'approve') {
      await query('BEGIN');
      try {
        // 1. Update registration status
        await query(
          `UPDATE ritual_registrations SET
             payment_status = 'confirmed',
             reviewed_by = $1,
             reviewed_at = CURRENT_TIMESTAMP,
             review_notes = $2
           WHERE id = $3 AND tenant_id = $4`,
          [user.id, review_notes || 'Comprovante PIX aprovado pelo financeiro.', regId, tenantId]
        );

        // 2. Increment participant count on ritual with capacity check
        const spotCheck = await queryOne<any>(
          `UPDATE rituals SET current_participants = current_participants + 1 
           WHERE id = $1 AND current_participants < max_participants
           RETURNING current_participants, max_participants`,
          [reg.ritual_id]
        );

        if (!spotCheck) {
          throw new Error('Não há vagas disponíveis neste ritual para aprovação.');
        }

        // 3. Integrate with Financial module: create revenue transaction atomically
        const account = await queryOne<any>(
          "SELECT id FROM financial_accounts WHERE tenant_id = $1 AND is_active = true ORDER BY (type = 'pix') DESC LIMIT 1",
          [tenantId]
        );
        const category = await queryOne<any>(
          "SELECT id FROM financial_categories WHERE tenant_id = $1 AND type = 'revenue' AND (name ILIKE '%ritual%' OR name ILIKE '%inscri%') LIMIT 1",
          [tenantId]
        );

        if (account && category && Number(reg.amount_paid) > 0) {
          const txnId = `txn_${crypto.randomUUID().slice(0, 8)}`;
          await query(
            `INSERT INTO financial_transactions (
               id, tenant_id, account_id, category_id, type, amount, description,
               due_date, payment_date, status, payment_method, payer_or_payee, ritual_id, ritual_registration_id, notes
             ) VALUES ($1, $2, $3, $4, 'revenue', $5, $6, CURRENT_DATE, CURRENT_DATE, 'completed', 'pix', $7, $8, $9, $10)`,
            [
              txnId,
              tenantId,
              account.id,
              category.id,
              reg.amount_paid,
              `Inscrição Ritual: ${reg.ritual_title} (${reg.registration_code})`,
              reg.participant_name,
              reg.ritual_id,
              reg.id,
              `Aprovado por ${user.full_name}. Comprovante: ${reg.manual_receipt_url || 'conferido'}`
            ]
          );

          // Update account balance
          await query(
            'UPDATE financial_accounts SET current_balance = current_balance + $1 WHERE id = $2 AND tenant_id = $3',
            [reg.amount_paid, account.id, tenantId]
          );
        }

        await query('COMMIT');
      } catch (txErr: any) {
        await query('ROLLBACK');
        return res.status(400).json({ error: txErr.message || 'Erro ao processar aprovação.' });
      }

      await recordAuditLog({
        tenantId,
        actorId: user.id,
        actorName: user.full_name,
        action: 'RITUAL_PAYMENT_APPROVED',
        entityType: 'ritual_registrations',
        entityId: regId,
        details: { participant: reg.participant_name, amount: reg.amount_paid, code: reg.registration_code }
      });

      res.json({ success: true, message: 'Inscrição e pagamento aprovados com sucesso!' });
    } else {
      // Reject
      await query(
        `UPDATE ritual_registrations SET
           payment_status = 'rejected',
           reviewed_by = $1,
           reviewed_at = CURRENT_TIMESTAMP,
           review_notes = $2
         WHERE id = $3 AND tenant_id = $4`,
        [user.id, review_notes || 'Comprovante não reconhecido ou cancelado.', regId, tenantId]
      );

      await recordAuditLog({
        tenantId,
        actorId: user.id,
        actorName: user.full_name,
        action: 'RITUAL_PAYMENT_REJECTED',
        entityType: 'ritual_registrations',
        entityId: regId,
        details: { participant: reg.participant_name, reason: review_notes }
      });

      res.json({ success: true, message: 'Inscrição rejeitada com justificativa registrada.' });
    }
  } catch (err: any) {
    console.error('Review payment error:', err);
    res.status(500).json({ error: 'Erro ao processar conferência do pagamento: ' + err.message });
  }
});

// Cancel a registration (reverses spot and cancels financial record if any)
ritualsRouter.post('/registrations/:regId/cancel', requireRole(['dirigente', 'admin_casa', 'financeiro']), async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const { regId } = req.params;
  const { reason } = req.body;
  const user = req.user!;

  try {
    const reg = await queryOne<any>(
      `SELECT reg.*, r.title as ritual_title FROM ritual_registrations reg
       JOIN rituals r ON r.id = reg.ritual_id
       WHERE reg.id = $1 AND reg.tenant_id = $2`,
      [regId, tenantId]
    );

    if (!reg) {
      return res.status(404).json({ error: 'Inscrição não encontrada.' });
    }

    if (reg.payment_status === 'rejected' || reg.payment_status === 'refunded') {
      return res.status(400).json({ error: 'Esta inscrição já se encontra cancelada ou estornada.' });
    }

    const wasConfirmed = reg.payment_status === 'confirmed';

    await query('BEGIN');
    try {
      // 1. Mark registration as refunded / cancelled
      await query(
        `UPDATE ritual_registrations SET
           payment_status = 'refunded',
           review_notes = $1,
           reviewed_by = $2,
           reviewed_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND tenant_id = $4`,
        [`Cancelado: ${reason || 'Solicitação de cancelamento'}`, user.id, regId, tenantId]
      );

      // 2. Decrement spots if it was confirmed
      if (wasConfirmed) {
        await query(
          'UPDATE rituals SET current_participants = GREATEST(0, current_participants - 1) WHERE id = $1',
          [reg.ritual_id]
        );

        // 3. Cancel linked financial transaction if any
        const linkedTxn = await queryOne<any>(
          `SELECT id, account_id, amount FROM financial_transactions 
           WHERE ritual_registration_id = $1 AND tenant_id = $2 AND status = 'completed'`,
          [regId, tenantId]
        );

        if (linkedTxn) {
          await query(
            `UPDATE financial_transactions SET 
               status = 'cancelled', 
               notes = 'Estorno automático por cancelamento de inscrição no ritual',
               updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [linkedTxn.id]
          );

          // Reverse account balance
          await query(
            'UPDATE financial_accounts SET current_balance = current_balance - $1 WHERE id = $2 AND tenant_id = $3',
            [linkedTxn.amount, linkedTxn.account_id, tenantId]
          );
        }
      }

      await query('COMMIT');
    } catch (txErr: any) {
      await query('ROLLBACK');
      throw txErr;
    }

    await recordAuditLog({
      tenantId,
      actorId: user.id,
      actorName: user.full_name,
      action: 'RITUAL_REGISTRATION_CANCELLED',
      entityType: 'ritual_registrations',
      entityId: regId,
      details: { participant: reg.participant_name, wasConfirmed, reason }
    });

    res.json({ success: true, message: 'Inscrição cancelada com sucesso.' });
  } catch (err: any) {
    console.error('Cancel registration error:', err);
    res.status(500).json({ error: 'Erro ao cancelar inscrição: ' + err.message });
  }
});
