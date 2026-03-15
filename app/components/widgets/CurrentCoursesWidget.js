'use client';

import * as React from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import MuiLink from '@mui/material/Link';
import { fetchMemoryItemById } from './widgetQueries';

export default function CurrentCoursesWidget({ widget }) {
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
          setError(fetchError.message || 'Unable to load course memory item.');
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
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: memoryItem.header_image ? '1fr 200px' : '1fr' },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <Stack spacing={1}>
            <MuiLink
              component={Link}
              href={`/singleListView?listId=${memoryItem.id}`}
              underline="hover"
              sx={{ width: 'fit-content', fontWeight: 500 }}
            >
              {memoryItem.name || 'Untitled memory item'}
            </MuiLink>

            <Typography variant="subtitle2" color="text.secondary">
              Description
            </Typography>
            <Typography color="text.secondary">
              {memoryItem.description || 'No description yet.'}
            </Typography>
          </Stack>

          {memoryItem.header_image ? (
            <Box
              component="img"
              src={memoryItem.header_image}
              alt={memoryItem.name || 'Header image'}
              sx={{
                width: '100%',
                maxWidth: 200,
                height: 120,
                objectFit: 'cover',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                justifySelf: { xs: 'start', sm: 'end' },
                backgroundColor: 'grey.100',
              }}
            />
          ) : null}
        </Box>
      ) : null}
    </Stack>
  );
}
