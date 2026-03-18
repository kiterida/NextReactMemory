'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Tooltip from '@mui/material/Tooltip';
import BackupIcon from '@mui/icons-material/Backup';

type BackupResponse = {
  folderPath: string;
  message: string;
};

export default function DashboardBackupButton() {
  const [isRunning, setIsRunning] = React.useState(false);
  const [snackbarOpen, setSnackbarOpen] = React.useState(false);
  const [snackbarSeverity, setSnackbarSeverity] = React.useState<'success' | 'error'>('success');
  const [snackbarMessage, setSnackbarMessage] = React.useState('');

  const handleRunBackup = async () => {
    setIsRunning(true);

    try {
      const response = await fetch('/api/backups/manual', {
        method: 'POST',
      });

      const payload = (await response.json()) as BackupResponse & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || 'Backup failed.');
      }

      setSnackbarSeverity('success');
      setSnackbarMessage(`Backup saved to ${payload.folderPath}`);
    } catch (error) {
      setSnackbarSeverity('error');
      setSnackbarMessage(error instanceof Error ? error.message : 'Backup failed.');
    } finally {
      setIsRunning(false);
      setSnackbarOpen(true);
    }
  };

  return (
    <React.Fragment>
      <Tooltip title={isRunning ? 'Backup in progress' : 'Backup Database'}>
        <span>
          <IconButton
            onClick={handleRunBackup}
            color="primary"
            aria-label="Backup Database"
            disabled={isRunning}
          >
            {isRunning ? <CircularProgress size={20} color="inherit" /> : <BackupIcon />}
          </IconButton>
        </span>
      </Tooltip>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </React.Fragment>
  );
}
