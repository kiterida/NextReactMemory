'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { TODO_PRIORITY_OPTIONS } from './todoListUtils';

function buildFormState(initialValues) {
  return {
    name: initialValues?.name || '',
    dueDate: initialValues?.due_date || '',
    priority: initialValues?.priority || 'Normal',
  };
}

export default function TodoItemDialog({
  open,
  mode = 'create',
  initialValues = null,
  saving = false,
  onClose,
  onSave,
}) {
  const [formState, setFormState] = React.useState(() => buildFormState(initialValues));
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setFormState(buildFormState(initialValues));
    setError('');
  }, [initialValues, open]);

  const handleChange = (field, value) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    const trimmedName = formState.name.trim();

    if (!trimmedName) {
      setError('Please enter a name.');
      return;
    }

    setError('');

    try {
      await onSave({
        name: trimmedName,
        dueDate: formState.dueDate || null,
        priority: formState.priority,
      });
    } catch (saveError) {
      setError(saveError.message || 'Unable to save todo item.');
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{mode === 'edit' ? 'Edit To Do Item' : 'Add To Do Item'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <TextField
            label="Name"
            value={formState.name}
            onChange={(event) => handleChange('name', event.target.value)}
            fullWidth
            autoFocus
          />

          <TextField
            label="Due Date"
            type="date"
            value={formState.dueDate}
            onChange={(event) => handleChange('dueDate', event.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />

          <TextField
            select
            label="Priority"
            value={formState.priority}
            onChange={(event) => handleChange('priority', event.target.value)}
            fullWidth
          >
            {TODO_PRIORITY_OPTIONS.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {mode === 'edit' ? 'Save Changes' : 'Add Item'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
