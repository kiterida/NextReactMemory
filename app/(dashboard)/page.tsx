import { redirect } from 'next/navigation';
import { auth } from '../../auth';
import { getPreferredDashboardForUser } from '../lib/dashboardServer';

export default async function HomePage() {
  const session = await auth();
  const userId = session?.user?.email || session?.user?.name || null;
  const preferredDashboard = await getPreferredDashboardForUser(userId);

  if (preferredDashboard) {
    redirect(`/dashboards/${preferredDashboard.id}`);
  }

  redirect('/dashboards');
}
