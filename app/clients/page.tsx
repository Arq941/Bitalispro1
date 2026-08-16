import AppShell from '@/components/phase15/AppShell';
import ClientsScreen from './ClientsScreen';
import GeminiQuickLink from './GeminiQuickLink';

export default function ClientsPage(){
  return <AppShell title="Clientes">
    <GeminiQuickLink/>
    <ClientsScreen/>
  </AppShell>;
}
