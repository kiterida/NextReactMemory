'use client';

import * as React from 'react';
import AddIcon from '@mui/icons-material/Add';
import StorageIcon from '@mui/icons-material/Storage';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import DashboardDialog from './DashboardDialog';
import { createDashboard } from './dashboardQueries';

function getUserId(session) {
  return session?.user?.email || session?.user?.name || null;
}

export default function DashboardSidebarFooter({ mini = false }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [open, setOpen] = React.useState(false);
  const userId = getUserId(session);

  const handleCreateDashboard = async (values) => {
    const createdDashboard = await createDashboard({
      userId,
      ...values,
    });

    setOpen(false);
    router.push(`/dashboards/${createdDashboard.id}`);
    router.refresh();
  };

  return (
    <React.Fragment>
      <Stack spacing={1} sx={{ px: mini ? 1 : 2, py: 1.5 }}>
        <Button
          variant="contained"
          startIcon={mini ? null : <AddIcon />}
          onClick={() => setOpen(true)}
          disabled={!userId}
          sx={{ minWidth: 0 }}
        >
          {mini ? <AddIcon fontSize="small" /> : 'New Dashboard'}
        </Button>

        <Button
          variant="outlined"
          startIcon={mini ? null : <StorageIcon />}
          onClick={() => router.push('/usage')}
          sx={{ minWidth: 0 }}
        >
          {mini ? <StorageIcon fontSize="small" /> : 'Storage Usage'}
        </Button>

        {!mini ? (
          <Typography variant="caption" color="text.secondary">
            Create a dashboard and its widgets will stay isolated to that view.
          </Typography>
        ) : null}
      </Stack>

      <DashboardDialog
        open={open}
        mode="create"
        onClose={() => setOpen(false)}
        onSave={handleCreateDashboard}
      />
    </React.Fragment>
  );
}

