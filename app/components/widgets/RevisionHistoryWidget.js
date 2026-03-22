'use client';

import * as React from 'react';
import Link from 'next/link';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import MuiLink from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  getLastRevisedDate,
  getListAccuracy,
  getListRevisionHistory,
} from '@/app/components/memoryTestHistory';
import { fetchMemoryItemById } from './widgetQueries';

function formatDateTime(value) {
  if (!value) {
    return 'Not revised yet';
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch (_error) {
    return String(value);
  }
}

function formatPercent(value) {
  if (value === null || value === undefined) {
    return 'No data';
  }

  return `${Math.round(value * 100)}%`;
}

function summarizeResults(results) {
  const answeredCount = results?.length ?? 0;
  const correctCount = (results ?? []).reduce((count, result) => count + (result?.was_correct ? 1 : 0), 0);
  const incorrectCount = answeredCount - correctCount;

  return {
    answeredCount,
    correctCount,
    incorrectCount,
    accuracy: answeredCount > 0 ? correctCount / answeredCount : null,
  };
}

export default function RevisionHistoryWidget({ widget }) {
  const memoryItemId = Number(widget?.config?.memoryItemId ?? 0);
  const sessionLimit = Math.max(1, Math.min(20, Number(widget?.config?.maxSessions ?? 5) || 5));
  const [memoryItem, setMemoryItem] = React.useState(null);
  const [history, setHistory] = React.useState([]);
  const [summary, setSummary] = React.useState({
    lastRevisedDate: null,
    accuracy: null,
    totalAnswers: 0,
    correctCount: 0,
    incorrectCount: 0,
  });
  const [loading, setLoading] = React.useState(Boolean(memoryItemId));
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let ignore = false;

    async function loadRevisionHistory() {
      if (!memoryItemId) {
        setMemoryItem(null);
        setHistory([]);
        setSummary({
          lastRevisedDate: null,
          accuracy: null,
          totalAnswers: 0,
          correctCount: 0,
          incorrectCount: 0,
        });
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const [memoryItemData, lastRevisedDate, accuracySummary, historyData] = await Promise.all([
          fetchMemoryItemById(memoryItemId),
          getLastRevisedDate(memoryItemId),
          getListAccuracy(memoryItemId),
          getListRevisionHistory(memoryItemId, { limit: sessionLimit }),
        ]);

        if (!ignore) {
          setMemoryItem(memoryItemData);
          setHistory(historyData);
          const derivedTotals = historyData.reduce(
            (totals, session) => {
              const sessionSummary = summarizeResults(session.results);
              totals.totalAnswers += sessionSummary.answeredCount;
              totals.correctCount += sessionSummary.correctCount;
              totals.incorrectCount += sessionSummary.incorrectCount;
              return totals;
            },
            {
              totalAnswers: 0,
              correctCount: 0,
              incorrectCount: 0,
            },
          );

          setSummary({
            lastRevisedDate,
            accuracy: accuracySummary.totalAnswers > 0
              ? accuracySummary.accuracy
              : derivedTotals.totalAnswers > 0
                ? derivedTotals.correctCount / derivedTotals.totalAnswers
                : null,
            totalAnswers: accuracySummary.totalAnswers > 0 ? accuracySummary.totalAnswers : derivedTotals.totalAnswers,
            correctCount: accuracySummary.totalAnswers > 0 ? accuracySummary.correctCount : derivedTotals.correctCount,
            incorrectCount: accuracySummary.totalAnswers > 0 ? accuracySummary.incorrectCount : derivedTotals.incorrectCount,
          });
        }
      } catch (fetchError) {
        if (!ignore) {
          setError(fetchError.message || 'Unable to load revision history.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadRevisionHistory();

    return () => {
      ignore = true;
    };
  }, [memoryItemId, sessionLimit]);

  return (
    <Stack spacing={1.5}>
      {loading ? <CircularProgress size={24} /> : null}

      {!loading && error ? <Alert severity="error">{error}</Alert> : null}

      {!loading && !error && !memoryItemId ? (
        <Alert severity="info">Choose a memory list in this widget&apos;s configuration.</Alert>
      ) : null}

      {!loading && !error && memoryItemId && !memoryItem ? (
        <Alert severity="warning">The selected memory list could not be found.</Alert>
      ) : null}

      {!loading && !error && memoryItem ? (
        <Stack spacing={1.5}>
          <Stack spacing={0.5}>
            <MuiLink
              component={Link}
              href={`/singleListView?listId=${memoryItem.id}`}
              underline="hover"
              sx={{ width: 'fit-content', fontWeight: 600, fontSize: '1rem' }}
            >
              {memoryItem.name || 'Untitled memory list'}
            </MuiLink>
            <Typography variant="body2" color="text.secondary">
              List ID: {memoryItem.id}
            </Typography>
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
              gap: 1,
            }}
          >
            <Box sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">
                Last Revised
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {formatDateTime(summary.lastRevisedDate)}
              </Typography>
            </Box>
            <Box sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">
                Overall Accuracy
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {formatPercent(summary.accuracy)}
              </Typography>
            </Box>
            <Box sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">
                Total Answers
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {summary.totalAnswers}
              </Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip label={`Correct ${summary.correctCount}`} color="success" variant="outlined" size="small" />
            <Chip label={`Incorrect ${summary.incorrectCount}`} color="error" variant="outlined" size="small" />
            <Chip label={`Sessions ${history.length}`} variant="outlined" size="small" />
          </Stack>

          {history.length === 0 ? (
            <Alert severity="info">No revision sessions have been recorded for this list yet.</Alert>
          ) : (
            <List dense disablePadding>
              {history.map((session, index) => {
                const sessionSummary = summarizeResults(session.results);

                return (
                  <React.Fragment key={session.id}>
                    <ListItem disableGutters alignItems="flex-start" sx={{ display: 'block', py: 1 }}>
                      <Stack spacing={1}>
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={1}
                          justifyContent="space-between"
                          alignItems={{ xs: 'flex-start', sm: 'center' }}
                        >
                          <Typography variant="subtitle2">
                            {formatDateTime(session.completed_at || session.started_at)}
                          </Typography>
                          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                            <Chip label={`${sessionSummary.correctCount} correct`} color="success" size="small" />
                            <Chip label={`${sessionSummary.incorrectCount} incorrect`} color="error" size="small" />
                            <Chip label={formatPercent(sessionSummary.accuracy)} size="small" variant="outlined" />
                          </Stack>
                        </Stack>

                        <Typography variant="body2" color="text.secondary">
                          Answered {sessionSummary.answeredCount} of {session.total_items} items
                        </Typography>
                      </Stack>
                    </ListItem>
                    {index < history.length - 1 ? <Divider component="li" /> : null}
                  </React.Fragment>
                );
              })}
            </List>
          )}
        </Stack>
      ) : null}
    </Stack>
  );
}
