// Clase única de campo para formularios y modales (un solo tamaño en toda la app).
// 16 px en celular evita el zoom automático de iOS al enfocar; 14 px desde sm.
// Foco: anillo #B86E00 (4:1 sobre blanco, el mismo color de foco de los botones).
// aria-invalid pinta el borde de error sin lógica extra en cada formulario.
export const fieldClass = 'w-full bg-brand-bg border border-brand-border text-brand-ink placeholder-brand-gray px-3.5 py-2.5 rounded-xl text-base sm:text-sm focus:outline-none focus:bg-white focus:border-transparent focus:ring-2 focus:ring-[#B86E00] transition aria-[invalid=true]:border-rose-500 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-rose-200';
