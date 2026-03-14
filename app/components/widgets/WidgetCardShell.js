'use client';

import * as React from 'react';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';

export default function WidgetCardShell({ children, onEdit, onDelete }) {
  return (
    <Box
      sx={{
        position: 'relative',
        '&:hover .widget-toolbar': {
          opacity: 1,
          transform: 'translateY(0)',
          pointerEvents: 'auto',
        },
      }}
    >
      <Paper
        className="widget-toolbar"
        elevation={3}
        sx={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 2,
          display: 'flex',
          gap: 0.5,
          p: 0.5,
          borderRadius: 999,
          opacity: 0,
          pointerEvents: 'none',
          transform: 'translateY(-6px)',
          transition: 'opacity 160ms ease, transform 160ms ease',
          bgcolor: 'background.paper',
        }}
      >
        <Tooltip title="Edit widget">
          <IconButton size="small" onClick={onEdit}>
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete widget">
          <IconButton size="small" color="error" onClick={onDelete}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Paper>

      {children}
    </Box>
  );
}
