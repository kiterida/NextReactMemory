import * as React from 'react';
import PropTypes from 'prop-types';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MemoryItemWebLinkForm from './MemoryItemWebLinkForm';
import { R2ImageGalleryDialog } from './R2ImageGalleryButton';

const MemoryItemWebLinkEditDialog = ({
  open,
  title,
  values,
  errors,
  submitting = false,
  submitLabel,
  onChange,
  onClose,
  onSelectImageFromR2,
  onSubmit,
}) => {
  const [isGalleryOpen, setIsGalleryOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setIsGalleryOpen(false);
    }
  }, [open]);

  return (
    <>
      <Dialog open={open} onClose={submitting ? undefined : onClose} fullWidth maxWidth="sm">
        <DialogTitle>{title}</DialogTitle>
        <DialogContent dividers>
          <MemoryItemWebLinkForm
            title=""
            values={values}
            errors={errors}
            submitting={submitting}
            submitLabel={submitLabel}
            cancelLabel="Cancel"
            onChange={onChange}
            onChooseImageFromR2={() => setIsGalleryOpen(true)}
            onSubmit={onSubmit}
            onCancel={onClose}
          />
        </DialogContent>
      </Dialog>

      <R2ImageGalleryDialog
        open={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        onSelectImage={(imageUrl) => {
          onSelectImageFromR2?.(imageUrl);
          setIsGalleryOpen(false);
        }}
      />
    </>
  );
};

MemoryItemWebLinkEditDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.string,
  values: PropTypes.shape({
    link_heading: PropTypes.string.isRequired,
    url: PropTypes.string.isRequired,
    row_order: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    description: PropTypes.string.isRequired,
    image_url: PropTypes.string.isRequired,
  }).isRequired,
  errors: PropTypes.object,
  submitting: PropTypes.bool,
  submitLabel: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onSelectImageFromR2: PropTypes.func,
  onSubmit: PropTypes.func.isRequired,
};

MemoryItemWebLinkEditDialog.defaultProps = {
  title: 'Edit Link',
  errors: {},
  submitting: false,
  submitLabel: 'Save Changes',
  onSelectImageFromR2: undefined,
};

export default MemoryItemWebLinkEditDialog;

