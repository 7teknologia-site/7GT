import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { queryOne, query } from './db.js';

let ephemeralSecret: string | null = null;

export function getJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET?.trim();
  if (process.env.NODE_ENV === 'production') {
    if (!envSecret || envSecret.length < 32) {
      throw new Error(
        'FALHA CRÍTICA DE SEGURANÇA: A variável de ambiente JWT_SECRET é estritamente obrigatória em produção e deve conter no mínimo 32 caracteres seguros.'
      );
    }
    return envSecret;
  }

  if (envSecret && envSecret.length >= 16) {
    return envSecret;
  }

  // Gera segredo criptográfico aleatório único e não-previsível para a sessão em desenvolvimento/testes
  if (!ephemeralSecret) {
    ephemeralSecret = crypto.randomBytes(32).toString('hex');
  }
  return ephemeralSecret;
}

export const JWT_SECRET = getJwtSecret();

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  is_superadmin: boolean;
  avatar_url?: string;
  is_active?: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  activeTenantId?: string;
  userRole?: string;
}

export function generateToken(user: AuthUser, activeTenantId?: string): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      isSuperadmin: user.is_superadmin,
      activeTenantId
    },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
}

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Autenticação necessária. Token ausente.' });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret()) as any;
    const user = await queryOne<AuthUser>(
      'SELECT id, email, full_name, avatar_url, is_superadmin, is_active FROM users WHERE id = $1',
      [payload.userId]
    );

    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado.' });
    }

    if (user.is_active === false) {
      return res.status(403).json({ error: 'Acesso negado. Usuário inativo ou desativado pela administração.' });
    }

    req.user = user;
    // Client can provide X-Tenant-Id or payload token
    const requestedTenantId = (req.headers['x-tenant-id'] as string) || payload.activeTenantId;
    req.activeTenantId = requestedTenantId;

    next();
  } catch (err) {
    return res.status(403).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
  }
}

export async function verifyTenantAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const tenantId = req.activeTenantId;
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ativo não especificado no cabeçalho x-tenant-id ou token.' });
  }

  // Superadmins have universal access across tenants
  if (req.user.is_superadmin) {
    req.userRole = 'superadmin';
    return next();
  }

  // Check user membership in this specific tenant
  const membership = await queryOne<{ role: string; status: string }>(
    'SELECT role, status FROM memberships WHERE user_id = $1 AND tenant_id = $2',
    [req.user.id, tenantId]
  );

  if (!membership || membership.status !== 'active') {
    return res.status(403).json({
      error: 'Acesso negado. Você não possui permissão ativa para acessar os dados deste terreiro.',
      tenantId
    });
  }

  req.userRole = membership.role;
  next();
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (req.user?.is_superadmin) {
      return next();
    }
    if (!req.userRole || !allowedRoles.includes(req.userRole)) {
      return res.status(403).json({
        error: `Ação não autorizada para o seu perfil (${req.userRole || 'sem papel'}). Permissão restrita.`
      });
    }
    next();
  };
}
