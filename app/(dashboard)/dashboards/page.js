import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { redirect } from 'next/navigation';
import { auth } from '../../../auth';
import { getPreferredDashboardForUser } from '../../lib/dashboardServer';

export default async function DashboardsIndexPage() {
  const session = await auth();
  const userId = session?.user?.email || session?.user?.name || null;
  const preferredDashboard = await getPreferredDashboardForUser(userId);

  if (preferredDashboard) {
    redirect(`/dashboards/${preferredDashboard.id}`);
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        No dashboards yet
      </Typography>
      <Typography color="text.secondary">
        Use the sidebar button to create your first dashboard.
      </Typography>
    </Box>
  );
}
