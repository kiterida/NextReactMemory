'use client';

import * as React from 'react';
import Link from 'next/link';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
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
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Typography variant="h6">{widget.title}</Typography>

          {loading ? <CircularProgress size={24} /> : null}

          {!loading && error ? <Alert severity="error">{error}</Alert> : null}

          {!loading && !error && !memoryItem ? (
            <Alert severity="info">Choose a memory item in this widget&apos;s configuration.</Alert>
          ) : null}

          {!loading && !error && memoryItem ? (
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
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
