import { auth } from '../../../../auth';
import DashboardPageContent from '../../../components/dashboards/DashboardPageContent';

export default async function DashboardDetailsPage({ params }) {
  const session = await auth();
  const userId = session?.user?.email || session?.user?.name || null;
  const resolvedParams = await params;

  return <DashboardPageContent dashboardId={resolvedParams.dashboardId} userId={userId} />;
}
