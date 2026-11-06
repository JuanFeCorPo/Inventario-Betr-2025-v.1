// Avatar de la persona: foto de Google si la hay; si no, iniciales sobre el naranja de marca.
// Lo usan el menú de usuario de T.I. y la pantalla del colaborador.

// Iniciales: primera letra del nombre y del apellido; sin nombre, la inicial del correo.
const iniciales = (user) => {
  const partes = (user.nombre || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length) return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
  return (user.email || '?')[0].toUpperCase();
};

const Avatar = ({ user, size = 'sm' }) => {
  const dim = size === 'lg' ? 'w-11 h-11 text-base rounded-xl' : 'w-8 h-8 text-xs rounded-lg';
  return user.photoURL
    ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className={`${dim} object-cover flex-shrink-0`} />
    : <span aria-hidden="true" className={`${dim} flex items-center justify-center bg-brand-orange text-brand-cocoa font-bold flex-shrink-0`}>{iniciales(user)}</span>;
};

export default Avatar;
