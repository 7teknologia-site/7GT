import { Router } from 'express';
import { query, queryOne } from '../db.js';
import { AuthenticatedRequest, authenticateToken, verifyTenantAccess, requireRole } from '../auth.js';
import { recordAuditLog } from '../audit.js';

export const settingsRouter = Router();

settingsRouter.use(authenticateToken);
settingsRouter.use(verifyTenantAccess);

// Get current settings and branding
settingsRouter.get('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  try {
    const tenant = await queryOne<any>(
      `SELECT t.*, s.default_pix_key, s.pix_key_type, s.pix_recipient_name, s.whatsapp_contact,
              s.allow_public_rituals, s.auto_notify_whatsapp, s.auto_notify_email,
              b.primary_color, b.secondary_color, b.accent_color, b.logo_url, b.banner_url,
              b.house_tradition, b.tagline,
              p.name as plan_name, p.code as plan_code, p.max_members, p.max_rituals_per_month
       FROM tenants t
       LEFT JOIN tenant_settings s ON s.tenant_id = t.id
       LEFT JOIN tenant_branding b ON b.tenant_id = t.id
       LEFT JOIN plans p ON p.id = t.plan_id
       WHERE t.id = $1`,
      [tenantId]
    );

    res.json(tenant);
  } catch (err: any) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Erro ao buscar configurações.' });
  }
});

// Update settings & branding
settingsRouter.put('/', requireRole(['dirigente', 'admin_casa']), async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const user = req.user!;
  const {
    name,
    legal_name,
    document_cnpj,
    email,
    phone,
    address_city,
    address_state,
    default_pix_key,
    pix_key_type,
    pix_recipient_name,
    whatsapp_contact,
    primary_color,
    secondary_color,
    accent_color,
    house_tradition,
    tagline
  } = req.body;

  try {
    // 1. Update tenants table
    await query(
      `UPDATE tenants SET
         name = COALESCE($1, name),
         legal_name = $2,
         document_cnpj = $3,
         email = COALESCE($4, email),
         phone = $5,
         address_city = $6,
         address_state = $7,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $8`,
      [name, legal_name || null, document_cnpj || null, email, phone || null, address_city || null, address_state || null, tenantId]
    );

    // 2. Update tenant_settings
    await query(
      `INSERT INTO tenant_settings (tenant_id, default_pix_key, pix_key_type, pix_recipient_name, whatsapp_contact)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id) DO UPDATE SET
         default_pix_key = EXCLUDED.default_pix_key,
         pix_key_type = EXCLUDED.pix_key_type,
         pix_recipient_name = EXCLUDED.pix_recipient_name,
         whatsapp_contact = EXCLUDED.whatsapp_contact,
         updated_at = CURRENT_TIMESTAMP`,
      [tenantId, default_pix_key || null, pix_key_type || 'chave_aleatoria', pix_recipient_name || null, whatsapp_contact || null]
    );

    // 3. Update tenant_branding
    await query(
      `INSERT INTO tenant_branding (tenant_id, primary_color, secondary_color, accent_color, house_tradition, tagline)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id) DO UPDATE SET
         primary_color = COALESCE(EXCLUDED.primary_color, tenant_branding.primary_color),
         secondary_color = COALESCE(EXCLUDED.secondary_color, tenant_branding.secondary_color),
         accent_color = COALESCE(EXCLUDED.accent_color, tenant_branding.accent_color),
         house_tradition = COALESCE(EXCLUDED.house_tradition, tenant_branding.house_tradition),
         tagline = EXCLUDED.tagline,
         updated_at = CURRENT_TIMESTAMP`,
      [tenantId, primary_color || '#0e382b', secondary_color || '#1b4d3e', accent_color || '#c5a059', house_tradition || 'Umbanda', tagline || null]
    );

    await recordAuditLog({
      tenantId,
      actorId: user.id,
      actorName: user.full_name,
      action: 'TENANT_SETTINGS_UPDATED',
      entityType: 'tenant_settings',
      entityId: tenantId,
      details: { name, house_tradition }
    });

    res.json({ success: true, message: 'Configurações atualizadas com sucesso!' });
  } catch (err: any) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Erro ao salvar configurações: ' + err.message });
  }
});
