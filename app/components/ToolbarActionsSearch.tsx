'use client';

import * as React from 'react';
import { Stack, Tooltip, IconButton, TextField } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { ThemeSwitcher } from '@toolpad/core/DashboardLayout';

export default function ToolbarActionsSearch() {
  return (
    <Stack direction="row">
      <Tooltip title="Search" enterDelay={1000}>
        <div>
          <IconButton
            type="button"
            aria-label="search"
            sx={{
              display: { xs: 'inline', md: 'none' },
            }}
          >
            <SearchIcon />
          </IconButton>
        </div>
      </Tooltip>
      <TextField
        label="Search"
        variant="outlined"
        size="small"
        sx={{ display: { xs: 'none', md: 'inline-block' }, mr: 1 }}
        InputProps={{
          endAdornment: (
            <IconButton type="button" aria-label="search" size="small">
              <SearchIcon />
            </IconButton>
          ),
        }}
      />
      <ThemeSwitcher />
    </Stack>
  );
}
