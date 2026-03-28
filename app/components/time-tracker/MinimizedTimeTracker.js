'use client';

import * as React from 'react';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useTimeTracker } from './TimeTrackerContext';
import { formatDuration, getOverdueSeconds } from '@/app/lib/timeTracker';

export default function MinimizedTimeTracker() {
  const { activeSession, minimized, openDialog, stopSession, isSaving } = useTimeTracker();
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    if (!activeSession?.started_at || !minimized) {
      return undefined;
    }

    setNow(Date.now());
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeSession?.started_at, minimized]);

  if (!activeSession || !minimized) {
    return null;
  }

  const duration = Math.max(0, Math.round((now - new Date(activeSession.started_at).getTime()) / 1000));
  const memoryItemLabel = activeSession.memory_item_name || activeSession.title || 'Unlinked session';
  const overdueSeconds = getOverdueSeconds(activeSession, duration);
  const isOverdue = overdueSeconds > 0;

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: (theme) => theme.zIndex.modal + 1,
        px: 2,
        py: 1,
        borderRadius: 999,
        minWidth: 320,
        maxWidth: 'calc(100vw - 32px)',
        border: isOverdue ? '1px solid' : 'none',
        borderColor: isOverdue ? 'warning.main' : 'transparent',
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="caption" color="text.secondary">
              Running now
            </Typography>
            {isOverdue ? (
              <Chip
                size="small"
                color="warning"
                icon={<WarningAmberIcon />}
                label={`Overdue by ${formatDuration(overdueSeconds)}`}
              />
            ) : null}
          </Stack>
          <Typography variant="h6" sx={{ lineHeight: 1.1 }}>
            {formatDuration(duration)}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {memoryItemLabel}
          </Typography>
        </Stack>

        <Tooltip title="Open tracker">
          <IconButton onClick={openDialog} aria-label="Open tracker">
            <OpenInFullIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title="Stop timer">
          <span>
            <IconButton
              color="error"
              onClick={() => stopSession('manual')}
              disabled={isSaving}
              aria-label="Stop timer"
            >
              <StopCircleIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Paper>
  );
}
