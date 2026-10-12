import BibliotecaLayout from '@app/components/Biblioteca/BibliotecaLayout';
import Explorar from '@app/components/Biblioteca/Explorar';
import type { NextPage } from 'next';

const BibliotecaExplorarPage: NextPage = () => {
  return (
    <BibliotecaLayout>
      <Explorar />
    </BibliotecaLayout>
  );
};

export default BibliotecaExplorarPage;
