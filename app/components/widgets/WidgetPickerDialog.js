'use client';

import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
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
            <ListItemButton
              key={option.widgetType}
              onClick={() => onSelect(option.widgetType)}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
                mb: 1.5,
                '&:last-of-type': {
                  mb: 0,
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                {option.icon ? <option.icon color="action" /> : null}
              </ListItemIcon>
              <ListItemText primary={option.label} secondary={option.description} />
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
