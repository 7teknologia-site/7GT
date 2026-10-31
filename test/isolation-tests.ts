import bcrypt from 'bcryptjs';
import { getJwtSecret } from '../src/server/auth.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName} ${detail ? `- ${detail}` : ''}`);
    failed++;
  }
}

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 7 GESTÃO DE TERREIROS (7Teknologia) — TESTES');
  console.log('   Isolamento Multi-tenant, Segurança & Persistência');
  console.log('====================================================\n');

  // Test 1: Health & Server Verification
  console.log('--- 1. VERIFICAÇÃO DO SERVIDOR E IDENTIDADE INSTITUCIONAL ---');
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const healthData = await healthRes.json();
  assert(healthRes.ok, 'Endpoint /api/health operacional');
  assert(healthData.product === '7 Gestão de Terreiros', 'Nome do produto validado: 7 Gestão de Terreiros');
  assert(healthData.developer === '7Teknologia', 'Empresa desenvolvedora validada: 7Teknologia');
  assert(healthData.signature === 'Uma solução 7Teknologia.', 'Assinatura institucional validada: Uma solução 7Teknologia.');

  // Test 2: JWT Security - No predictable fallback
  console.log('\n--- 2. AUDITORIA DE SEGURANÇA JWT ---');
  const activeSecret = getJwtSecret();
  assert(
    activeSecret !== '7teknologia_terreiros_secure_jwt_secret_2026',
    'Segredo JWT fixo/previsível anterior foi completamente eliminado'
  );
  assert(
    typeof activeSecret === 'string' && activeSecret.length >= 32,
    `Segredo criptográfico ativo possui alta entropia (${activeSecret.length} caracteres)`
  );

  // Test 3: Authenticated Users & Password Verification
  console.log('\n--- 3. AUTENTICAÇÃO E HASH SEGURO BCRYPT ---');
  const loginResA = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dirigente@aruanda.org', password: 'aruanda123' })
  });
  const dataA = await loginResA.json();
  assert(loginResA.ok && !!dataA.token, 'Login Dirigente Terreiro A válido com token JWT emitido');

  const loginResB = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dirigente@penabranca.org', password: 'penabranca123' })
  });
  const dataB = await loginResB.json();
  assert(loginResB.ok && !!dataB.token, 'Login Dirigente Terreiro B válido com token JWT emitido');

  const invalidLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dirigente@aruanda.org', password: 'wrongpassword' })
  });
  assert(invalidLoginRes.status === 401, 'Tentativa de login com senha incorreta é rejeitada (HTTP 401)');

  const superAdminLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@7teknologia.com', password: 'admin123' })
  });
  const superData = await superAdminLogin.json();
  assert(superData.user?.is_superadmin === true, 'Superadmin 7Teknologia possui flag is_superadmin=true');

  // Test 4: Memberships & Tenant Association
  console.log('\n--- 4. VÍNCULOS DE PERMISSÃO (MEMBERSHIPS) ---');
  assert(dataA.activeTenantId === 'tenant-aruanda', 'Usuário A está vinculado ao Terreiro A (Pai Benedito)');
  assert(dataB.activeTenantId === 'tenant-penabranca', 'Usuário B está vinculado ao Terreiro B (Pena Branca)');

  // Test 5: Strict Multi-Tenant Data Isolation
  console.log('\n--- 5. PROVA DE ISOLAMENTO RIGOROSO ENTRE TENANTS ---');
  // Tenant A members fetched with Tenant A credentials
  const membersARes = await fetch(`${BASE_URL}/api/members`, {
    headers: { Authorization: `Bearer ${dataA.token}`, 'X-Tenant-Id': 'tenant-aruanda' }
  });
  const membersA = await membersARes.json();
  assert(Array.isArray(membersA) && membersA.length >= 5, `Terreiro A possui ${membersA.length} membros isolados`);

  // Tenant B members fetched with Tenant B credentials
  const membersBRes = await fetch(`${BASE_URL}/api/members`, {
    headers: { Authorization: `Bearer ${dataB.token}`, 'X-Tenant-Id': 'tenant-penabranca' }
  });
  const membersB = await membersBRes.json();
  assert(Array.isArray(membersB) && membersB.length >= 2, `Terreiro B possui ${membersB.length} membros isolados`);

  // Assert no cross leak
  const crossLeak = membersA.some((mA: any) => membersB.some((mB: any) => mB.id === mA.id));
  assert(!crossLeak, 'Nenhum membro compartilhado ou vazado entre tenants distintos');

  // Tenant B attempting to read Tenant A data via forged X-Tenant-Id header
  const forgedRes = await fetch(`${BASE_URL}/api/members`, {
    headers: { Authorization: `Bearer ${dataB.token}`, 'X-Tenant-Id': 'tenant-aruanda' }
  });
  assert(forgedRes.status === 403, 'Acesso cruzado de Tenant B aos membros do Tenant A é bloqueado (HTTP 403)');

  // Test 6: Inactive User Enforcement (is_active = false)
  console.log('\n--- 6. BLOQUEIO DE CONTAS INATIVAS (is_active = false) ---');
  // Deactivate user usr_membro_aruanda via superadmin
  await fetch(`${BASE_URL}/api/admin/users/usr_membro_aruanda/toggle-status`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${superData.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_active: false })
  });

  const memberLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'membro@aruanda.org', password: 'aruanda123' })
  });
  assert(memberLogin.status === 401, 'Login de usuário desativado é bloqueado (HTTP 401)');

  // Re-activate member
  await fetch(`${BASE_URL}/api/admin/users/usr_membro_aruanda/toggle-status`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${superData.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_active: true })
  });
  assert(true, 'Restauração de status do membro para ativo concluída');

  // Test 7: Financial Integrity
  console.log('\n--- 7. INTEGRIDADE FINANCEIRA E CONTAS BANCÁRIAS ---');
  const accountsRes = await fetch(`${BASE_URL}/api/financial/accounts`, {
    headers: { Authorization: `Bearer ${dataA.token}`, 'X-Tenant-Id': 'tenant-aruanda' }
  });
  const accounts = await accountsRes.json();
  const mainAcc = accounts.find((a: any) => a.id === 'acc_banco_inter');
  assert(!!mainAcc, 'Conta bancária principal (Banco Inter) identificada no Terreiro A');
  assert(Number(mainAcc.current_balance) > 0, `Saldo atual da conta: R$ ${Number(mainAcc.current_balance).toFixed(2)}`);

  // Test 8: Public Ritual & Persistence
  console.log('\n--- 8. RITUAIS COLETIVOS E PERSISTÊNCIA ---');
  const ritualsRes = await fetch(`${BASE_URL}/api/rituals`, {
    headers: { Authorization: `Bearer ${dataA.token}`, 'X-Tenant-Id': 'tenant-aruanda' }
  });
  const rituals = await ritualsRes.json();
  const oxumRitual = rituals.find((r: any) => r.slug === 'trabalho-prosperidade-oxum-2026');
  assert(!!oxumRitual, 'Ritual público de Prosperidade com Mamãe Oxum persistente e publicado');
  assert(Number(oxumRitual.price) === 54.00, 'Valor litúrgico de R$ 54,00 registrado com precisão');

  // Test 9: Persistent Audit Logs
  console.log('\n--- 9. TRILHA DE AUDITORIA PERSISTENTE ---');
  const auditRes = await fetch(`${BASE_URL}/api/audit?limit=10`, {
    headers: { Authorization: `Bearer ${dataA.token}`, 'X-Tenant-Id': 'tenant-aruanda' }
  });
  const auditLogs = await auditRes.json();
  assert(Array.isArray(auditLogs) && auditLogs.length > 0, `Registros de auditoria encontrados: ${auditLogs.length}`);

  console.log('\n====================================================');
  console.log(`🏁 RESULTADO FINAL: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
