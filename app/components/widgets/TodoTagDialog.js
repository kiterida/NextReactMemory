'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';

const DEFAULT_FORM_STATE = {
  name: '',
  color: '',
};

export default function TodoTagDialog({ open, saving = false, onClose, onSave }) {
  const [formState, setFormState] = React.useState(DEFAULT_FORM_STATE);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!open) {
      return;
    }

    setFormState(DEFAULT_FORM_STATE);
    setError('');
  }, [open]);

  const handleSave = async () => {
    const trimmedName = formState.name.trim();

    if (!trimmedName) {
      setError('Please enter a tag name.');
      return;
    }

    setError('');

    try {
      await onSave({
        name: trimmedName,
        color: formState.color.trim() || null,
      });
    } catch (saveError) {
      setError(saveError.message || 'Unable to create the tag.');
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Create Tag</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <TextField
            label="Tag Name"
            value={formState.name}
            onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
            autoFocus
            fullWidth
          />

          <TextField
            label="Color"
            value={formState.color}
            onChange={(event) => setFormState((prev) => ({ ...prev, color: event.target.value }))}
            placeholder="#1976d2"
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Create Tag'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
