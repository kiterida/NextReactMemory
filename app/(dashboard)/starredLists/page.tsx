'use client';
import React from 'react';
import MemoriesView from '../../components/MemoriesView';



import SearchIcon from '@mui/icons-material/Search';
import { TextField, Stack, IconButton, Tooltip } from '@mui/material';

export function toolbarActions() {
     console.log('Rendering toolbarActions');
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Tooltip title="Search" enterDelay={1000}>
        <IconButton type="button" aria-label="search">
          <SearchIcon />
        </IconButton>
      </Tooltip>
      <TextField size="small" variant="outlined" label="Search" />
    </Stack>
  );
}

const StarredLists = () => {
    return <MemoriesView filterStarred/>;
}

export default StarredLists;