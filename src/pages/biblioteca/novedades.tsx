import BibliotecaLayout from '@app/components/Biblioteca/BibliotecaLayout';
import Novedades from '@app/components/Biblioteca/Novedades';
import type { NextPage } from 'next';

const BibliotecaNovedadesPage: NextPage = () => {
  return (
    <BibliotecaLayout>
      <Novedades />
    </BibliotecaLayout>
  );
};

export default BibliotecaNovedadesPage;
