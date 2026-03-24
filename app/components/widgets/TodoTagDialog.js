'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';

const DEFAULT_FORM_STATE = {
  name: '',
  color: '',
};
const DEFAULT_PICKER_COLOR = '#1976d2';

function isHexColor(value) {
  return /^#([0-9a-f]{6})$/i.test(String(value || '').trim());
}

function buildFormState(initialValues) {
  return {
    name: initialValues?.name || '',
    color: initialValues?.color || '',
  };
}

export default function TodoTagDialog({ open, mode = 'create', initialValues = null, saving = false, onClose, onSave }) {
  const [formState, setFormState] = React.useState(DEFAULT_FORM_STATE);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!open) {
      return;
    }

    setFormState(buildFormState(initialValues));
    setError('');
  }, [initialValues, open]);

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
      setError(saveError.message || `Unable to ${mode === 'edit' ? 'save' : 'create'} the tag.`);
    }
  };

  const pickerColor = isHexColor(formState.color) ? formState.color : DEFAULT_PICKER_COLOR;

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{mode === 'edit' ? 'Edit Tag' : 'Create Tag'}</DialogTitle>
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
            helperText="Pick a color or enter a hex value like #1976d2. Leave blank for the default tag style."
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <input
                    type="color"
                    aria-label="Tag color picker"
                    value={pickerColor}
                    onChange={(event) => setFormState((prev) => ({ ...prev, color: event.target.value }))}
                    style={{
                      width: 28,
                      height: 28,
                      border: 0,
                      padding: 0,
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                  />
                </InputAdornment>
              ),
            }}
            fullWidth
          />

          <Button variant="text" size="small" onClick={() => setFormState((prev) => ({ ...prev, color: '' }))} sx={{ alignSelf: 'flex-start' }}>
            Clear Custom Color
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Create Tag'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
