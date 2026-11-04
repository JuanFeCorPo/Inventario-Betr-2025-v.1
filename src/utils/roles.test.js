import { describe, it, expect } from 'vitest';
import { isStaffRole, isCompanyEmail, accessForUnregistered, sortUsers } from './roles';

const google = (email, emailVerified = true) =>
  ({ email, emailVerified, providerData: [{ providerId: 'google.com' }] });

describe('isStaffRole', () => {
  it('Administrador y Lector son personal de T.I.', () => {
    expect(isStaffRole('Administrador')).toBe(true);
    expect(isStaffRole('Lector')).toBe(true);
  });
  it('un perfil antiguo sin rol cuenta como Lector', () => {
    expect(isStaffRole(undefined)).toBe(true);
  });
  it('Colaborador no', () => {
    expect(isStaffRole('Colaborador')).toBe(false);
  });
});

describe('isCompanyEmail', () => {
  it('acepta el dominio sin importar mayúsculas', () => {
    expect(isCompanyEmail('Carol.Bernal@BetrMedia.com')).toBe(true);
  });
  it('rechaza otros dominios y trampas de subdominio', () => {
    expect(isCompanyEmail('alguien@gmail.com')).toBe(false);
    expect(isCompanyEmail('x@betrmedia.com.evil.co')).toBe(false);
    expect(isCompanyEmail('x@notbetrmedia.com')).toBe(false);
    expect(isCompanyEmail(null)).toBe(false);
  });
});

describe('accessForUnregistered', () => {
  it('Google de la empresa con correo verificado → se registra', () => {
    expect(accessForUnregistered(google('carol@betrmedia.com'))).toBe('signup');
  });
  it('Google personal → no', () => {
    expect(accessForUnregistered(google('carol@gmail.com'))).toBe('deny');
  });
  it('correo sin verificar → no', () => {
    expect(accessForUnregistered(google('carol@betrmedia.com', false))).toBe('deny');
  });
  it('correo/contraseña sin perfil → no (lo registra el administrador)', () => {
    expect(accessForUnregistered({ email: 'carol@betrmedia.com', emailVerified: true,
      providerData: [{ providerId: 'password' }] })).toBe('deny');
  });
});

describe('sortUsers', () => {
  it('administradores, lectores, colaboradores; alfabético dentro', () => {
    const out = sortUsers([
      { email: 'z@x.com', role: 'Colaborador' },
      { email: 'b@x.com', role: 'Lector' },
      { email: 'a@x.com', role: 'Colaborador' },
      { email: 'c@x.com', role: 'Administrador' },
      { email: 'a@x.com' },
    ]).map(u => `${u.role ?? '-'}:${u.email}`);
    expect(out).toEqual(['Administrador:c@x.com', '-:a@x.com', 'Lector:b@x.com', 'Colaborador:a@x.com', 'Colaborador:z@x.com']);
  });
});
