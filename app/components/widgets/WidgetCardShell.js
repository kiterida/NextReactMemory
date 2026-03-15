'use client';

import * as React from 'react';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

export default function WidgetCardShell({
  title,
  children,
  isCollapsed = false,
  isDragging = false,
  isDragOver = false,
  onEdit,
  onDelete,
  onToggleCollapse,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}) {
  return (
    <Box
      onDragOver={onDragOver}
      onDrop={onDrop}
      sx={{
        position: 'relative',
        opacity: isDragging ? 0.55 : 1,
        transition: 'opacity 160ms ease, transform 160ms ease',
        '&:hover .widget-toolbar, &:focus-within .widget-toolbar': {
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
          top: -14,
          right: 12,
          zIndex: 3,
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
        <Tooltip title="Drag to reorder">
          <IconButton
            size="small"
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            sx={{ cursor: 'grab' }}
          >
            <DragIndicatorIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={isCollapsed ? 'Expand widget' : 'Collapse widget'}>
          <IconButton size="small" onClick={onToggleCollapse}>
            {isCollapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
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

      <Paper
        variant="outlined"
        sx={{
          minHeight: isCollapsed ? 'auto' : '100%',
          borderRadius: 3,
          overflow: 'hidden',
          borderColor: isDragOver ? 'primary.main' : 'divider',
          boxShadow: isDragOver ? 4 : 1,
          transform: isDragOver ? 'translateY(-2px)' : 'none',
          transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
        }}
      >
        <Stack spacing={isCollapsed ? 0 : 1.5}>
          <Box
            onClick={isCollapsed ? onToggleCollapse : undefined}
            sx={{
              px: 2,
              py: 1.5,
              minHeight: 68,
              display: 'flex',
              alignItems: 'center',
              borderBottom: isCollapsed ? 'none' : '1px solid',
              borderColor: 'divider',
              cursor: isCollapsed ? 'pointer' : 'default',
            }}
          >
            <Typography variant="h6">{title}</Typography>
          </Box>

          {!isCollapsed ? <Box sx={{ px: 2, pb: 2 }}>{children}</Box> : null}
        </Stack>
      </Paper>
    </Box>
  );
}
