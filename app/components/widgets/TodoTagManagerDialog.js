'use client';

import * as React from 'react';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import AddIcon from '@mui/icons-material/Add';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TodoTagDialog from './TodoTagDialog';
import { getTodoTagChipSx } from './todoListUtils';

export default function TodoTagManagerDialog({
  open,
  tags = [],
  saving = false,
  onClose,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
}) {
  const [dialogMode, setDialogMode] = React.useState('create');
  const [editingTag, setEditingTag] = React.useState(null);
  const [tagDialogOpen, setTagDialogOpen] = React.useState(false);
  const [pendingDeleteTag, setPendingDeleteTag] = React.useState(null);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!open) {
      setDialogMode('create');
      setEditingTag(null);
      setTagDialogOpen(false);
      setPendingDeleteTag(null);
      setError('');
    }
  }, [open]);

  const handleOpenCreate = () => {
    setDialogMode('create');
    setEditingTag(null);
    setError('');
    setTagDialogOpen(true);
  };

  const handleOpenEdit = (tag) => {
    setDialogMode('edit');
    setEditingTag(tag);
    setError('');
    setTagDialogOpen(true);
  };

  const handleSaveTag = async (values) => {
    setError('');

    try {
      if (dialogMode === 'edit' && editingTag) {
        await onUpdateTag(editingTag, values);
      } else {
        await onCreateTag(values);
      }

      setTagDialogOpen(false);
      setEditingTag(null);
      setDialogMode('create');
    } catch (saveError) {
      setError(saveError.message || 'Unable to save the tag.');
      throw saveError;
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteTag) {
      return;
    }

    setError('');

    try {
      await onDeleteTag(pendingDeleteTag);
      setPendingDeleteTag(null);
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete the tag.');
    }
  };

  return (
    <>
      <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Manage Tags</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error ? <Alert severity="error">{error}</Alert> : null}

            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Edit tag names and colors, or remove tags you no longer need.
              </Typography>
              <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleOpenCreate} disabled={saving}>
                New Tag
              </Button>
            </Stack>

            {tags.length === 0 ? (
              <Alert severity="info">No tags exist for this to do list yet.</Alert>
            ) : (
              <Stack divider={<Divider flexItem />} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                {tags.map((tag) => (
                  <Stack
                    key={tag.id}
                    direction="row"
                    spacing={1.5}
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ px: 2, py: 1.5 }}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                      <Chip label={tag.name} size="small" sx={getTodoTagChipSx(tag.color)} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2">{tag.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {tag.color || 'No custom color'}
                        </Typography>
                      </Box>
                    </Stack>

                    <Stack direction="row" spacing={0.5}>
                      <IconButton aria-label={`Edit ${tag.name}`} onClick={() => handleOpenEdit(tag)} disabled={saving}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        aria-label={`Delete ${tag.name}`}
                        color="error"
                        onClick={() => setPendingDeleteTag(tag)}
                        disabled={saving}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <TodoTagDialog
        open={tagDialogOpen}
        mode={dialogMode}
        initialValues={editingTag}
        saving={saving}
        onClose={() => {
          if (saving) {
            return;
          }

          setTagDialogOpen(false);
          setEditingTag(null);
          setDialogMode('create');
        }}
        onSave={handleSaveTag}
      />

      <Dialog
        open={Boolean(pendingDeleteTag)}
        onClose={saving ? undefined : () => setPendingDeleteTag(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete Tag?</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary">
            {pendingDeleteTag
              ? `Delete "${pendingDeleteTag.name}" from this to do list? Any item links to this tag will be removed.`
              : 'Delete this tag from the to do list?'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDeleteTag(null)} disabled={saving}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={handleConfirmDelete} disabled={saving}>
            {saving ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
