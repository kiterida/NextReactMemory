'use client';

import * as React from 'react';
import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import Tooltip from '@mui/material/Tooltip';
import TimerIcon from '@mui/icons-material/Timer';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useTimeTracker } from './TimeTrackerContext';

export default function TimeTrackerHeaderButton() {
  const { openDialog, activeSession } = useTimeTracker();

  return (
    <Tooltip title={activeSession ? 'Open running time tracker' : 'Open time tracker'}>
      <IconButton color={activeSession ? 'primary' : 'default'} onClick={openDialog} aria-label="Open time tracker">
        <Badge color="success" variant="dot" overlap="circular" invisible={!activeSession}>
          {activeSession ? <TimerIcon /> : <AccessTimeIcon />}
        </Badge>
      </IconButton>
    </Tooltip>
  );
}
