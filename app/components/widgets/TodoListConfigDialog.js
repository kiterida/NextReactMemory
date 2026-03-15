'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { fetchMemoryItemById, fetchMemoryItemOptions } from './widgetQueries';
import { createTodoList, getTodoListWithItems, updateTodoList } from './todoListQueries';

const SIZE_OPTIONS = [4, 6, 8, 12];

function buildBaseState(initialValues) {
  return {
    title: initialValues?.title || 'To Do List',
    width: initialValues?.width ?? 6,
    height: initialValues?.height ?? 2,
    config: {
      todo_list_id: initialValues?.config?.todo_list_id || '',
    },
    listName: '',
    memoryItemId: '',
  };
}

export default function TodoListConfigDialog({ open, initialValues = null, onClose, onSave }) {
  const [formState, setFormState] = React.useState(() => buildBaseState(initialValues));
  const [memoryItemOptions, setMemoryItemOptions] = React.useState([]);
  const [memoryItemSearch, setMemoryItemSearch] = React.useState('');
  const [memoryItemLoading, setMemoryItemLoading] = React.useState(false);
  const [loadingList, setLoadingList] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setFormState(buildBaseState(initialValues));
    setMemoryItemOptions([]);
    setMemoryItemSearch('');
    setError('');
  }, [initialValues, open]);

  React.useEffect(() => {
    let ignore = false;

    async function hydrateTodoList() {
      const todoListId = initialValues?.config?.todo_list_id;
      if (!open || !todoListId) {
        return;
      }

      setLoadingList(true);
      setError('');

      try {
        const todoList = await getTodoListWithItems(todoListId);
        if (!ignore && todoList) {
          setFormState((prev) => ({
            ...prev,
            listName: todoList.name || '',
            memoryItemId: todoList.memory_item_id || '',
            config: {
              ...prev.config,
              todo_list_id: todoList.id,
            },
            title: prev.title || todoList.name || 'To Do List',
          }));

          if (todoList.memory_item) {
            setMemoryItemOptions((prev) => {
              const alreadyLoaded = prev.some((item) => String(item.id) === String(todoList.memory_item.id));
              return alreadyLoaded ? prev : [todoList.memory_item, ...prev];
            });
          }
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError.message || 'Unable to load the linked todo list.');
        }
      } finally {
        if (!ignore) {
          setLoadingList(false);
        }
      }
    }

    hydrateTodoList();

    return () => {
      ignore = true;
    };
  }, [initialValues, open]);

  React.useEffect(() => {
    let ignore = false;
    const timeoutId = setTimeout(async () => {
      if (!open) {
        return;
      }

      setMemoryItemLoading(true);

      try {
        const options = await fetchMemoryItemOptions(memoryItemSearch);
        if (!ignore) {
          setMemoryItemOptions((prev) => {
            const merged = [...options];
            prev.forEach((item) => {
              if (!merged.some((option) => String(option.id) === String(item.id))) {
                merged.push(item);
              }
            });
            return merged;
          });
        }
      } catch (fetchError) {
        if (!ignore) {
          setError(fetchError.message || 'Unable to search memory items.');
        }
      } finally {
        if (!ignore) {
          setMemoryItemLoading(false);
        }
      }
    }, 250);

    return () => {
      ignore = true;
      clearTimeout(timeoutId);
    };
  }, [memoryItemSearch, open]);

  React.useEffect(() => {
    let ignore = false;

    async function ensureSelectedMemoryItem() {
      if (!open || !formState.memoryItemId) {
        return;
      }

      const alreadyLoaded = memoryItemOptions.some(
        (item) => String(item.id) === String(formState.memoryItemId)
      );

      if (alreadyLoaded) {
        return;
      }

      try {
        const memoryItem = await fetchMemoryItemById(formState.memoryItemId);
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
  }, [formState.memoryItemId, memoryItemOptions, open]);

  const selectedMemoryItem =
    memoryItemOptions.find((option) => String(option.id) === String(formState.memoryItemId || '')) || null;

  const handleSave = async () => {
    const listName = formState.listName.trim();
    if (!listName) {
      setError('Please enter a to do list name.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const todoListId = formState.config.todo_list_id;
      const todoListPayload = {
        name: listName,
        memoryItemId: formState.memoryItemId || null,
      };

      const todoList = todoListId
        ? await updateTodoList(todoListId, todoListPayload)
        : await createTodoList(todoListPayload);

      await onSave({
        title: formState.title.trim() || todoList.name || 'To Do List',
        width: Number(formState.width),
        height: Number(formState.height),
        config: {
          todo_list_id: todoList.id,
        },
      });
    } catch (saveError) {
      setError(saveError.message || 'Unable to save the to do widget.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{initialValues ? 'Edit To Do List Widget' : 'Create To Do List Widget'}</DialogTitle>
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
            label="To Do List Name"
            value={formState.listName}
            onChange={(event) => setFormState((prev) => ({ ...prev, listName: event.target.value }))}
            placeholder="Weekly priorities"
            fullWidth
            autoFocus={!initialValues}
            disabled={loadingList}
          />

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
            onChange={(_event, value) =>
              setFormState((prev) => ({ ...prev, memoryItemId: value?.id || '' }))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Linked Memory Item"
                helperText="Optional. Search and attach a memory item to this list."
              />
            )}
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
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || loadingList}>
          {initialValues ? 'Save Changes' : 'Create Widget'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
