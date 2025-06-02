'use client';
import * as React from 'react';
import { usePathname, useParams } from 'next/navigation';
import { DashboardLayout, ThemeSwitcher } from '@toolpad/core/DashboardLayout';
import { PageContainer } from '@toolpad/core/PageContainer';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import SearchIcon from '@mui/icons-material/Search';
import InputAdornment from '@mui/material/InputAdornment';
import '../globals.css';
import { searchMemoryItems } from '../components/memoryData';
import Paper from '@mui/material/Paper';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import { useRouter } from 'next/navigation';

type MemoryItem = {
  id: string;
  name?: string;
};

// ✅ Stable toolbar with internal state
function ToolbarActionsSearch() {
  const [searchText, setSearchText] = React.useState('');
//   const [results, setResults] = React.useState([]);
  //
  const [results, setResults] = React.useState<{ id: string; name?: string }[]>([]);
  const [showResults, setShowResults] = React.useState(false);
  const router = useRouter();

  const handleSearch = async () => {
    if (searchText.length > 2) {
      console.log("Searching for: ", searchText);
      const data = await searchMemoryItems(searchText);
      setResults(data || []);
      setShowResults(true);
    } else {
      setResults([]);
      setShowResults(false);
    }
  };

  const handleSelect = (item: MemoryItem) => {
    setShowResults(false);
    setSearchText('');
    // Navigate to the memory tree and maybe pass the selected item's ID as a query param or route param
    router.push(`/memories?focus=${item.id}`);
  };

 return (
    <ClickAwayListener onClickAway={() => setShowResults(false)}>
      <Box sx={{ position: 'relative' }}>
        <Stack direction="row" alignItems="center">
          <TextField
            label="Search"
            variant="outlined"
            size="small"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={handleSearch} size="small">
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

        {showResults && results.length > 0 && (
          <Paper
            sx={{
              position: 'absolute',
              top: '100%',
              left: 0,
              zIndex: 10,
              width: '100%',
              maxHeight: 300,
              overflowY: 'auto',
              mt: 1,
            }}
          >
            <List dense>
              {results.map((item) => (
                <ListItemButton key={item.id} onClick={() => handleSelect(item)}>
                  <ListItemText primary={item.name || 'Unnamed'} />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        )}
      </Box>
    </ClickAwayListener>
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
