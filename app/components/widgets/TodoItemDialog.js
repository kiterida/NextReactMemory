'use client';

import * as React from 'react';
import AddIcon from '@mui/icons-material/Add';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import TodoTagDialog from './TodoTagDialog';
import { getTodoTagChipSx, sortTodoTags, TODO_PRIORITY_OPTIONS } from './todoListUtils';

function buildFormState(initialValues) {
  return {
    name: initialValues?.name || '',
    dueDate: initialValues?.due_date || '',
    priority: initialValues?.priority || 'Normal',
    tags: sortTodoTags(initialValues?.tags ?? []),
  };
}

export default function TodoItemDialog({
  open,
  mode = 'create',
  initialValues = null,
  todoTags = [],
  saving = false,
  onClose,
  onSave,
  onCreateTag,
}) {
  const [formState, setFormState] = React.useState(() => buildFormState(initialValues));
  const [error, setError] = React.useState('');
  const [tagDialogOpen, setTagDialogOpen] = React.useState(false);
  const [tagSaving, setTagSaving] = React.useState(false);

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
        tagIds: formState.tags.map((tag) => tag.id),
      });
    } catch (saveError) {
      setError(saveError.message || 'Unable to save todo item.');
    }
  };

  const handleCreateTag = async (tagValues) => {
    if (!onCreateTag) {
      return;
    }

    setTagSaving(true);

    try {
      const createdTag = await onCreateTag(tagValues);
      setFormState((prev) => ({
        ...prev,
        tags: sortTodoTags([
          ...prev.tags.filter((tag) => tag.id !== createdTag.id),
          createdTag,
        ]),
      }));
      setTagDialogOpen(false);
    } finally {
      setTagSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
        <DialogTitle>{mode === 'edit' ? 'Edit To Do Item' : 'Add To Do Item'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error ? <Alert severity="error">{error}</Alert> : null}

            <TextField
              label="Name"
              value={formState.name}
              onChange={(event) => handleChange('name', event.target.value)}
              multiline
              minRows={4}
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

            <Stack spacing={1}>
              <Autocomplete
                multiple
                options={todoTags}
                value={formState.tags}
                onChange={(_event, nextValue) => handleChange('tags', sortTodoTags(nextValue))}
                getOptionLabel={(option) => option.name || `Tag ${option.id}`}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      key={option.id}
                      label={option.name}
                      size="small"
                      sx={getTodoTagChipSx(option.color)}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Tags"
                    placeholder={todoTags.length ? 'Select one or more tags' : 'Create a tag to get started'}
                  />
                )}
              />

              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Alert severity="info" sx={{ py: 0, flex: 1 }}>
                  Tags are specific to this to do list and can be used for filtering inside the widget.
                </Alert>
                {onCreateTag ? (
                  <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => setTagDialogOpen(true)}>
                    New Tag
                  </Button>
                ) : null}
              </Stack>
            </Stack>
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

      <TodoTagDialog
        open={tagDialogOpen}
        saving={tagSaving}
        onClose={() => {
          if (tagSaving) {
            return;
          }

          setTagDialogOpen(false);
        }}
        onSave={handleCreateTag}
      />
    </>
  );
}
