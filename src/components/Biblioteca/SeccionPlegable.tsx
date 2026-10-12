import { useUser } from '@app/hooks/useUser';
import { ChevronDownIcon } from '@heroicons/react/24/solid';
import { useEffect, useState } from 'react';

// Secciones plegadas de cada usuario, guardadas en este navegador
const claveAlmacen = (usuario: number) => `biblioteca-plegadas-${usuario}`;

const leerPlegadas = (usuario: number): string[] => {
  try {
    const valor = window.localStorage.getItem(claveAlmacen(usuario));
    const lista = valor ? JSON.parse(valor) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
};

const guardarPlegadas = (usuario: number, lista: string[]) => {
  try {
    window.localStorage.setItem(claveAlmacen(usuario), JSON.stringify(lista));
  } catch {
    // Sin almacenamiento (ventana privada...): solo dura hasta recargar
  }
};

// Seccion con titulo que se pliega al pulsarlo; abierta por defecto. El
// resumen (totales) se ve tambien plegada.
const SeccionPlegable = ({
  id,
  titulo,
  resumen,
  grande = false,
  className = 'mb-10',
  children,
}: {
  id: string;
  titulo: string;
  resumen?: React.ReactNode;
  // Titulo como los de Se van (mas grande que el "heading" de Seerr)
  grande?: boolean;
  className?: string;
  children: React.ReactNode;
}) => {
  const { user } = useUser();
  const usuario = user?.id ?? 0;
  const [abierta, setAbierta] = useState(true);

  useEffect(() => {
    if (usuario) setAbierta(!leerPlegadas(usuario).includes(id));
  }, [usuario, id]);

  const alternar = () => {
    const nueva = !abierta;
    setAbierta(nueva);
    if (!usuario) return;
    const resto = leerPlegadas(usuario).filter((x) => x !== id);
    guardarPlegadas(usuario, nueva ? resto : [...resto, id]);
  };

  return (
    <section className={className}>
      <button
        type="button"
        onClick={alternar}
        aria-expanded={abierta}
        className="group flex w-full items-start text-left"
      >
        <ChevronDownIcon
          className={`mr-2 mt-1 h-5 w-5 flex-shrink-0 text-gray-400 transition-transform group-hover:text-white ${
            abierta ? '' : '-rotate-90'
          }`}
        />
        <span className="min-w-0">
          <span
            className={
              grande
                ? 'block text-lg font-bold text-white'
                : 'heading block group-hover:text-white'
            }
          >
            {titulo}
          </span>
          {resumen && (
            <span className="block text-sm text-gray-400">{resumen}</span>
          )}
        </span>
      </button>
      {abierta && <div className="mt-2">{children}</div>}
    </section>
  );
};

export default SeccionPlegable;
