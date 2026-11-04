// ─────────────────────────────────────────────
//  Roles y acceso con Google Workspace.
//  Lógica pura (sin Firebase) para poder probarla con Vitest.
//  La seguridad real está en firestore.rules: esto solo decide qué
//  pantalla mostrar y qué mensaje dar.
// ─────────────────────────────────────────────

// Dominio de Google Workspace de la empresa. Si cambia, actualizar también
// firestore.rules (función isCompanyGoogleUser).
export const COMPANY_DOMAIN = 'betrmedia.com';

export const ROLES = ['Administrador', 'Lector', 'Colaborador'];

// Personal de T.I. que trabaja con el inventario (todo lo que no es Colaborador).
// Un perfil sin rol es un usuario antiguo: se trata como Lector.
export const isStaffRole = (role) => (role ?? 'Lector') !== 'Colaborador';

export const isCompanyEmail = (email) =>
  typeof email === 'string' && email.trim().toLowerCase().endsWith(`@${COMPANY_DOMAIN}`);

export const isGoogleUser = (fbUser) =>
  !!fbUser?.providerData?.some(p => p.providerId === 'google.com');

// Qué hacer con alguien que inició sesión pero no tiene perfil en users/.
//  'signup'  → cuenta de Google de la empresa: se registra sola como Colaborador.
//  'deny'    → cualquier otro caso (correo/contraseña sin registrar, Google personal…).
export const accessForUnregistered = (fbUser) =>
  isGoogleUser(fbUser) && fbUser.emailVerified && isCompanyEmail(fbUser.email) ? 'signup' : 'deny';

// Orden de la lista de usuarios: administradores, lectores y luego colaboradores; alfabético dentro.
export const sortUsers = (users) =>
  [...users].sort((a, b) =>
    ROLES.indexOf(a.role ?? 'Lector') - ROLES.indexOf(b.role ?? 'Lector')
    || (a.email ?? '').localeCompare(b.email ?? ''));
