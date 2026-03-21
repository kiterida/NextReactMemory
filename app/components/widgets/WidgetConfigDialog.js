'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import TodoListConfigDialog from './TodoListConfigDialog';
import { fetchMemoryItemById, fetchMemoryItemOptions } from './widgetQueries';
import { getWidgetDefinition } from './widgetRegistry';

const SIZE_OPTIONS = [4, 6, 8, 12];

function buildInitialFormState(widgetType) {
  const definition = getWidgetDefinition(widgetType);

  return {
    title: definition?.defaultTitle || '',
    width: definition?.defaultSize?.width ?? 6,
    height: definition?.defaultSize?.height ?? 1,
    config: { ...(definition?.defaultConfig || {}) },
  };
}

function buildEditFormState(widgetType, initialValues) {
  const baseState = buildInitialFormState(widgetType);

  if (!initialValues) {
    return baseState;
  }

  return {
    title: initialValues.title ?? baseState.title,
    width: initialValues.width ?? baseState.width,
    height: initialValues.height ?? baseState.height,
    config: {
      ...baseState.config,
      ...(initialValues.config || {}),
    },
  };
}

export default function WidgetConfigDialog({ open, widgetType, initialValues = null, onClose, onSave }) {
  const definition = getWidgetDefinition(widgetType);
  const [formState, setFormState] = React.useState(() => buildEditFormState(widgetType, initialValues));
  const [memoryItemOptions, setMemoryItemOptions] = React.useState([]);
  const [memoryItemLoading, setMemoryItemLoading] = React.useState(false);
  const [memoryItemSearch, setMemoryItemSearch] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setFormState(buildEditFormState(widgetType, initialValues));
    setMemoryItemOptions([]);
    setMemoryItemSearch('');
    setError('');
  }, [initialValues, widgetType, open]);

  React.useEffect(() => {
    let ignore = false;
    let timeoutId;

    async function loadMemoryItems() {
      if (!['current_courses', 'memory_revision'].includes(widgetType) || !open) {
        return;
      }

      setMemoryItemLoading(true);

      try {
        const data = await fetchMemoryItemOptions(memoryItemSearch);
        if (!ignore) {
          setMemoryItemOptions(data);
        }
      } catch (fetchError) {
        if (!ignore) {
          setError(fetchError.message || 'Unable to load memory items.');
        }
      } finally {
        if (!ignore) {
          setMemoryItemLoading(false);
        }
      }
    }

    timeoutId = setTimeout(loadMemoryItems, 250);

    return () => {
      ignore = true;
      clearTimeout(timeoutId);
    };
  }, [memoryItemSearch, open, widgetType]);

  React.useEffect(() => {
    let ignore = false;

    async function ensureSelectedMemoryItem() {
      if (!open || !['current_courses', 'memory_revision'].includes(widgetType)) {
        return;
      }

      const selectedId = formState.config.memoryItemId;
      if (!selectedId) {
        return;
      }

      const alreadyLoaded = memoryItemOptions.some((item) => String(item.id) === String(selectedId));
      if (alreadyLoaded) {
        return;
      }

      try {
        const memoryItem = await fetchMemoryItemById(selectedId);
        if (!ignore && memoryItem) {
          setMemoryItemOptions((prev) => [memoryItem, ...prev]);
        }
      } catch (fetchError) {
        if (!ignore) {
          setError(fetchError.message || 'Unable to load the selected memory item.');
        }
      }
    }

    ensureSelectedMemoryItem();

    return () => {
      ignore = true;
    };
  }, [formState.config.memoryItemId, memoryItemOptions, open, widgetType]);

  if (!definition) {
    return null;
  }

  if (widgetType === 'todo_list') {
    return (
      <TodoListConfigDialog
        open={open}
        initialValues={initialValues}
        onClose={onClose}
        onSave={onSave}
      />
    );
  }

  const handleConfigChange = (field, value) => {
    setFormState((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      if (['current_courses', 'memory_revision'].includes(widgetType) && !formState.config.memoryItemId) {
        throw new Error('Please select a memory item.');
      }

      if (widgetType === 'history' && Number(formState.config.maxItems) < 1) {
        throw new Error('Max items must be at least 1.');
      }

      await onSave({
        title: formState.title || definition.defaultTitle,
        width: Number(formState.width),
        height: Number(formState.height),
        config: formState.config,
      });
    } catch (saveError) {
      setError(saveError.message || 'Unable to save widget.');
    } finally {
      setSaving(false);
    }
  };

  const selectedMemoryItem =
    memoryItemOptions.find((option) => String(option.id) === String(formState.config.memoryItemId || '')) || null;

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{initialValues ? 'Edit' : 'Configure'} {definition.label}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <TextField
            label="Widget Title"
            value={formState.title}
            onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
            fullWidth
          />

          <TextField
            select
            label="Width"
            value={formState.width}
            onChange={(event) => setFormState((prev) => ({ ...prev, width: event.target.value }))}
          >
            {SIZE_OPTIONS.map((option) => (
              <MenuItem key={option} value={option}>
                {option} columns
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Height"
            type="number"
            value={formState.height}
            onChange={(event) => setFormState((prev) => ({ ...prev, height: event.target.value }))}
            inputProps={{ min: 1 }}
          />

          {['current_courses', 'memory_revision'].includes(widgetType) ? (
            <Autocomplete
              options={memoryItemOptions}
              loading={memoryItemLoading}
              value={selectedMemoryItem}
              inputValue={memoryItemSearch}
              filterOptions={(options) => options}
              getOptionLabel={(option) => option.name || option.memory_key || `Memory Item ${option.id}`}
              isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
              onInputChange={(_event, value, reason) => {
                if (reason === 'input' || reason === 'clear') {
                  setMemoryItemSearch(value);
                }
              }}
              onChange={(_event, value) => handleConfigChange('memoryItemId', value?.id || '')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Memory Item"
                  helperText="Search by memory item name"
                />
              )}
            />
          ) : null}

          {widgetType === 'history' ? (
            <TextField
              label="Max Items"
              type="number"
              value={formState.config.maxItems}
              onChange={(event) => handleConfigChange('maxItems', Number(event.target.value))}
              inputProps={{ min: 1, max: 50 }}
            />
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {initialValues ? 'Save Changes' : 'Save Widget'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
