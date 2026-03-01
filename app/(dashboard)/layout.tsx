'use client';
import * as React from 'react';
import { usePathname, useParams, useRouter } from 'next/navigation';
import { DashboardLayout, ThemeSwitcher } from '@toolpad/core/DashboardLayout';
import { PageContainer, PageHeaderToolbar, PageHeader } from '@toolpad/core/PageContainer';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import SearchIcon from '@mui/icons-material/Search';
import InputAdornment from '@mui/material/InputAdornment';
import '../globals.css';
import { searchMemoryItems, searchMemoryItemsAdvanced, createNewMemoryList } from '../components/memoryData';
import Paper from '@mui/material/Paper';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import Checkbox from '@mui/material/Checkbox';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';

type MemoryItem = {
  id: string;
  name?: string;
};

type SearchColumn = 'memory_key' | 'name' | 'memory_image' | 'description' | 'rich_text';

type MemoryListOption = {
  id: string;
  name?: string;
};

const ADVANCED_SEARCH_COLUMNS: Array<{ key: SearchColumn; label: string }> = [
  { key: 'memory_key', label: 'memory_key' },
  { key: 'name', label: 'name' },
  { key: 'memory_image', label: 'memory_image' },
  { key: 'description', label: 'description' },
  { key: 'rich_text', label: 'rich_text' },
];

function ToolbarActionsSearch() {
  const [searchText, setSearchText] = React.useState('');
  const [results, setResults] = React.useState<MemoryItem[]>([]);
  const [showResults, setShowResults] = React.useState(false);
  const [advancedSearchOpen, setAdvancedSearchOpen] = React.useState(false);
  const [selectedListIds, setSelectedListIds] = React.useState<string[]>([]);
  const [availableLists, setAvailableLists] = React.useState<MemoryListOption[]>([]);
  const [selectedTreeListId, setSelectedTreeListId] = React.useState<string | null>(null);
  const [selectedColumns, setSelectedColumns] = React.useState<SearchColumn[]>(['name', 'description', 'rich_text']);
  const router = useRouter();

  React.useEffect(() => {
    const handleMemorySearchContext = (event: Event) => {
      const customEvent = event as CustomEvent<{
        selectedListId?: string | null;
        lists?: MemoryListOption[];
      }>;

      const nextLists = Array.isArray(customEvent.detail?.lists)
        ? customEvent.detail.lists.map((item) => ({
            id: String(item.id),
            name: item.name,
          }))
        : [];
      setAvailableLists(nextLists);

      const nextSelectedListId = customEvent.detail?.selectedListId
        ? String(customEvent.detail.selectedListId)
        : null;
      setSelectedTreeListId(nextSelectedListId);
    };

    window.addEventListener('memory-search-context', handleMemorySearchContext);
    return () => {
      window.removeEventListener('memory-search-context', handleMemorySearchContext);
    };
  }, []);

  const handleSearch = async () => {
    if (searchText.length > 2) {
      const data = await searchMemoryItems(searchText);
      setResults(data || []);
      setShowResults(true);
      return;
    }

    setResults([]);
    setShowResults(false);
  };

  const handleSelect = (item: MemoryItem) => {
    setShowResults(false);
    setSearchText('');
    router.push(`/memories?focus=${item.id}`);
  };

  const handleOpenAdvancedSearch = () => {
    if (selectedTreeListId && selectedListIds.length === 0) {
      setSelectedListIds([selectedTreeListId]);
    }

    setShowResults(false);
    setAdvancedSearchOpen(true);
  };

  const handleToggleColumn = (column: SearchColumn) => {
    setSelectedColumns((prev) => {
      if (prev.includes(column)) {
        return prev.filter((item) => item !== column);
      }

      return [...prev, column];
    });
  };

  const handleAdvancedSearch = async () => {
    const trimmedSearchText = searchText.trim();

    if (trimmedSearchText.length < 2 || selectedColumns.length === 0) {
      setResults([]);
      setShowResults(false);
      setAdvancedSearchOpen(false);
      return;
    }

    const data = await searchMemoryItemsAdvanced(trimmedSearchText, {
      listIds: selectedListIds,
      columns: selectedColumns,
    });

    setResults(data || []);
    setShowResults(true);
    setAdvancedSearchOpen(false);
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
          <Tooltip title="Advanced Search">
            <IconButton onClick={handleOpenAdvancedSearch} size="small" aria-label="advanced-search" sx={{ mr: 1 }}>
              <ManageSearchIcon />
            </IconButton>
          </Tooltip>
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

        <Dialog open={advancedSearchOpen} onClose={() => setAdvancedSearchOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Advanced Search</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <Autocomplete
                multiple
                options={availableLists}
                value={availableLists.filter((item) => selectedListIds.includes(String(item.id)))}
                getOptionLabel={(option) => option.name || `List ${option.id}`}
                onChange={(_event, values) => setSelectedListIds(values.map((item) => String(item.id)))}
                renderInput={(params) => (
                  <TextField {...params} label="Memory Lists" placeholder="Select one or more lists" />
                )}
              />

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Search Columns
                </Typography>
                <FormGroup>
                  {ADVANCED_SEARCH_COLUMNS.map((column) => (
                    <FormControlLabel
                      key={column.key}
                      control={
                        <Checkbox
                          checked={selectedColumns.includes(column.key)}
                          onChange={() => handleToggleColumn(column.key)}
                        />
                      }
                      label={column.label}
                    />
                  ))}
                </FormGroup>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAdvancedSearchOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleAdvancedSearch}>
              Search
            </Button>
          </DialogActions>
        </Dialog>
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

  const contentSx = {
    maxWidth: '100% !important',
    margin: '0 !important',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    p: 0,
  };

  const isSingleListViewRoute = pathname === '/singleListView';
  const showSearchToolbar = pathname === '/memories' || pathname === '/starredLists';

  const onCreateNewMemoryList = async () => {
    const newItemId = await createNewMemoryList();
    if (!newItemId) return;

    window.dispatchEvent(
      new CustomEvent('memory-list-created', {
        detail: { id: String(newItemId) },
      })
    );
  };

  function CustomPageToolbar() {
    const memoryTesterPage = usePathname() === '/memoryTester';

    return memoryTesterPage ? (
      <PageHeaderToolbar>
        <Tooltip title="Add to Revision list">
          <IconButton onClick={() => window.dispatchEvent(new Event('run-add-to-revision-list'))} color="success" aria-label="Add to revision List">
            <FactCheckIcon color="secondary" />
          </IconButton>
        </Tooltip>
      </PageHeaderToolbar>
    ) : (
      <PageHeaderToolbar>
        <Tooltip title="Create New Memory List">
          <IconButton onClick={onCreateNewMemoryList} color="success" aria-label="Create New Memory List">
            <AddCircleIcon />
          </IconButton>
        </Tooltip>
      </PageHeaderToolbar>
    );
  }

  function CustomPageHeader() {
    const CustomPageToolbarComponent = React.useCallback(
      () => <CustomPageToolbar />,
      [],
    );

    return <PageHeader slots={{ toolbar: CustomPageToolbarComponent }} />;
  }

  const CustomPageHeaderComponent = () => <CustomPageHeader />;

  const renderHeader = true;

  return (
    <DashboardLayout
      sx={{ height: '100vh', overflow: 'hidden' }}
      slots={{
        toolbarActions: showSearchToolbar ? ToolbarActionsSearch : undefined,
      }}
    >
      {isSingleListViewRoute ? (
        <Box sx={{ ...contentSx, pt: '40px' }}>
          {props.children}
        </Box>
      ) : (
        <PageContainer title={title} sx={sxOverride} {...(renderHeader ? { slots: { header: CustomPageHeaderComponent } } : {})}>
          {props.children}
        </PageContainer>
      )}
    </DashboardLayout>
  );
}
