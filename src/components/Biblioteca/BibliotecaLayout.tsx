import type { EstadoBiblioteca } from '@app/components/Biblioteca/comun';
import TutorialBiblioteca from '@app/components/Biblioteca/TutorialBiblioteca';
import Button from '@app/components/Common/Button';
import Header from '@app/components/Common/Header';
import PageTitle from '@app/components/Common/PageTitle';
import type { SettingsRoute } from '@app/components/Common/SettingsTabs';
import SettingsTabs from '@app/components/Common/SettingsTabs';
import { Permission, useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Biblioteca.BibliotecaLayout', {
  library: 'Library',
  browse: 'Browse',
  newEpisodes: 'New Episodes',
  pendingRemoval: 'Pending Removal',
  pendingRemovalCount: 'Pending Removal ({count})',
  myActivity: 'My Activity',
  settings: 'Settings',
  howItWorks: 'How It Works',
});

type BibliotecaLayoutProps = {
  children: React.ReactNode;
};

const BibliotecaLayout = ({ children }: BibliotecaLayoutProps) => {
  const intl = useIntl();
  const { hasPermission } = useUser();
  const { data: estado } = useSWR<EstadoBiblioteca>('/api/biblioteca/estado');
  const pendientes = estado?.pendientes ?? 0;
  const [tutorial, setTutorial] = useState(false);
  const rutas: SettingsRoute[] = [
    {
      text: intl.formatMessage(messages.browse),
      route: '/biblioteca',
      regex: /^\/biblioteca\/?$/,
    },
    {
      text: intl.formatMessage(messages.newEpisodes),
      route: '/biblioteca/novedades',
      regex: /^\/biblioteca\/novedades/,
    },
    {
      text: pendientes
        ? intl.formatMessage(messages.pendingRemovalCount, {
            count: pendientes,
          })
        : intl.formatMessage(messages.pendingRemoval),
      route: '/biblioteca/se-van',
      regex: /^\/biblioteca\/se-van/,
    },
    {
      text: intl.formatMessage(messages.myActivity),
      route: '/biblioteca/lo-mio',
      regex: /^\/biblioteca\/lo-mio/,
    },
    {
      text: intl.formatMessage(messages.settings),
      route: '/biblioteca/ajustes',
      regex: /^\/biblioteca\/ajustes/,
      hidden: !hasPermission(Permission.ADMIN),
    },
  ];

  return (
    <>
      <PageTitle title={intl.formatMessage(messages.library)} />
      <Header>{intl.formatMessage(messages.library)}</Header>
      <div className="mt-2">
        <Button
          buttonType="ghost"
          buttonSize="sm"
          onClick={() => setTutorial(true)}
        >
          <QuestionMarkCircleIcon />
          <span>{intl.formatMessage(messages.howItWorks)}</span>
        </Button>
      </div>
      <TutorialBiblioteca
        abierto={tutorial}
        onCerrar={() => setTutorial(false)}
      />
      <div className="mt-6">
        <SettingsTabs settingsRoutes={rutas} />
      </div>
      <div className="mt-10 text-white">{children}</div>
    </>
  );
};

export default BibliotecaLayout;
