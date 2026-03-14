import * as React from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { auth } from '../../auth';
import R2ImageGalleryButton from '../components/R2ImageGalleryButton';
import DashboardWidgets from '../components/widgets/DashboardWidgets';

export default async function HomePage() {
  const session = await auth();
  const userId = session?.user?.email || session?.user?.name || null;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 1 }}>
        Welcome to your Memory Core, {session?.user?.name || 'User'}!
      </Typography>

      <Box sx={{ mb: 3 }}>
        <R2ImageGalleryButton />
      </Box>

      <DashboardWidgets userId={userId} dashboardId="main" />
    </Box>
  );
}
