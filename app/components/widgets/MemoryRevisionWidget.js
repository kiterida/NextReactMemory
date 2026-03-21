'use client';

import * as React from 'react';
import Link from 'next/link';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import MuiLink from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { fetchMemoryItemById } from './widgetQueries';

export default function MemoryRevisionWidget({ widget }) {
  const memoryItemId = widget?.config?.memoryItemId;
  const [memoryItem, setMemoryItem] = React.useState(null);
  const [loading, setLoading] = React.useState(Boolean(memoryItemId));
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let ignore = false;

    async function loadMemoryItem() {
      if (!memoryItemId) {
        setMemoryItem(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const data = await fetchMemoryItemById(memoryItemId);
        if (!ignore) {
          setMemoryItem(data);
        }
      } catch (fetchError) {
        if (!ignore) {
          setError(fetchError.message || 'Unable to load revision memory item.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadMemoryItem();

    return () => {
      ignore = true;
    };
  }, [memoryItemId]);

  return (
    <Stack spacing={1.5}>
      {loading ? <CircularProgress size={24} /> : null}

      {!loading && error ? <Alert severity="error">{error}</Alert> : null}

      {!loading && !error && !memoryItem ? (
        <Alert severity="info">Choose a memory item in this widget&apos;s configuration.</Alert>
      ) : null}

      {!loading && !error && memoryItem ? (
        <Stack spacing={1.5}>
          <MuiLink
            component={Link}
            href={`/singleListView?listId=${memoryItem.id}`}
            underline="hover"
            sx={{ width: 'fit-content', fontWeight: 600, fontSize: '1.05rem' }}
          >
            {memoryItem.name || 'Untitled memory item'}
          </MuiLink>

          <Typography variant="body2" color="text.secondary">
            Linked memory item ID: {memoryItem.id}
          </Typography>

          {memoryItem.header_image ? (
            <Box
              component="img"
              src={memoryItem.header_image}
              alt={memoryItem.name || 'Header image'}
              sx={{
                width: '100%',
                maxHeight: 240,
                objectFit: 'cover',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'grey.100',
              }}
            />
          ) : (
            <Alert severity="info">This memory item does not have a header image yet.</Alert>
          )}
        </Stack>
      ) : null}
    </Stack>
  );
}
