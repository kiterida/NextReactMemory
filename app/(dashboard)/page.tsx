import * as React from 'react';
import Box from '@mui/material/Box';
import { auth } from '../../auth';
import DashboardWidgets from '../components/widgets/DashboardWidgets';

export default async function HomePage() {
  const session = await auth();
  const userId = session?.user?.email || session?.user?.name || null;

  return (
    <Box sx={{ p: 3 }}>
      <DashboardWidgets userId={userId} dashboardId="main" />
    </Box>
  );
}
