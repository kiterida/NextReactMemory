'use client';

import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import { getWidgetTypeOptions } from './widgetRegistry';

export default function WidgetPickerDialog({ open, onClose, onSelect }) {
  const widgetOptions = React.useMemo(() => getWidgetTypeOptions(), []);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add Widget</DialogTitle>
      <DialogContent dividers>
        <List disablePadding>
          {widgetOptions.map((option) => (
            <ListItemButton key={option.widgetType} onClick={() => onSelect(option.widgetType)}>
              <ListItemText primary={option.label} secondary={option.widgetType} />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
