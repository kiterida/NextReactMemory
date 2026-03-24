import * as React from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

const MemoryItemWebLinkForm = ({
  title,
  values,
  errors,
  disabled = false,
  submitting = false,
  submitLabel,
  cancelLabel,
  onChange,
  onChooseImageFromR2,
  onSubmit,
  onCancel,
}) => (
  <Box component="form" onSubmit={onSubmit}>
    <Stack spacing={2}>
      {title ? <Typography variant="subtitle1">{title}</Typography> : null}

      <TextField
        label="Heading"
        value={values.link_heading}
        onChange={(event) => onChange('link_heading', event.target.value)}
        error={Boolean(errors.link_heading)}
        helperText={errors.link_heading || ' '}
        disabled={disabled || submitting}
        fullWidth
        required
      />

      <TextField
        label="URL"
        value={values.url}
        onChange={(event) => onChange('url', event.target.value)}
        error={Boolean(errors.url)}
        helperText={errors.url || ' '}
        disabled={disabled || submitting}
        fullWidth
        required
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Row Order"
          value={values.row_order}
          onChange={(event) => onChange('row_order', event.target.value)}
          error={Boolean(errors.row_order)}
          helperText={errors.row_order || ' '}
          disabled={disabled || submitting}
          fullWidth
        />
        <TextField
          label="Image URL"
          value={values.image_url}
          onChange={(event) => onChange('image_url', event.target.value)}
          error={Boolean(errors.image_url)}
          helperText={errors.image_url || 'Optional image preview URL'}
          disabled={disabled || submitting}
          fullWidth
        />
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
        <Button
          type="button"
          variant="outlined"
          onClick={onChooseImageFromR2}
          disabled={disabled || submitting}
        >
          Choose From R2
        </Button>
        {values.image_url ? (
          <Typography variant="body2" color="text.secondary">
            Selected image will be shown as the link thumbnail.
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Paste an image URL or pick one from R2.
          </Typography>
        )}
      </Stack>

      {values.image_url ? (
        <Card variant="outlined" sx={{ p: 1.5 }}>
          <Box
            component="img"
            src={values.image_url}
            alt={values.link_heading || 'Link preview image'}
            sx={{
              display: 'block',
              width: '100%',
              maxHeight: 180,
              objectFit: 'contain',
              borderRadius: 1,
              backgroundColor: 'grey.100',
            }}
          />
        </Card>
      ) : null}

      <TextField
        label="Description"
        value={values.description}
        onChange={(event) => onChange('description', event.target.value)}
        disabled={disabled || submitting}
        fullWidth
        multiline
        minRows={3}
        helperText="Optional"
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
        {onCancel ? (
          <Button onClick={onCancel} disabled={submitting} variant="outlined">
            {cancelLabel || 'Cancel'}
          </Button>
        ) : null}
        <Button type="submit" variant="contained" disabled={disabled || submitting}>
          {submitLabel}
        </Button>
      </Stack>
    </Stack>
  </Box>
);

MemoryItemWebLinkForm.propTypes = {
  title: PropTypes.string,
  values: PropTypes.shape({
    link_heading: PropTypes.string.isRequired,
    url: PropTypes.string.isRequired,
    row_order: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    description: PropTypes.string.isRequired,
    image_url: PropTypes.string.isRequired,
  }).isRequired,
  errors: PropTypes.object,
  disabled: PropTypes.bool,
  submitting: PropTypes.bool,
  submitLabel: PropTypes.string.isRequired,
  cancelLabel: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onChooseImageFromR2: PropTypes.func,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
};

MemoryItemWebLinkForm.defaultProps = {
  title: '',
  errors: {},
  disabled: false,
  submitting: false,
  cancelLabel: 'Cancel',
  onChooseImageFromR2: undefined,
  onCancel: undefined,
};

export default MemoryItemWebLinkForm;

