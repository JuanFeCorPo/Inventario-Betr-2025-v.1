import { useRef } from 'react';

// true si, durante este montaje, el componente estuvo cargando. Sirve para hacer un fundido corto
// del contenido justo cuando reemplaza al esqueleto, y no animar nada cuando la pantalla
// simplemente se vuelve a abrir con los datos ya listos.
const useWasLoading = (loading) => {
  const vio = useRef(false);
  if (loading) vio.current = true;
  return vio.current;
};

export default useWasLoading;
