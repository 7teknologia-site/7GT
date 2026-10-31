import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query, queryOne } from '../db.js';
import { generateToken, AuthenticatedRequest, authenticateToken } from '../auth.js';
import { recordAuditLog } from '../audit.js';

export const authRouter = Router();

// Login
authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Informe e-mail e senha.' });
  }

  try {
    const user = await queryOne<any>(
      'SELECT id, email, password_hash, full_name, avatar_url, is_superadmin, is_active FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Credenciais inválidas ou usuário inativo.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    // Get user's memberships and available tenants
    const memberships = await query<any>(
      `SELECT m.id as membership_id, m.role, m.status, 
              t.id as tenant_id, t.name as tenant_name, t.slug as tenant_slug,
              b.primary_color, b.accent_color, b.logo_url
       FROM memberships m
       JOIN tenants t ON t.id = m.tenant_id
       LEFT JOIN tenant_branding b ON b.tenant_id = t.id
       WHERE m.user_id = $1 AND m.status = 'active' AND t.is_active = true`,
      [user.id]
    );

    // Pick active tenant: default to first membership or if superadmin, first available tenant
    let activeTenantId: string | undefined = memberships[0]?.tenant_id;
    if (!activeTenantId && user.is_superadmin) {
      const firstTenant = await queryOne<any>('SELECT id FROM tenants WHERE is_active = true LIMIT 1');
      activeTenantId = firstTenant?.id;
    }

    const token = generateToken(user, activeTenantId);

    await recordAuditLog({
      tenantId: activeTenantId,
      actorId: user.id,
      actorName: user.full_name,
      action: 'USER_LOGIN',
      entityType: 'users',
      entityId: user.id,
      details: { email: user.email },
      ipAddress: req.ip
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        is_superadmin: user.is_superadmin
      },
      memberships,
      activeTenantId
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erro interno ao realizar autenticação.' });
  }
});

// Current user profile & current tenant context
authRouter.get('/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const memberships = await query<any>(
      `SELECT m.id as membership_id, m.role, m.status, 
              t.id as tenant_id, t.name as tenant_name, t.slug as tenant_slug,
              b.primary_color, b.accent_color, b.logo_url, b.house_tradition, b.tagline
       FROM memberships m
       JOIN tenants t ON t.id = m.tenant_id
       LEFT JOIN tenant_branding b ON b.tenant_id = t.id
       WHERE m.user_id = $1 AND m.status = 'active' AND t.is_active = true`,
      [user.id]
    );

    // Get active tenant details
    const activeTenantId = req.activeTenantId || memberships[0]?.tenant_id;
    let activeTenant = null;
    let activeMembership = null;

    if (activeTenantId) {
      activeTenant = await queryOne<any>(
        `SELECT t.*, s.default_pix_key, s.pix_key_type, s.pix_recipient_name, s.whatsapp_contact,
                b.primary_color, b.secondary_color, b.accent_color, b.logo_url, b.house_tradition, b.tagline,
                p.name as plan_name, p.code as plan_code, p.max_members, p.max_rituals_per_month
         FROM tenants t
         LEFT JOIN tenant_settings s ON s.tenant_id = t.id
         LEFT JOIN tenant_branding b ON b.tenant_id = t.id
         LEFT JOIN plans p ON p.id = t.plan_id
         WHERE t.id = $1`,
        [activeTenantId]
      );
      activeMembership = memberships.find((m) => m.tenant_id === activeTenantId);
    }

    res.json({
      user,
      memberships,
      activeTenantId,
      activeTenant,
      activeRole: user.is_superadmin ? 'superadmin' : activeMembership?.role || null
    });
  } catch (err: any) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Erro ao carregar dados do usuário.' });
  }
});

// Switch active tenant
authRouter.post('/switch-tenant', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { tenantId } = req.body;
  if (!tenantId) {
    return res.status(400).json({ error: 'tenantId é obrigatório.' });
  }

  const user = req.user!;
  if (!user.is_superadmin) {
    const membership = await queryOne<any>(
      'SELECT id, role FROM memberships WHERE user_id = $1 AND tenant_id = $2 AND status = $3',
      [user.id, tenantId, 'active']
    );
    if (!membership) {
      return res.status(403).json({ error: 'Você não tem permissão para acessar este terreiro.' });
    }
  }

  const token = generateToken(user, tenantId);
  res.json({ success: true, token, activeTenantId: tenantId });
});

// Register new Terreiro SaaS signup
authRouter.post('/register-tenant', async (req, res) => {
  const {
    terreiroName,
    leaderName,
    email,
    password,
    phone,
    city,
    state,
    tradition,
    planCode = 'gestao'
  } = req.body;

  if (!terreiroName || !leaderName || !email || !password) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
  }

  try {
    const existingUser = await queryOne('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existingUser) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado na plataforma.' });
    }

    const plan = await queryOne<any>('SELECT id FROM plans WHERE code = $1', [planCode]) || { id: 'plan_gestao' };

    const tenantId = `tenant_${crypto.randomUUID().slice(0, 8)}`;
    const slug = terreiroName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') + `-${Math.floor(100 + Math.random() * 900)}`;

    const userId = `usr_${crypto.randomUUID().slice(0, 8)}`;
    const passwordHash = await bcrypt.hash(password, 10);

    // 1. Create tenant
    await query(
      `INSERT INTO tenants (id, slug, name, email, phone, address_city, address_state, plan_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tenantId, slug, terreiroName, email, phone || null, city || 'São Paulo', state || 'SP', plan.id]
    );

    // 2. Settings & Branding
    await query(
      `INSERT INTO tenant_settings (tenant_id, whatsapp_contact) VALUES ($1, $2)`,
      [tenantId, phone || null]
    );

    await query(
      `INSERT INTO tenant_branding (tenant_id, house_tradition) VALUES ($1, $2)`,
      [tenantId, tradition || 'Umbanda']
    );

    // 3. User
    await query(
      `INSERT INTO users (id, email, password_hash, full_name, phone)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, email, passwordHash, leaderName, phone || null]
    );

    // 4. Membership as Dirigente
    await query(
      `INSERT INTO memberships (id, user_id, tenant_id, role)
       VALUES ($1, $2, $3, 'dirigente')`,
      [`mem_${crypto.randomUUID().slice(0, 8)}`, userId, tenantId]
    );

    // 5. Default pipeline stages
    const defaultStages = [
      { name: 'Novo Contato', order: 1, color: '#3b82f6' },
      { name: 'Primeiro Contato Feito', order: 2, color: '#8b5cf6' },
      { name: 'Informações Fornecidas', order: 3, color: '#eab308' },
      { name: 'Inscrito em Gira / Evento', order: 4, color: '#06b6d4' },
      { name: 'Compareceu ao Templo', order: 5, color: '#10b981' },
      { name: 'Membro Integrado', order: 6, color: '#059669', is_terminal: true }
    ];

    for (const st of defaultStages) {
      await query(
        `INSERT INTO crm_pipeline_stages (id, tenant_id, name, order_index, color, is_terminal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [`stg_${crypto.randomUUID().slice(0, 8)}`, tenantId, st.name, st.order, st.color, !!st.is_terminal]
      );
    }

    // 6. Default financial categories
    const defaultCategories = [
      { name: 'Mensalidades da Corrente', type: 'revenue', color: '#10b981' },
      { name: 'Doações e Caridade', type: 'revenue', color: '#34d399' },
      { name: 'Inscrições em Rituais', type: 'revenue', color: '#6ee7b7' },
      { name: 'Aluguel do Templo', type: 'expense', color: '#ef4444' },
      { name: 'Energia Elétrica e Água', type: 'expense', color: '#f87171' },
      { name: 'Velas e Defumadores', type: 'expense', color: '#fb923c' }
    ];

    for (const c of defaultCategories) {
      await query(
        `INSERT INTO financial_categories (id, tenant_id, name, type, color, is_system)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [`cat_${crypto.randomUUID().slice(0, 8)}`, tenantId, c.name, c.type, c.color]
      );
    }

    // 7. Default account
    await query(
      `INSERT INTO financial_accounts (id, tenant_id, name, type, initial_balance, current_balance)
       VALUES ($1, $2, 'Conta Principal Terreiro', 'bank', 0.00, 0.00)`,
      [`acc_${crypto.randomUUID().slice(0, 8)}`, tenantId]
    );

    // Audit log
    await recordAuditLog({
      tenantId,
      actorId: userId,
      actorName: leaderName,
      action: 'TENANT_REGISTERED',
      entityType: 'tenants',
      entityId: tenantId,
      details: { terreiroName, planCode }
    });

    const token = generateToken({ id: userId, email, full_name: leaderName, is_superadmin: false }, tenantId);

    res.json({
      success: true,
      token,
      tenant: { id: tenantId, name: terreiroName, slug }
    });
  } catch (err: any) {
    console.error('Register tenant error:', err);
    res.status(500).json({ error: 'Erro ao cadastrar novo terreiro: ' + err.message });
  }
});
