'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import {
  completeMemoryTestSession,
  createMemoryTestSession,
  recordMemoryTestResult,
  updateMemoryTestSessionProgress,
} from '@/app/components/memoryTestHistory';
import {
  fetchMemoryItemById,
  fetchMemoryListRoots,
  getListDescendants,
  getTestableNodesForList,
  getTestableNodesForSubtree,
} from '@/app/components/memoryData';

type RootMemoryItem = {
  id: number;
  name: string | null;
  parent_id?: number | null;
  list_id?: number | null;
  item_type?: string | null;
  child_count?: number | null;
};

type MemoryTestItem = {
  id: number;
  name: string | null;
  memory_key: string | number | null;
  memory_image?: string | null;
  list_id?: number | null;
  item_type?: string | null;
  is_testable?: boolean;
  child_count?: number | null;
};

type TestSummary = {
  totalItems: number;
  correctCount: number;
  incorrectCount: number;
};

function TabPanel({
  children,
  value,
  index,
}: {
  children: React.ReactNode;
  value: number;
  index: number;
}) {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`list-tester-tabpanel-${index}`}
      aria-labelledby={`list-tester-tab-${index}`}
      sx={{ display: value === index ? 'block' : 'none' }}
    >
      {children}
    </Box>
  );
}

export default function ListTesterPage() {
  const [activeTab, setActiveTab] = React.useState(0);
  const [searchText, setSearchText] = React.useState('');
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState('');
  const [results, setResults] = React.useState<RootMemoryItem[]>([]);
  const [selectedRootItem, setSelectedRootItem] = React.useState<RootMemoryItem | null>(null);
  const [selectedName, setSelectedName] = React.useState('');
  const [selectedChildCount, setSelectedChildCount] = React.useState<number | null>(null);
  const [isLoadingCount, setIsLoadingCount] = React.useState(false);
  const [subLists, setSubLists] = React.useState<RootMemoryItem[]>([]);
  const [isLoadingSubLists, setIsLoadingSubLists] = React.useState(false);
  const [selectedSubListName, setSelectedSubListName] = React.useState('');
  const [selectedSubListChildCount, setSelectedSubListChildCount] = React.useState<number | null>(null);
  const [isLoadingSubListCount, setIsLoadingSubListCount] = React.useState(false);
  const [startMemoryKey, setStartMemoryKey] = React.useState('');
  const [memoryKeyError, setMemoryKeyError] = React.useState('');
  const [memoryTestItems, setMemoryTestItems] = React.useState<MemoryTestItem[]>([]);
  const [currentTestIndex, setCurrentTestIndex] = React.useState(0);
  const [isLoadingMemoryTestItem, setIsLoadingMemoryTestItem] = React.useState(false);
  const [showMemoryName, setShowMemoryName] = React.useState(false);
  const [showMemoryImage, setShowMemoryImage] = React.useState(false);
  const [previewMemoryImage, setPreviewMemoryImage] = React.useState('');
  const [isLoadingPreviewMemoryImage, setIsLoadingPreviewMemoryImage] = React.useState(false);
  const [previewMemoryImageError, setPreviewMemoryImageError] = React.useState('');
  const [activeTestSourceLabel, setActiveTestSourceLabel] = React.useState('');
  const [activeTestSourceType, setActiveTestSourceType] = React.useState<'sublist' | 'root' | null>(null);
  const [activeTestListId, setActiveTestListId] = React.useState<number | null>(null);
  const [activeSessionId, setActiveSessionId] = React.useState<number | null>(null);
  const [isSavingAnswer, setIsSavingAnswer] = React.useState(false);
  const [testSaveError, setTestSaveError] = React.useState('');
  const [testSummary, setTestSummary] = React.useState<TestSummary | null>(null);
  const activeSessionIdRef = React.useRef<number | null>(null);
  const sessionStatsRef = React.useRef({
    totalItems: 0,
    correctCount: 0,
    incorrectCount: 0,
    answeredItemIds: new Set<number>(),
  });
  const memoryTestItem = currentTestIndex < memoryTestItems.length ? memoryTestItems[currentTestIndex] ?? null : null;
  const hasCompletedTest = Boolean(testSummary) && currentTestIndex >= memoryTestItems.length;
  const currentItemAlreadyRecorded = Boolean(
    memoryTestItem && sessionStatsRef.current.answeredItemIds.has(memoryTestItem.id),
  );

  const handleOpenMemoryImage = React.useCallback(async () => {
    if (!memoryTestItem) {
      return;
    }

    setShowMemoryImage(true);
    const initialImage = String(memoryTestItem.memory_image ?? '').trim();
    setPreviewMemoryImage(initialImage);
    setPreviewMemoryImageError('');

    if (initialImage) {
      return;
    }

    setIsLoadingPreviewMemoryImage(true);
    try {
      const fullItem = await fetchMemoryItemById(memoryTestItem.id);
      const nextImage = String(fullItem?.memory_image ?? '').trim();
      setPreviewMemoryImage(nextImage);
      if (!nextImage) {
        setPreviewMemoryImageError('This item does not have a memory image.');
      }
    } catch (error) {
      setPreviewMemoryImageError('Could not load the memory image.');
    } finally {
      setIsLoadingPreviewMemoryImage(false);
    }
  }, [memoryTestItem]);

  const resetSessionTracking = React.useCallback((listId: number | null, totalItems: number) => {
    setActiveTestListId(listId);
    setActiveSessionId(null);
    activeSessionIdRef.current = null;
    sessionStatsRef.current = {
      totalItems,
      correctCount: 0,
      incorrectCount: 0,
      answeredItemIds: new Set<number>(),
    };
    setTestSaveError('');
    setTestSummary(null);
  }, []);

  const finalizeSession = React.useCallback(
    async ({
      showSummary = false,
      completedAt = new Date().toISOString(),
    }: {
      showSummary?: boolean;
      completedAt?: string;
    } = {}) => {
      const sessionId = activeSessionIdRef.current;
      const { totalItems, correctCount, incorrectCount, answeredItemIds } = sessionStatsRef.current;

      if (!sessionId) {
        if (showSummary) {
          setTestSummary({ totalItems, correctCount, incorrectCount });
        }
        return;
      }

      if (answeredItemIds.size === 0) {
        setActiveSessionId(null);
        activeSessionIdRef.current = null;
        if (showSummary) {
          setTestSummary({ totalItems, correctCount, incorrectCount });
        }
        return;
      }

      try {
        await completeMemoryTestSession({
          sessionId,
          totalItems,
          correctCount,
          incorrectCount,
          completedAt,
        });
      } catch (error) {
        console.error('Failed to complete memory test session:', error);
      } finally {
        setActiveSessionId(null);
        activeSessionIdRef.current = null;
      }

      if (showSummary) {
        setTestSummary({ totalItems, correctCount, incorrectCount });
      }
    },
    [],
  );

  const sortMemoryItems = React.useCallback((items: MemoryTestItem[]) => {
    return [...items].sort((a, b) => {
      const aValue = Number.parseInt(String(a.memory_key ?? ''), 10);
      const bValue = Number.parseInt(String(b.memory_key ?? ''), 10);

      if (Number.isNaN(aValue) && Number.isNaN(bValue)) return 0;
      if (Number.isNaN(aValue)) return 1;
      if (Number.isNaN(bValue)) return -1;
      return aValue - bValue;
    });
  }, []);

  const loadMemoryTestItems = React.useCallback(
    async ({
      listId,
      rootId,
      sourceLabel,
      sourceType,
      startAtMemoryKey,
      notFoundMessage,
    }: {
      listId: number;
      rootId: number;
      sourceLabel: string;
      sourceType: 'sublist' | 'root';
      startAtMemoryKey?: number;
      notFoundMessage?: string;
    }) => {
      setIsLoadingMemoryTestItem(true);
      setSearchError('');
      setMemoryKeyError('');
      setShowMemoryName(false);
      setTestSaveError('');
      setTestSummary(null);

      try {
        const testItems =
          sourceType === 'sublist'
            ? await getTestableNodesForSubtree(rootId)
            : await getTestableNodesForList(listId);

        const sortedItems = sortMemoryItems(testItems ?? []);

        if (sortedItems.length === 0) {
          setMemoryTestItems([]);
          setCurrentTestIndex(0);
          setActiveTestSourceLabel(sourceLabel);
          setActiveTestSourceType(sourceType);
          resetSessionTracking(listId, 0);
          return;
        }

        let nextIndex = 0;

        if (typeof startAtMemoryKey === 'number') {
          nextIndex = sortedItems.findIndex((item) => {
            const itemMemoryKey = Number.parseInt(String(item.memory_key ?? ''), 10);
            return itemMemoryKey === startAtMemoryKey;
          });

          if (nextIndex === -1) {
            setMemoryTestItems([]);
            setCurrentTestIndex(0);
            setActiveTestSourceLabel('');
            setActiveTestSourceType(null);
            resetSessionTracking(null, 0);
            setMemoryKeyError(notFoundMessage ?? 'That memory key was not found in the selected list.');
            return;
          }
        }

        setMemoryTestItems(sortedItems);
        setCurrentTestIndex(nextIndex);
        setActiveTestSourceLabel(sourceLabel);
        setActiveTestSourceType(sourceType);
        resetSessionTracking(listId, sortedItems.length);
        setActiveTab(2);
      } catch (error) {
        setSearchError('Could not load memory test items.');
        setMemoryTestItems([]);
        setCurrentTestIndex(0);
        setActiveTestSourceLabel('');
        setActiveTestSourceType(null);
        resetSessionTracking(null, 0);
      } finally {
        setIsLoadingMemoryTestItem(false);
      }
    },
    [resetSessionTracking, sortMemoryItems],
  );

  const handleSearch = React.useCallback(async () => {
    const trimmed = searchText.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    void finalizeSession();
    setSearchError('');
    setSelectedRootItem(null);
    setSelectedName('');
    setSelectedChildCount(null);
    setSubLists([]);
    setSelectedSubListName('');
    setSelectedSubListChildCount(null);
    setStartMemoryKey('');
    setMemoryKeyError('');
    setMemoryTestItems([]);
    setCurrentTestIndex(0);
    setActiveTestSourceLabel('');
    setActiveTestSourceType(null);
    setShowMemoryName(false);
    resetSessionTracking(null, 0);

    try {
      const data = await fetchMemoryListRoots(trimmed);
      setResults(data ?? []);
    } catch (error) {
      setSearchError('Search failed. Please try again.');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [finalizeSession, resetSessionTracking, searchText]);

  const loadSubLists = React.useCallback(async (parentId: number) => {
    setIsLoadingSubLists(true);
    setSubLists([]);

    try {
      const descendants = await getListDescendants(parentId);
      const directSubLists = (descendants ?? []).filter(
        (row: RootMemoryItem) => row.parent_id === parentId && Number(row.child_count ?? 0) > 0,
      );
      setSubLists(directSubLists);
    } catch (error) {
      setSearchError('Could not load sub lists.');
    } finally {
      setIsLoadingSubLists(false);
    }
  }, []);

  const handleSelectResult = React.useCallback(async (item: RootMemoryItem) => {
    void finalizeSession();
    setSelectedRootItem(item);
    setSelectedName(item.name ?? 'Unnamed');
    setIsLoadingCount(true);
    setIsLoadingSubLists(true);
    setSearchError('');
    setSelectedSubListName('');
    setSelectedSubListChildCount(null);
    setStartMemoryKey('');
    setMemoryKeyError('');
    setMemoryTestItems([]);
    setCurrentTestIndex(0);
    setActiveTestSourceLabel('');
    setActiveTestSourceType(null);
    setShowMemoryName(false);
    resetSessionTracking(null, 0);

    try {
      const descendants = await getListDescendants(item.id);
      const directChildren = (descendants ?? []).filter((row: RootMemoryItem) => row.parent_id === item.id);
      setSelectedChildCount(directChildren.length);
      await loadSubLists(item.id);
      setActiveTab(1);
    } catch (error) {
      setSearchError('Could not load child count.');
      setSelectedChildCount(null);
      setIsLoadingSubLists(false);
    } finally {
      setIsLoadingCount(false);
    }
  }, [finalizeSession, loadSubLists, resetSessionTracking]);

  const handleSelectSubList = React.useCallback(async (item: RootMemoryItem) => {
    void finalizeSession();
    setSelectedSubListName(item.name ?? 'Unnamed');
    setIsLoadingSubListCount(true);
    setSearchError('');
    setMemoryKeyError('');
    setShowMemoryName(false);

    try {
      const descendants = await getListDescendants(selectedRootItem?.id ?? 0);
      const directChildren = (descendants ?? []).filter((row: RootMemoryItem) => row.parent_id === item.id);
      setSelectedSubListChildCount(directChildren.length);

      await loadMemoryTestItems({
        listId: selectedRootItem?.id ?? item.list_id ?? item.id,
        rootId: item.id,
        sourceLabel: item.name ?? 'Unnamed',
        sourceType: 'sublist',
      });
    } catch (error) {
      setSearchError('Could not load selected sub list child count.');
      setSelectedSubListChildCount(null);
      setMemoryTestItems([]);
      setCurrentTestIndex(0);
      setActiveTestSourceLabel('');
      setActiveTestSourceType(null);
      resetSessionTracking(null, 0);
    } finally {
      setIsLoadingSubListCount(false);
    }
  }, [finalizeSession, loadMemoryTestItems, resetSessionTracking, selectedRootItem]);

  const handleStartFromMemoryKey = React.useCallback(async () => {
    if (!selectedRootItem) {
      setMemoryKeyError('Select a list before starting from a memory key.');
      return;
    }

    const parsedMemoryKey = Number.parseInt(startMemoryKey.trim(), 10);
    if (Number.isNaN(parsedMemoryKey)) {
      setMemoryKeyError('Enter a valid memory key.');
      return;
    }

    setSelectedSubListName('');
    setSelectedSubListChildCount(null);
    void finalizeSession();

    await loadMemoryTestItems({
      listId: selectedRootItem.id,
      rootId: selectedRootItem.id,
      sourceLabel: `${selectedName} (starting from memory key ${parsedMemoryKey})`,
      sourceType: 'root',
      startAtMemoryKey: parsedMemoryKey,
      notFoundMessage: `Memory key ${parsedMemoryKey} was not found in ${selectedName}.`,
    });
  }, [finalizeSession, loadMemoryTestItems, selectedName, selectedRootItem, startMemoryKey]);

  const handleNextMemoryItem = React.useCallback(() => {
    setCurrentTestIndex((previous) => {
      if (previous >= memoryTestItems.length - 1) return previous;
      return previous + 1;
    });
    setShowMemoryName(false);
    setTestSaveError('');
  }, [memoryTestItems.length]);

  const handlePreviousMemoryItem = React.useCallback(() => {
    setCurrentTestIndex((previous) => {
      if (previous <= 0) return previous;
      return previous - 1;
    });
    setShowMemoryName(false);
    setTestSaveError('');
  }, []);

  const handleRecordAnswer = React.useCallback(
    async (wasCorrect: boolean) => {
      if (!memoryTestItem || !activeTestListId || isSavingAnswer) {
        return;
      }

      if (sessionStatsRef.current.answeredItemIds.has(memoryTestItem.id)) {
        setTestSaveError('This memory item was already recorded in the current session.');
        return;
      }

      setIsSavingAnswer(true);
      setTestSaveError('');

      try {
        const answeredAt = new Date().toISOString();
        let sessionId = activeSessionIdRef.current;

        if (!sessionId) {
          const session = await createMemoryTestSession({
            memoryListId: activeTestListId,
            totalItems: sessionStatsRef.current.totalItems,
            startedAt: answeredAt,
          });
          sessionId = session.id;
          activeSessionIdRef.current = session.id;
          setActiveSessionId(session.id);
        }

        await recordMemoryTestResult({
          sessionId,
          memoryItemId: memoryTestItem.id,
          wasCorrect,
          answeredAt,
        });

        sessionStatsRef.current.answeredItemIds.add(memoryTestItem.id);
        if (wasCorrect) {
          sessionStatsRef.current.correctCount += 1;
        } else {
          sessionStatsRef.current.incorrectCount += 1;
        }

        await updateMemoryTestSessionProgress({
          sessionId,
          totalItems: sessionStatsRef.current.totalItems,
          correctCount: sessionStatsRef.current.correctCount,
          incorrectCount: sessionStatsRef.current.incorrectCount,
        });

        const isLastItem = currentTestIndex >= memoryTestItems.length - 1;

        if (isLastItem) {
          setShowMemoryName(false);
          setCurrentTestIndex(memoryTestItems.length);
          await finalizeSession({ showSummary: true, completedAt: answeredAt });
        } else {
          setCurrentTestIndex((previous) => previous + 1);
          setShowMemoryName(false);
        }
      } catch (error: any) {
        const isDuplicate = error?.code === '23505';
        setTestSaveError(
          isDuplicate
            ? 'That result was already saved for this session.'
            : 'Could not save the test result. Please try again.',
        );
      } finally {
        setIsSavingAnswer(false);
      }
    },
    [activeTestListId, currentTestIndex, finalizeSession, isSavingAnswer, memoryTestItem, memoryTestItems.length],
  );

  return (
    <Box sx={{ p: { xs: 1, sm: 3 } }}>
      <Paper sx={{ p: { xs: 1.5, sm: 3 }, maxWidth: 900 }}>
        <Stack spacing={2}>
          <Typography variant="h5">List Tester</Typography>
          <Tabs
            value={activeTab}
            onChange={(_event, nextValue) => setActiveTab(nextValue)}
            variant="fullWidth"
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                minHeight: { xs: 40, sm: 48 },
                px: { xs: 1, sm: 2 },
              },
            }}
          >
            <Tab id="list-tester-tab-0" aria-controls="list-tester-tabpanel-0" label="Select List" />
            <Tab id="list-tester-tab-1" aria-controls="list-tester-tabpanel-1" label="Section" disabled={!selectedName} />
            <Tab id="list-tester-tab-2" aria-controls="list-tester-tabpanel-2" label="Memory Test" disabled={!selectedName} />
          </Tabs>

          {searchError ? <Alert severity="error">{searchError}</Alert> : null}

          <TabPanel value={activeTab} index={0}>
            <Stack spacing={2}>
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
            </Stack>
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            {selectedName ? (
              <Stack spacing={2}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1">Selected List: {selectedName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {isLoadingCount
                      ? 'Loading child count...'
                      : `Children items count: ${selectedChildCount ?? 0}`}
                  </Typography>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2 }}>
                    <TextField
                      label="Start From Memory Key"
                      value={startMemoryKey}
                      onChange={(event) => {
                        setStartMemoryKey(event.target.value);
                        setMemoryKeyError('');
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          handleStartFromMemoryKey();
                        }
                      }}
                      error={Boolean(memoryKeyError)}
                      helperText={memoryKeyError || 'Load the main list and begin at a specific memory key.'}
                      fullWidth
                    />
                    <Button variant="contained" onClick={handleStartFromMemoryKey}>
                      Start Test
                    </Button>
                  </Stack>
                </Paper>

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
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Select a list first.
              </Typography>
            )}
          </TabPanel>

          <TabPanel value={activeTab} index={2}>
            {selectedName && activeTestSourceType ? (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h6">Memory Test Form</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {activeTestSourceType === 'sublist'
                    ? `Path: ${selectedName} / ${activeTestSourceLabel}`
                    : `Path: ${activeTestSourceLabel}`}
                </Typography>

                {activeSessionId ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Active session #{activeSessionId}
                  </Typography>
                ) : null}

                {testSaveError ? <Alert severity="error" sx={{ mb: 2 }}>{testSaveError}</Alert> : null}

                {testSummary ? (
                  <Alert severity="success" sx={{ mb: 2 }}>
                    Session complete. Correct: {testSummary.correctCount} | Incorrect: {testSummary.incorrectCount} |
                    Total: {testSummary.totalItems}
                  </Alert>
                ) : null}

                {isLoadingMemoryTestItem ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={20} />
                    <Typography variant="body2">Loading first item...</Typography>
                  </Box>
                ) : null}

                {!isLoadingMemoryTestItem && !memoryTestItem && !hasCompletedTest ? (
                  <Typography variant="body2" color="text.secondary">
                    {activeTestSourceType === 'sublist'
                      ? 'No child items were found in this sub list.'
                      : 'No child items were found in this list.'}
                  </Typography>
                ) : null}

                {!isLoadingMemoryTestItem && hasCompletedTest ? (
                  <Typography variant="body2" color="text.secondary">
                    All items in this test session have been recorded.
                  </Typography>
                ) : null}

                {!isLoadingMemoryTestItem && memoryTestItem ? (
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <IconButton
                        aria-label="Previous memory item"
                        onClick={handlePreviousMemoryItem}
                        disabled={currentTestIndex <= 0 || isSavingAnswer}
                      >
                        <ArrowBackIcon />
                      </IconButton>
                      <IconButton
                        aria-label="Next memory item"
                        onClick={handleNextMemoryItem}
                        disabled={currentTestIndex >= memoryTestItems.length - 1 || isSavingAnswer}
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

                    <Stack direction="row" spacing={1} sx={{ alignSelf: 'flex-start', flexWrap: 'wrap' }}>
                     
                      <Button
                        variant="outlined"
                        onClick={() => setShowMemoryName((previous) => !previous)}
                        disabled={isSavingAnswer}
                      >
                        {showMemoryName ? 'Hide Name' : 'Show Name'}
                      </Button>
                       <Button
                        variant="outlined"
                        onClick={handleOpenMemoryImage}
                        disabled={isSavingAnswer}
                      >
                        Show Image
                      </Button>
                    </Stack>

                    {showMemoryName ? (
                      <Stack spacing={1.5}>
                        <TextField
                          label="Name"
                          value={memoryTestItem.name ?? 'Unnamed'}
                          InputProps={{ readOnly: true }}
                          fullWidth
                        />
                        {currentItemAlreadyRecorded ? (
                          <Alert severity="info">
                            This item has already been recorded for the current session.
                          </Alert>
                        ) : null}
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                          <Button
                            variant="contained"
                            color="success"
                            startIcon={isSavingAnswer ? <CircularProgress size={16} color="inherit" /> : <CheckIcon />}
                            onClick={() => handleRecordAnswer(true)}
                            disabled={isSavingAnswer || currentItemAlreadyRecorded}
                          >
                            Tick
                          </Button>
                          <Button
                            variant="contained"
                            color="error"
                            startIcon={isSavingAnswer ? <CircularProgress size={16} color="inherit" /> : <CloseIcon />}
                            onClick={() => handleRecordAnswer(false)}
                            disabled={isSavingAnswer || currentItemAlreadyRecorded}
                          >
                            X
                          </Button>
                        </Stack>
                      </Stack>
                    ) : null}
                  </Stack>
                ) : null}
              </Paper>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Choose a list section to start the test.
              </Typography>
            )}
          </TabPanel>
        </Stack>
      </Paper>
      <Dialog
        open={showMemoryImage}
        onClose={() => {
          setShowMemoryImage(false);
          setPreviewMemoryImageError('');
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogContent sx={{ position: 'relative', p: { xs: 1.5, sm: 2 } }}>
          <IconButton
            aria-label="Close image preview"
            onClick={() => {
              setShowMemoryImage(false);
              setPreviewMemoryImageError('');
            }}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 1,
              bgcolor: 'background.paper',
              boxShadow: 1,
              '&:hover': {
                bgcolor: 'background.paper',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
          {isLoadingPreviewMemoryImage ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
              <CircularProgress size={24} />
            </Box>
          ) : null}
          {!isLoadingPreviewMemoryImage && previewMemoryImageError ? (
            <Alert severity="info" sx={{ mt: 4 }}>
              {previewMemoryImageError}
            </Alert>
          ) : null}
          {!isLoadingPreviewMemoryImage && previewMemoryImage ? (
            <Box
              sx={{
                mt: 4,
                p: { xs: 1.5, sm: 2 },
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'background.paper',
              }}
            >
              <Typography
                variant="body1"
                sx={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {previewMemoryImage}
              </Typography>
            </Box>
          ) : null}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
