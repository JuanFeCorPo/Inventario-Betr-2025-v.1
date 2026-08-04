import { describe, it, expect, vi, beforeEach } from 'vitest';

// Firestore real no está disponible en las pruebas unitarias — se simula
// con un mapa en memoria que se comporta como una colección de documentos.
const store = new Map();

vi.mock('firebase/firestore', () => ({
  doc: (_db, path, id) => ({ id: `${path}/${id}` }),
  getDoc: async (ref) => {
    const data = store.get(ref.id);
    return { exists: () => data !== undefined, data: () => data };
  },
  setDoc: async (ref, data) => { store.set(ref.id, data); },
  Timestamp: {
    now: () => ({ toMillis: () => Date.now() }),
    fromMillis: (ms) => ({ toMillis: () => ms }),
  },
}));

const { isLoginLocked, recordFailedLogin, clearLoginAttempts, MAX_LOGIN_ATTEMPTS } = await import('./loginLockout');

const db = {}; // no se usa realmente, solo se reenvía a doc()

beforeEach(() => store.clear());

describe('recordFailedLogin / isLoginLocked', () => {
  it('no bloquea antes de alcanzar el umbral de intentos', async () => {
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS - 1; i++) {
      await recordFailedLogin(db, 'user@betrmedia.com');
    }
    expect(await isLoginLocked(db, 'user@betrmedia.com')).toBe(false);
  });

  it('bloquea al llegar al umbral de intentos fallidos', async () => {
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
      await recordFailedLogin(db, 'user@betrmedia.com');
    }
    expect(await isLoginLocked(db, 'user@betrmedia.com')).toBe(true);
  });

  it('normaliza el correo (mayúsculas/espacios) para el mismo bloqueo', async () => {
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
      await recordFailedLogin(db, '  User@Betrmedia.com  ');
    }
    expect(await isLoginLocked(db, 'user@betrmedia.com')).toBe(true);
  });

  it('no afecta el contador de un correo distinto', async () => {
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
      await recordFailedLogin(db, 'atacante@ejemplo.com');
    }
    expect(await isLoginLocked(db, 'victima@betrmedia.com')).toBe(false);
  });
});

describe('clearLoginAttempts', () => {
  it('desbloquea y reinicia el contador tras un login exitoso', async () => {
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
      await recordFailedLogin(db, 'user@betrmedia.com');
    }
    expect(await isLoginLocked(db, 'user@betrmedia.com')).toBe(true);

    await clearLoginAttempts(db, 'user@betrmedia.com');
    expect(await isLoginLocked(db, 'user@betrmedia.com')).toBe(false);

    // y puede volver a fallar 2 veces más sin bloquearse (el contador quedó en 0)
    await recordFailedLogin(db, 'user@betrmedia.com');
    await recordFailedLogin(db, 'user@betrmedia.com');
    expect(await isLoginLocked(db, 'user@betrmedia.com')).toBe(false);
  });
});
