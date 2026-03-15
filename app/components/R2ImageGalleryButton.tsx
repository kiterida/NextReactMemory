'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import ImageList from '@mui/material/ImageList';
import ImageListItem from '@mui/material/ImageListItem';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ImageIcon from '@mui/icons-material/Image';

type GalleryImage = {
  key: string;
  url: string;
  size: number;
  lastModified: string | null;
};

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

type R2ImageGalleryButtonProps = {
  iconOnly?: boolean;
};

export default function R2ImageGalleryButton({ iconOnly = false }: R2ImageGalleryButtonProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {iconOnly ? (
        <Tooltip title="View stored images">
          <IconButton onClick={() => setOpen(true)} aria-label="View stored images">
            <ImageIcon />
          </IconButton>
        </Tooltip>
      ) : (
        <Button variant="contained" onClick={() => setOpen(true)}>
          View Stored Images
        </Button>
      )}
      <R2ImageGalleryDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

type R2ImageGalleryDialogProps = {
  open: boolean;
  onClose: () => void;
  onSelectImage?: (url: string) => void;
};

export function R2ImageGalleryDialog({ open, onClose, onSelectImage }: R2ImageGalleryDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [images, setImages] = React.useState<GalleryImage[]>([]);

  const loadImages = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/r2-images', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to load images');
      }

      setImages(Array.isArray(payload.images) ? payload.images : []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load images');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      void loadImages();
    }
  }, [loadImages, open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Memory Images</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Stack direction="row" spacing={2} alignItems="center" sx={{ py: 3 }}>
            <CircularProgress size={24} />
            <Typography>Loading images from R2...</Typography>
          </Stack>
        ) : null}

        {!loading && error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}

        {!loading && !error && images.length === 0 ? (
          <Typography>No images were found in `memory-images/`.</Typography>
        ) : null}

        {!loading && !error && images.length > 0 ? (
          <ImageList variant="masonry" cols={3} gap={16}>
            {images.map((image) => (
              <ImageListItem key={image.key}>
                <Card variant="outlined">
                  <Box
                    component="img"
                    src={image.url}
                    alt={image.key}
                    loading="lazy"
                    sx={{
                      display: 'block',
                      width: '100%',
                      borderRadius: 1,
                      backgroundColor: 'grey.100',
                    }}
                  />
                  <CardContent>
                    <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                      {image.key}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {formatBytes(image.size)}
                    </Typography>
                    {image.lastModified ? (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {new Date(image.lastModified).toLocaleString()}
                      </Typography>
                    ) : null}
                    <Link href={image.url} target="_blank" rel="noreferrer">
                      Open image
                    </Link>
                  </CardContent>
                  {onSelectImage ? (
                    <CardActions>
                      <Button
                        size="small"
                        onClick={() => {
                          onSelectImage(image.url);
                          onClose();
                        }}
                      >
                        Insert image
                      </Button>
                    </CardActions>
                  ) : null}
                </Card>
              </ImageListItem>
            ))}
          </ImageList>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => void loadImages()}>Refresh</Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
