'use client';

import * as React from 'react';
import Link from 'next/link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CenterFocusWeakIcon from '@mui/icons-material/CenterFocusWeak';

type AppVersionResponse = {
  version?: string;
};

async function fetchAppVersion(signal: AbortSignal) {
  const response = await fetch('/api/app-version', {
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error('Failed to load app version');
  }

  const data = (await response.json()) as AppVersionResponse;
  return data.version ?? '';
}

export default function AppTitleWithVersion() {
  const [version, setVersion] = React.useState('');

  React.useEffect(() => {
    const abortController = new AbortController();

    fetchAppVersion(abortController.signal)
      .then(setVersion)
      .catch(() => {
        setVersion('');
      });

    return () => {
      abortController.abort();
    };
  }, []);

  return (
    <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
      <Stack
        direction="row"
        alignItems="center"
        sx={{
          minHeight: { xs: 32, sm: 40 },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', alignSelf: 'center', gap: 1 }}>
          <CenterFocusWeakIcon sx={{ color: 'text.primary', fontSize: { xs: '1.25rem', sm: '1.25rem' } }} />
        </Box>
        <Typography
          variant="h6"
          sx={{
            display: 'flex',
            alignItems: 'center',
            color: 'primary.main',
            fontWeight: 700,
            ml: { xs: 0.75, sm: 1 },
            whiteSpace: 'nowrap',
            lineHeight: 1,
            fontSize: { xs: '1rem', sm: '1.25rem' },
          }}
        >
          Memory Core
        </Typography>
        {version ? (
          <Typography
            variant="caption"
            sx={{
              display: { xs: 'none', sm: 'flex' },
              alignItems: 'center',
              alignSelf: 'center',
              ml: 1,
              color: 'text.secondary',
              whiteSpace: 'nowrap',
              fontFamily: 'monospace',
              lineHeight: 1,
            }}
          >
            {version}
          </Typography>
        ) : null}
      </Stack>
    </Link>
  );
}
