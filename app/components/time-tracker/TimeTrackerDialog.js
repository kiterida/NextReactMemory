'use client';

import * as React from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import MinimizeIcon from '@mui/icons-material/Minimize';
import { useTimeTracker } from './TimeTrackerContext';
import { formatDuration, getSessionDurationSeconds } from '@/app/lib/timeTracker';

export default function TimeTrackerDialog() {
  const {
    activeSession,
    draft,
    isDialogOpen,
    isSaving,
    error,
    memoryItemOptions,
    memoryItemOptionsLoading,
    setDraftValue,
    closeDialog,
    minimizeDialog,
    startSession,
    stopSession,
    loadMemoryItemOptions,
  } = useTimeTracker();
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    if (!activeSession?.started_at || !isDialogOpen) {
      return undefined;
    }

    setNow(Date.now());
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeSession?.started_at, isDialogOpen]);

  const selectedOption = React.useMemo(() => {
    const selectedId = activeSession?.memory_item_id ?? draft.memoryItemId;
    if (!selectedId) {
      return null;
    }

    return (
      memoryItemOptions.find((option) => Number(option.id) === Number(selectedId)) ?? {
        id: Number(selectedId),
        name: activeSession?.memory_item_name ?? draft.memoryItemName ?? `Memory item ${selectedId}`,
      }
    );
  }, [activeSession, draft.memoryItemId, draft.memoryItemName, memoryItemOptions]);

  const duration = activeSession
    ? Math.max(0, Math.round((now - new Date(activeSession.started_at).getTime()) / 1000))
    : 0;

  return (
    <Dialog open={isDialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
      <DialogTitle>Time Tracker</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <Autocomplete
            options={memoryItemOptions}
            value={selectedOption}
            loading={memoryItemOptionsLoading}
            onOpen={() => loadMemoryItemOptions()}
            onInputChange={(_event, value, reason) => {
              if (reason === 'input') {
                loadMemoryItemOptions(value);
              }
            }}
            onChange={(_event, option) => {
              setDraftValue('memoryItemId', option?.id ?? null);
              setDraftValue('memoryItemName', option?.name ?? '');
            }}
            getOptionLabel={(option) => option?.name || `Memory item ${option?.id ?? ''}`}
            isOptionEqualToValue={(option, value) => Number(option.id) === Number(value.id)}
            renderOption={(props, option) => {
              const { key, ...optionProps } = props;
              return (
                <li {...optionProps} key={option.id}>
                  {option?.name || `Memory item ${option?.id ?? ''}`}
                </li>
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Linked memory item"
                placeholder="Search memory items"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {memoryItemOptionsLoading ? <CircularProgress color="inherit" size={18} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />

          <TextField
            label="Title"
            value={draft.title}
            onChange={(event) => setDraftValue('title', event.target.value)}
            fullWidth
          />

          <TextField
            label="Notes"
            value={draft.notes}
            onChange={(event) => setDraftValue('notes', event.target.value)}
            minRows={4}
            multiline
            fullWidth
          />

          <Box
            sx={{
              p: 3,
              borderRadius: 3,
              bgcolor: 'action.hover',
              textAlign: 'center',
            }}
          >
            <Typography variant="overline" color="text.secondary">
              Elapsed time
            </Typography>
            <Typography variant="h2" sx={{ lineHeight: 1, mt: 1 }}>
              {formatDuration(duration)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {activeSession ? 'Calculated from timestamps in real time.' : 'Start a session to begin tracking.'}
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Button onClick={minimizeDialog} startIcon={<MinimizeIcon />}>
          Minimize
        </Button>

        <Stack direction="row" spacing={1}>
          <Button onClick={closeDialog}>Close</Button>
          {activeSession ? (
            <Button
              variant="contained"
              color="error"
              startIcon={<StopIcon />}
              onClick={() => stopSession('manual')}
              disabled={isSaving}
            >
              Stop
            </Button>
          ) : (
            <Button
              variant="contained"
              startIcon={<PlayArrowIcon />}
              onClick={startSession}
              disabled={isSaving}
            >
              Start
            </Button>
          )}
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

