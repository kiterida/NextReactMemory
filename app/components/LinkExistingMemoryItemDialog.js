'use client';

import React from 'react';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { insertMemoryItemLink, searchLinkableMemoryItems } from './memoryLinkData';

const formatOptionLabel = (option) => {
  if (!option) {
    return '';
  }

  const name = option.name?.trim() || `Item ${option.id}`;
  const memoryKey = option.memory_key === null || option.memory_key === undefined
    ? 'no key'
    : `key ${option.memory_key}`;
  return `${name} (${memoryKey})`;
};

const LinkExistingMemoryItemDialog = ({
  open,
  destinationItem,
  defaultMemoryKey,
  onClose,
  onLinked,
}) => {
  const [options, setOptions] = React.useState([]);
  const [searchText, setSearchText] = React.useState('');
  const [selectedOption, setSelectedOption] = React.useState(null);
  const [memoryKey, setMemoryKey] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState('');
  const [isSearching, setIsSearching] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setOptions([]);
      setSearchText('');
      setSelectedOption(null);
      setMemoryKey('');
      setErrorMessage('');
      setIsSearching(false);
      setIsSaving(false);
      return;
    }

    setMemoryKey(defaultMemoryKey === null || defaultMemoryKey === undefined ? '' : String(defaultMemoryKey));
  }, [defaultMemoryKey, open]);

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }

    let cancelled = false;
    const runSearch = async () => {
      setIsSearching(true);
      try {
        const rows = await searchLinkableMemoryItems(searchText);
        if (!cancelled) {
          setOptions(rows);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Failed to search items.';
          setErrorMessage(message);
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    };

    const timeoutId = window.setTimeout(() => {
      void runSearch();
    }, searchText.trim().length >= 2 ? 250 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [open, searchText]);

  const handleSave = async () => {
    if (!destinationItem?.source_item_id) {
      setErrorMessage('Destination parent is not available.');
      return;
    }

    if (!selectedOption?.id) {
      setErrorMessage('Select an existing memory item to link.');
      return;
    }

    const parsedMemoryKey = Number(memoryKey);
    if (!Number.isInteger(parsedMemoryKey)) {
      setErrorMessage('Memory key must be a whole number.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      const linkedItem = await insertMemoryItemLink(
        destinationItem.source_item_id,
        selectedOption.id,
        parsedMemoryKey
      );

      onLinked?.(linkedItem);
      onClose?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create link.';
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={isSaving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Link Existing Item Here</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            The linked row keeps the source item content, but uses its own memory_key in this destination list.
          </Typography>

          {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

          <Autocomplete
            options={options}
            value={selectedOption}
            onChange={(_event, value) => setSelectedOption(value)}
            inputValue={searchText}
            onInputChange={(_event, value) => setSearchText(value)}
            getOptionLabel={formatOptionLabel}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            loading={isSearching}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search existing items"
                placeholder="Type at least 2 characters"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {isSearching ? <CircularProgress color="inherit" size={18} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Stack spacing={0.25} sx={{ py: 0.5 }}>
                  <Typography variant="body2">{option.name || `Item ${option.id}`}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    id {option.id} | key {option.memory_key ?? 'n/a'}
                  </Typography>
                </Stack>
              </li>
            )}
          />

          <TextField
            label="Destination memory key"
            value={memoryKey}
            onChange={(event) => setMemoryKey(event.target.value)}
            inputProps={{ inputMode: 'numeric' }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={isSaving}>
          Create Link
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LinkExistingMemoryItemDialog;
