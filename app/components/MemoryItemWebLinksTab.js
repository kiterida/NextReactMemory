import * as React from 'react';
import PropTypes from 'prop-types';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import {
  deleteMemoryItemWebLink,
  getMemoryItemWebLinks,
  insertMemoryItemWebLink,
  updateMemoryItemWebLink,
} from './memoryData';
import MemoryItemWebLinkEditDialog from './MemoryItemWebLinkEditDialog';
import MemoryItemWebLinksList from './MemoryItemWebLinksList';
import {
  EMPTY_MEMORY_ITEM_WEB_LINK_FORM,
  getNextMemoryItemWebLinkKey,
  normalizeMemoryItemWebLinkInput,
  validateMemoryItemWebLinkForm,
} from './MemoryItemWebLinkUtils';

const toFormValues = (link) => ({
  link_heading: link?.link_heading ?? '',
  url: link?.url ?? '',
  row_order: link?.row_order ?? '',
  description: link?.description ?? '',
  image_url: link?.image_url ?? '',
});

const MemoryItemWebLinksTab = ({ selectedItem, onShowMessage }) => {
  const memoryItemId = React.useMemo(() => {
    if (!selectedItem) {
      return null;
    }

    return selectedItem.source_item_id ?? selectedItem.id ?? null;
  }, [selectedItem]);

  const [links, setLinks] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [editingLink, setEditingLink] = React.useState(null);
  const [deletingLink, setDeletingLink] = React.useState(null);
  const [createValues, setCreateValues] = React.useState(EMPTY_MEMORY_ITEM_WEB_LINK_FORM);
  const [createErrors, setCreateErrors] = React.useState({});
  const [editValues, setEditValues] = React.useState(EMPTY_MEMORY_ITEM_WEB_LINK_FORM);
  const [editErrors, setEditErrors] = React.useState({});

  const applyLinks = React.useCallback((nextLinks) => {
    setLinks(nextLinks);
    setCreateValues((prev) => ({
      ...prev,
      row_order: prev.row_order === '' ? String(getNextMemoryItemWebLinkKey(nextLinks)) : prev.row_order,
    }));
  }, []);

  const loadLinks = React.useCallback(async () => {
    if (!memoryItemId) {
      setLinks([]);
      return;
    }

    setLoading(true);
    try {
      const nextLinks = await getMemoryItemWebLinks(memoryItemId);
      applyLinks(nextLinks);
    } catch (error) {
      console.error('Failed to load memory item web links:', error);
      onShowMessage?.(error instanceof Error ? error.message : 'Failed to load links.', 'error');
    } finally {
      setLoading(false);
    }
  }, [applyLinks, memoryItemId, onShowMessage]);

  React.useEffect(() => {
    setCreateErrors({});
    setEditErrors({});
    setEditingLink(null);
    setDeletingLink(null);
    setIsAddDialogOpen(false);

    if (!memoryItemId) {
      setLinks([]);
      setCreateValues(EMPTY_MEMORY_ITEM_WEB_LINK_FORM);
      return undefined;
    }

    let isActive = true;

    const run = async () => {
      setLoading(true);
      try {
        const nextLinks = await getMemoryItemWebLinks(memoryItemId);
        if (!isActive) {
          return;
        }

        setLinks(nextLinks);
        setCreateValues({
          ...EMPTY_MEMORY_ITEM_WEB_LINK_FORM,
          row_order: String(getNextMemoryItemWebLinkKey(nextLinks)),
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        console.error('Failed to load memory item web links:', error);
        onShowMessage?.(error instanceof Error ? error.message : 'Failed to load links.', 'error');
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      isActive = false;
    };
  }, [memoryItemId, onShowMessage]);

  const handleCreateChange = React.useCallback((field, value) => {
    setCreateValues((prev) => ({ ...prev, [field]: value }));
    setCreateErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  const handleEditChange = React.useCallback((field, value) => {
    setEditValues((prev) => ({ ...prev, [field]: value }));
    setEditErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  const handleOpenAdd = React.useCallback(() => {
    if (!memoryItemId) {
      onShowMessage?.('Select a memory item before adding links.', 'warning');
      return;
    }

    setCreateErrors({});
    setCreateValues((prev) => ({
      ...EMPTY_MEMORY_ITEM_WEB_LINK_FORM,
      row_order: prev.row_order || String(getNextMemoryItemWebLinkKey(links)),
    }));
    setIsAddDialogOpen(true);
  }, [links, memoryItemId, onShowMessage]);

  const handleCreateSubmit = async (event) => {
    event.preventDefault();

    if (!memoryItemId) {
      onShowMessage?.('Select a memory item before adding links.', 'warning');
      return;
    }

    const validationErrors = validateMemoryItemWebLinkForm(createValues);
    setCreateErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      await insertMemoryItemWebLink(normalizeMemoryItemWebLinkInput(createValues, memoryItemId));
      const nextLinks = await getMemoryItemWebLinks(memoryItemId);
      applyLinks(nextLinks);
      setCreateValues({
        ...EMPTY_MEMORY_ITEM_WEB_LINK_FORM,
        row_order: String(getNextMemoryItemWebLinkKey(nextLinks)),
      });
      setCreateErrors({});
      setIsAddDialogOpen(false);
      onShowMessage?.('Link added.', 'success');
    } catch (error) {
      console.error('Failed to create memory item web link:', error);
      onShowMessage?.(error instanceof Error ? error.message : 'Failed to add link.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = React.useCallback((link) => {
    setEditingLink(link);
    setEditValues(toFormValues(link));
    setEditErrors({});
  }, []);

  const handleEditSubmit = async (event) => {
    event.preventDefault();

    if (!editingLink) {
      return;
    }

    const validationErrors = validateMemoryItemWebLinkForm(editValues);
    setEditErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      await updateMemoryItemWebLink(editingLink.id, normalizeMemoryItemWebLinkInput(editValues, memoryItemId));
      const nextLinks = await getMemoryItemWebLinks(memoryItemId);
      applyLinks(nextLinks);
      setEditingLink(null);
      setEditValues(EMPTY_MEMORY_ITEM_WEB_LINK_FORM);
      setEditErrors({});
      onShowMessage?.('Link updated.', 'success');
    } catch (error) {
      console.error('Failed to update memory item web link:', error);
      onShowMessage?.(error instanceof Error ? error.message : 'Failed to update link.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingLink) {
      return;
    }

    setSubmitting(true);
    try {
      await deleteMemoryItemWebLink(deletingLink.id);
      const nextLinks = await getMemoryItemWebLinks(memoryItemId);
      applyLinks(nextLinks);
      setDeletingLink(null);
      onShowMessage?.('Link deleted.', 'info');
    } catch (error) {
      console.error('Failed to delete memory item web link:', error);
      onShowMessage?.(error instanceof Error ? error.message : 'Failed to delete link.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack spacing={3}>
      {!memoryItemId ? (
        <Alert severity="info">Select a memory item before managing structured links.</Alert>
      ) : null}

      {selectedItem?.is_linked ? (
        <Alert severity="info">These links belong to the underlying memory item for this linked appearance.</Alert>
      ) : null}

      <Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
          <Typography variant="h6">Attached Links</Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenAdd}
              disabled={!memoryItemId || submitting}
            >
              Add Link
            </Button>
            <Button variant="text" onClick={loadLinks} disabled={!memoryItemId || loading || submitting}>
              Refresh
            </Button>
          </Stack>
        </Stack>

        <MemoryItemWebLinksList
          links={links}
          loading={loading}
          onEdit={handleOpenEdit}
          onDelete={setDeletingLink}
        />
      </Box>

      <MemoryItemWebLinkEditDialog
        open={isAddDialogOpen}
        title="Add Link"
        values={createValues}
        errors={createErrors}
        submitting={submitting}
        submitLabel="Add Link"
        onChange={handleCreateChange}
        onSelectImageFromR2={(imageUrl) => handleCreateChange('image_url', imageUrl)}
        onClose={() => {
          if (!submitting) {
            setIsAddDialogOpen(false);
            setCreateErrors({});
          }
        }}
        onSubmit={handleCreateSubmit}
      />

      <MemoryItemWebLinkEditDialog
        open={Boolean(editingLink)}
        title="Edit Link"
        values={editValues}
        errors={editErrors}
        submitting={submitting}
        submitLabel="Save Changes"
        onChange={handleEditChange}
        onSelectImageFromR2={(imageUrl) => handleEditChange('image_url', imageUrl)}
        onClose={() => {
          if (!submitting) {
            setEditingLink(null);
            setEditErrors({});
          }
        }}
        onSubmit={handleEditSubmit}
      />

      <Dialog open={Boolean(deletingLink)} onClose={submitting ? undefined : () => setDeletingLink(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Link?</DialogTitle>
        <DialogContent dividers>
          <DialogContentText>
            {deletingLink
              ? `This will remove "${deletingLink.link_heading}" from this memory item.`
              : 'This link will be removed.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletingLink(null)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained" disabled={submitting}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

MemoryItemWebLinksTab.propTypes = {
  selectedItem: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    source_item_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    is_linked: PropTypes.bool,
  }),
  onShowMessage: PropTypes.func,
};

MemoryItemWebLinksTab.defaultProps = {
  selectedItem: null,
  onShowMessage: undefined,
};

export default MemoryItemWebLinksTab;

