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
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import FormControlLabel from '@mui/material/FormControlLabel';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import MinimizeIcon from '@mui/icons-material/Minimize';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useTimeTracker } from './TimeTrackerContext';
import {
  DEFAULT_TIME_TRACKING_ALERT_THRESHOLD_MINUTES,
  formatDuration,
  formatThresholdMinutes,
  getAlertThresholdSeconds,
} from '@/app/lib/timeTracker';

const PRESET_ALERT_MINUTES = [25, 45, 60];

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
  const thresholdSeconds = getAlertThresholdSeconds(activeSession);
  const isOverdue = thresholdSeconds !== null && duration >= thresholdSeconds;

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

          {!activeSession ? (
            <Stack spacing={1.5} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={draft.alertEnabled}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setDraftValue('alertEnabled', checked);
                      if (checked && !draft.alertThresholdMinutes) {
                        setDraftValue('alertThresholdMinutes', DEFAULT_TIME_TRACKING_ALERT_THRESHOLD_MINUTES);
                      }
                    }}
                  />
                }
                label="Enable duration alert"
              />

              {draft.alertEnabled ? (
                <>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {PRESET_ALERT_MINUTES.map((minutes) => (
                      <Button
                        key={minutes}
                        size="small"
                        variant={Number(draft.alertThresholdMinutes) === minutes ? 'contained' : 'outlined'}
                        onClick={() => setDraftValue('alertThresholdMinutes', minutes)}
                      >
                        {minutes} min
                      </Button>
                    ))}
                  </Stack>

                  <TextField
                    label="Alert after"
                    type="number"
                    value={draft.alertThresholdMinutes}
                    onChange={(event) => setDraftValue('alertThresholdMinutes', event.target.value)}
                    inputProps={{ min: 1 }}
                    helperText="Minutes elapsed before the alert triggers once."
                    fullWidth
                  />
                </>
              ) : null}
            </Stack>
          ) : null}

          <Box
            sx={{
              p: 3,
              borderRadius: 3,
              bgcolor: isOverdue ? 'warning.light' : 'action.hover',
              color: isOverdue ? 'warning.contrastText' : 'text.primary',
              textAlign: 'center',
            }}
          >
            <Typography variant="overline" color={isOverdue ? 'inherit' : 'text.secondary'}>
              Elapsed time
            </Typography>
            <Typography variant="h2" sx={{ lineHeight: 1, mt: 1 }}>
              {formatDuration(duration)}
            </Typography>
            {activeSession?.alert_threshold_minutes ? (
              <Typography variant="body2" sx={{ mt: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
                {isOverdue ? <WarningAmberIcon fontSize="small" /> : null}
                Alert target: {formatThresholdMinutes(activeSession.alert_threshold_minutes)}
              </Typography>
            ) : null}
            <Typography variant="body2" color={isOverdue ? 'inherit' : 'text.secondary'} sx={{ mt: 1 }}>
              {activeSession
                ? isOverdue
                  ? 'This session is over the configured target time.'
                  : 'Calculated from timestamps in real time.'
                : 'Start a session to begin tracking.'}
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
              disabled={isSaving || (draft.alertEnabled && Number(draft.alertThresholdMinutes) <= 0)}
            >
              Start
            </Button>
          )}
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
