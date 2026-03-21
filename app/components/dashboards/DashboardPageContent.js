'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import EditIcon from '@mui/icons-material/Edit';
import { useRouter } from 'next/navigation';
import DashboardWidgets from '../widgets/DashboardWidgets';
import DashboardDialog from './DashboardDialog';
import { getDashboardById, updateDashboard } from './dashboardQueries';
import { getDashboardIconNode } from './dashboardIcons';

export default function DashboardPageContent({ dashboardId, userId }) {
  const router = useRouter();
  const [dashboard, setDashboard] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);

  React.useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError('');

      try {
        const data = await getDashboardById(dashboardId, userId);

        if (!active) {
          return;
        }

        setDashboard(data);

        if (!data) {
          setError('Dashboard not found.');
        }
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError.message || 'Unable to load dashboard.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, [dashboardId, userId]);

  const handleSaveDashboard = async (values) => {
    const updatedDashboard = await updateDashboard(dashboardId, values, userId);
    setDashboard(updatedDashboard);
    setDialogOpen(false);
    router.refresh();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !dashboard) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Stack spacing={3} sx={{ p: 3 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              bgcolor: dashboard?.color || 'primary.main',
              color: '#fff',
            }}
          >
            {getDashboardIconNode(dashboard?.icon)}
          </Box>

          <Box>
            <Typography variant="h4">{dashboard?.name || 'Dashboard'}</Typography>
            <Typography variant="body2" color="text.secondary">
              {dashboard?.description || 'Widgets shown here belong only to this dashboard.'}
            </Typography>
          </Box>
        </Stack>

        <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setDialogOpen(true)}>
          Edit Dashboard
        </Button>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <DashboardWidgets userId={userId} dashboardId={dashboardId} />

      <DashboardDialog
        open={dialogOpen}
        mode="edit"
        initialValues={dashboard}
        onClose={() => setDialogOpen(false)}
        onSave={handleSaveDashboard}
      />
    </Stack>
  );
}
