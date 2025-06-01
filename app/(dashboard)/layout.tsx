'use client';
import * as React from 'react';
import { usePathname, useParams } from 'next/navigation';
import { DashboardLayout, ThemeSwitcher } from '@toolpad/core/DashboardLayout';
import { PageContainer } from '@toolpad/core/PageContainer';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Stack from '@mui/material/Stack';
import SearchIcon from '@mui/icons-material/Search';
import InputAdornment from '@mui/material/InputAdornment';
import '../globals.css';
import { searchMemoryItems } from '../components/memoryData';

// ✅ Stable toolbar with internal state
function ToolbarActionsSearch() {
  const [searchText, setSearchText] = React.useState('');

  const handleSearch = async () => {
    console.log('search:', searchText);
    if (searchText.length > 2) {
      const data = await searchMemoryItems(searchText);
      console.log(data);
    }
  };

  return (
    <Stack direction="row">
      <Tooltip title="Search" enterDelay={1000}>
        <div>
          <IconButton
            type="button"
            aria-label="search"
            sx={{ display: { xs: 'inline', md: 'none' } }}
            onClick={handleSearch}
          >
            <SearchIcon />
          </IconButton>
        </div>
      </Tooltip>
      <TextField
        label="Search"
        variant="outlined"
        size="small"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton type="button" aria-label="search" size="small" onClick={handleSearch}>
                <SearchIcon />
              </IconButton>
            </InputAdornment>
          ),
          sx: { pr: 0.5 },
        }}
        sx={{ display: { xs: 'none', md: 'inline-block' }, mr: 1 }}
      />
      <ThemeSwitcher />
    </Stack>
  );
}

export default function Layout(props: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const [employeeId] = params.segments ?? [];

  const title = React.useMemo(() => {
    if (pathname === '/employees/new') return 'New Employee';
    if (employeeId && pathname.includes('/edit')) return `Employee ${employeeId} - Edit`;
    if (employeeId) return `Employee ${employeeId}`;
    return undefined;
  }, [employeeId, pathname]);

  const sxOverride =
    pathname === '/memories' || pathname === '/starredLists'
      ? {
        maxWidth: '100% !important',
        margin: '0 !important',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        p: 0,
      }
      : undefined;

  // ✅ Only use search bar on specific routes
  const showSearchToolbar = pathname === '/memories' || pathname === '/starredLists';

  return (
    <DashboardLayout
      sx={{ height: '100vh', overflow: 'hidden' }}
      slots={{
        toolbarActions: showSearchToolbar ? ToolbarActionsSearch : undefined,
      }}
    >
      <PageContainer title={title} sx={sxOverride}>
        {props.children}
      </PageContainer>
    </DashboardLayout>
  );
}
