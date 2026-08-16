import AppShell from '@/components/phase15/AppShell';
import ClientsScreen from './ClientsScreen';
import OcrQuickLink from './OcrQuickLink';

export default function ClientsPage(){
  return <AppShell title="Clientes">
    <OcrQuickLink/>
    <ClientsScreen/>
  </AppShell>;
}
