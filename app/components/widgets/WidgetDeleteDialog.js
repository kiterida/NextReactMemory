'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';

export default function WidgetDeleteDialog({
  open,
  widget,
  loading = false,
  onClose,
  onConfirm,
}) {
  const isTodoListWidget = widget?.widget_type === 'todo_list';
  const title = isTodoListWidget ? 'Delete To Do List Widget?' : 'Delete Widget?';
  const body = isTodoListWidget
    ? 'This will permanently delete the widget, its linked to do list, and all list items from the database. This action cannot be undone.'
    : 'This will permanently remove the widget from the dashboard. This action cannot be undone.';

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary">
          {body}
        </Typography>

        {isTodoListWidget ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            This delete removes the widget, the linked to do list, and every item in that list.
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button color="error" variant="contained" onClick={onConfirm} disabled={loading}>
          {loading ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
