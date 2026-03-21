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
import { DASHBOARD_ICON_OPTIONS } from './dashboardIcons';

const DEFAULT_FORM_VALUES = {
  name: '',
  description: '',
  icon: 'dashboard',
  color: '#1976d2',
};

export default function DashboardDialog({
  open,
  mode = 'create',
  initialValues,
  onClose,
  onSave,
}) {
  const [formValues, setFormValues] = React.useState(DEFAULT_FORM_VALUES);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!open) {
      return;
    }

    setFormValues({
      name: initialValues?.name || '',
      description: initialValues?.description || '',
      icon: initialValues?.icon || DEFAULT_FORM_VALUES.icon,
      color: initialValues?.color || DEFAULT_FORM_VALUES.color,
    });
    setSaving(false);
    setError('');
  }, [initialValues, open]);

  const handleChange = (field) => (event) => {
    setFormValues((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleSubmit = async () => {
    if (!formValues.name.trim()) {
      setError('Dashboard name is required.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await onSave({
        name: formValues.name.trim(),
        description: formValues.description.trim(),
        icon: formValues.icon || null,
        color: formValues.color || null,
      });
    } catch (saveError) {
      setError(saveError.message || 'Unable to save dashboard.');
      setSaving(false);
    }
  };

  const title = mode === 'edit' ? 'Edit Dashboard' : 'Create Dashboard';

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <TextField
            label="Name"
            value={formValues.name}
            onChange={handleChange('name')}
            required
            autoFocus
          />

          <TextField
            label="Description"
            value={formValues.description}
            onChange={handleChange('description')}
            multiline
            minRows={3}
          />

          <TextField
            select
            label="Icon"
            value={formValues.icon}
            onChange={handleChange('icon')}
          >
            {DASHBOARD_ICON_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Color"
            value={formValues.color}
            onChange={handleChange('color')}
            placeholder="#1976d2"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={saving}>
          {saving ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Create Dashboard'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
