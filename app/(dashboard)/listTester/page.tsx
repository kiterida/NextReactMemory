'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { supabase } from '@/app/components/supabaseClient';

type RootMemoryItem = {
  id: number;
  name: string | null;
};

type MemoryTestItem = {
  id: number;
  name: string | null;
  memory_key: string | number | null;
};

export default function ListTesterPage() {
  const [searchText, setSearchText] = React.useState('');
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState('');
  const [results, setResults] = React.useState<RootMemoryItem[]>([]);
  const [selectedName, setSelectedName] = React.useState('');
  const [selectedChildCount, setSelectedChildCount] = React.useState<number | null>(null);
  const [isLoadingCount, setIsLoadingCount] = React.useState(false);
  const [subLists, setSubLists] = React.useState<RootMemoryItem[]>([]);
  const [isLoadingSubLists, setIsLoadingSubLists] = React.useState(false);
  const [selectedSubListName, setSelectedSubListName] = React.useState('');
  const [selectedSubListChildCount, setSelectedSubListChildCount] = React.useState<number | null>(null);
  const [isLoadingSubListCount, setIsLoadingSubListCount] = React.useState(false);
  const [memoryTestItems, setMemoryTestItems] = React.useState<MemoryTestItem[]>([]);
  const [currentTestIndex, setCurrentTestIndex] = React.useState(0);
  const [isLoadingMemoryTestItem, setIsLoadingMemoryTestItem] = React.useState(false);
  const [showMemoryName, setShowMemoryName] = React.useState(false);
  const memoryTestItem = memoryTestItems[currentTestIndex] ?? null;

  const handleSearch = React.useCallback(async () => {
    const trimmed = searchText.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    setSearchError('');
    setSelectedName('');
    setSelectedChildCount(null);
    setSubLists([]);
    setSelectedSubListName('');
    setSelectedSubListChildCount(null);
    setMemoryTestItems([]);
    setCurrentTestIndex(0);
    setShowMemoryName(false);

    const { data, error } = await supabase
      .from('memory_items')
      .select('id,name')
      .is('parent_id', null)
      .ilike('name', `%${trimmed}%`)
      .order('name', { ascending: true })
      .limit(50);

    setIsSearching(false);

    if (error) {
      setSearchError('Search failed. Please try again.');
      setResults([]);
      return;
    }

    setResults(data ?? []);
  }, [searchText]);

  const loadSubLists = React.useCallback(async (parentId: number) => {
    setIsLoadingSubLists(true);
    setSubLists([]);

    const { data: directChildren, error: directChildrenError } = await supabase
      .from('memory_items')
      .select('id,name')
      .eq('parent_id', parentId);

    if (directChildrenError) {
      setIsLoadingSubLists(false);
      setSearchError('Could not load sub lists.');
      return;
    }

    if (!directChildren || directChildren.length === 0) {
      setIsLoadingSubLists(false);
      return;
    }

    const childIds = directChildren.map((row) => row.id);
    const { data: grandchildrenRows, error: grandchildrenError } = await supabase
      .from('memory_items')
      .select('parent_id')
      .in('parent_id', childIds);

    setIsLoadingSubLists(false);

    if (grandchildrenError) {
      setSearchError('Could not load sub lists.');
      return;
    }

    const childIdsWithChildren = new Set(
      (grandchildrenRows ?? [])
        .map((row) => row.parent_id)
        .filter((id): id is number => id !== null),
    );

    const nestedSubLists = directChildren.filter((row) => childIdsWithChildren.has(row.id));
    setSubLists(nestedSubLists);
  }, []);

  const handleSelectResult = React.useCallback(async (item: RootMemoryItem) => {
    setSelectedName(item.name ?? 'Unnamed');
    setIsLoadingCount(true);
    setIsLoadingSubLists(true);
    setSearchError('');
    setSelectedSubListName('');
    setSelectedSubListChildCount(null);
    setMemoryTestItems([]);
    setCurrentTestIndex(0);
    setShowMemoryName(false);

    const { count, error } = await supabase
      .from('memory_items')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', item.id);

    setIsLoadingCount(false);

    if (error) {
      setSearchError('Could not load child count.');
      setSelectedChildCount(null);
      setIsLoadingSubLists(false);
      return;
    }

    setSelectedChildCount(count ?? 0);
    await loadSubLists(item.id);
  }, [loadSubLists]);

  const handleSelectSubList = React.useCallback(async (item: RootMemoryItem) => {
    setSelectedSubListName(item.name ?? 'Unnamed');
    setIsLoadingSubListCount(true);
    setIsLoadingMemoryTestItem(true);
    setSearchError('');
    setShowMemoryName(false);

    const { count, error } = await supabase
      .from('memory_items')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', item.id);

    setIsLoadingSubListCount(false);

    if (error) {
      setSearchError('Could not load selected sub list child count.');
      setSelectedSubListChildCount(null);
      setIsLoadingMemoryTestItem(false);
      setMemoryTestItems([]);
      setCurrentTestIndex(0);
      return;
    }

    setSelectedSubListChildCount(count ?? 0);

    const { data: childItems, error: childItemsError } = await supabase
      .from('memory_items')
      .select('id,name,memory_key')
      .eq('parent_id', item.id);

    setIsLoadingMemoryTestItem(false);

    if (childItemsError) {
      setSearchError('Could not load first memory test item.');
      setMemoryTestItems([]);
      setCurrentTestIndex(0);
      return;
    }

    const sortedItems = [...(childItems ?? [])].sort((a, b) => {
      const aValue = Number.parseInt(String(a.memory_key ?? ''), 10);
      const bValue = Number.parseInt(String(b.memory_key ?? ''), 10);

      if (Number.isNaN(aValue) && Number.isNaN(bValue)) return 0;
      if (Number.isNaN(aValue)) return 1;
      if (Number.isNaN(bValue)) return -1;
      return aValue - bValue;
    });

    setMemoryTestItems(sortedItems);
    setCurrentTestIndex(0);
  }, []);

  const handleNextMemoryItem = React.useCallback(() => {
    setCurrentTestIndex((previous) => {
      if (previous >= memoryTestItems.length - 1) return previous;
      return previous + 1;
    });
    setShowMemoryName(false);
  }, [memoryTestItems.length]);

  const handlePreviousMemoryItem = React.useCallback(() => {
    setCurrentTestIndex((previous) => {
      if (previous <= 0) return previous;
      return previous - 1;
    });
    setShowMemoryName(false);
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, maxWidth: 900 }}>
        <Stack spacing={2}>
          <Typography variant="h5">List Tester</Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              label="Search Lists"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleSearch();
                }
              }}
              fullWidth
            />
            <Button variant="contained" onClick={handleSearch} disabled={isSearching}>
              Search
            </Button>
          </Stack>

          {isSearching ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={20} />
              <Typography variant="body2">Searching...</Typography>
            </Box>
          ) : null}

          {searchError ? <Alert severity="error">{searchError}</Alert> : null}

          <Stack spacing={1}>
            {results.map((item) => (
              <Button
                key={item.id}
                variant="outlined"
                onClick={() => handleSelectResult(item)}
                sx={{ justifyContent: 'flex-start' }}
              >
                {item.name ?? 'Unnamed'}
              </Button>
            ))}

            {!isSearching && results.length === 0 && searchText.trim() ? (
              <Typography variant="body2" color="text.secondary">
                No root lists found.
              </Typography>
            ) : null}
          </Stack>

          {selectedName ? (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1">Selected List: {selectedName}</Typography>
              <Typography variant="body2" color="text.secondary">
                {isLoadingCount
                  ? 'Loading child count...'
                  : `Children items count: ${selectedChildCount ?? 0}`}
              </Typography>
            </Paper>
          ) : null}

          {selectedName ? (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1">Sub Lists</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Child rows from the selected list that also contain children.
              </Typography>

              {isLoadingSubLists ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2">Loading sub lists...</Typography>
                </Box>
              ) : null}

              {!isLoadingSubLists && subLists.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No sub lists found for this list.
                </Typography>
              ) : null}

              <Stack spacing={1}>
                {subLists.map((item) => (
                  <Button
                    key={item.id}
                    variant="outlined"
                    onClick={() => handleSelectSubList(item)}
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    {item.name ?? 'Unnamed'}
                  </Button>
                ))}
              </Stack>

              {selectedSubListName ? (
                <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
                  <Typography variant="subtitle2">Selected Sub List: {selectedSubListName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {isLoadingSubListCount
                      ? 'Loading child count...'
                      : `Children items count: ${selectedSubListChildCount ?? 0}`}
                  </Typography>
                </Paper>
              ) : null}
            </Paper>
          ) : null}

          {selectedName && selectedSubListName ? (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6">Memory Test Form</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Path: {selectedName} / {selectedSubListName}
              </Typography>

              {isLoadingMemoryTestItem ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2">Loading first item...</Typography>
                </Box>
              ) : null}

              {!isLoadingMemoryTestItem && !memoryTestItem ? (
                <Typography variant="body2" color="text.secondary">
                  No child items were found in this sub list.
                </Typography>
              ) : null}

              {!isLoadingMemoryTestItem && memoryTestItem ? (
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <IconButton
                      aria-label="Previous memory item"
                      onClick={handlePreviousMemoryItem}
                      disabled={currentTestIndex <= 0}
                    >
                      <ArrowBackIcon />
                    </IconButton>
                    <IconButton
                      aria-label="Next memory item"
                      onClick={handleNextMemoryItem}
                      disabled={currentTestIndex >= memoryTestItems.length - 1}
                    >
                      <ArrowForwardIcon />
                    </IconButton>
                    <Typography variant="body2" color="text.secondary">
                      {currentTestIndex + 1} / {memoryTestItems.length}
                    </Typography>
                  </Stack>

                  <TextField
                    label="Memory Key"
                    value={String(memoryTestItem.memory_key ?? '')}
                    InputProps={{ readOnly: true }}
                    fullWidth
                  />

                  <Button
                    variant="outlined"
                    onClick={() => setShowMemoryName((previous) => !previous)}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    {showMemoryName ? 'Hide Name' : 'Show Name'}
                  </Button>

                  {showMemoryName ? (
                    <TextField
                      label="Name"
                      value={memoryTestItem.name ?? 'Unnamed'}
                      InputProps={{ readOnly: true }}
                      fullWidth
                    />
                  ) : null}
                </Stack>
              ) : null}
            </Paper>
          ) : null}
        </Stack>
      </Paper>
    </Box>
  );
}
