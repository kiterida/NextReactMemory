'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import {
  fetchMemoryItemOptions,
  fetchTimeTrackingSessions,
  formatDuration,
  formatThresholdMinutes,
  getDateBucketTotals,
  getSessionDurationSeconds,
} from '@/app/lib/timeTracker';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All sessions' },
  { value: 'active', label: 'Active only' },
  { value: 'completed', label: 'Completed only' },
];

function SummaryCard({ label, value }) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h4" sx={{ mt: 1 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function TimeSessionsPage() {
  const [filters, setFilters] = React.useState({
    memoryItem: null,
    startDate: '',
    endDate: '',
    status: 'all',
  });
  const [memoryItemOptions, setMemoryItemOptions] = React.useState([]);
  const [memoryItemLoading, setMemoryItemLoading] = React.useState(false);
  const [sessions, setSessions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const loadMemoryItems = React.useCallback(async (searchTerm = '') => {
    setMemoryItemLoading(true);

    try {
      const options = await fetchMemoryItemOptions(searchTerm);
      setMemoryItemOptions(options);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load memory items.');
    } finally {
      setMemoryItemLoading(false);
    }
  }, []);

  const loadSessions = React.useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const nextSessions = await fetchTimeTrackingSessions({
        memoryItemId: filters.memoryItem?.id ?? null,
        startDate: filters.startDate,
        endDate: filters.endDate,
        status: filters.status,
      });
      setSessions(nextSessions);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load sessions.');
    } finally {
      setLoading(false);
    }
  }, [filters.endDate, filters.memoryItem, filters.startDate, filters.status]);

  React.useEffect(() => {
    void loadMemoryItems();
  }, [loadMemoryItems]);

  React.useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const totals = React.useMemo(() => getDateBucketTotals(sessions), [sessions]);

  return (
    <Stack spacing={3} sx={{ p: 3 }}>
      <Box>
        <Typography variant="h4">Time Sessions</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
          Review active and completed tracked sessions linked to your memory items.
        </Typography>
      </Box>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <SummaryCard label="Total today" value={formatDuration(totals.today)} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SummaryCard label="Total this week" value={formatDuration(totals.thisWeek)} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SummaryCard label="Total this month" value={formatDuration(totals.thisMonth)} />
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Autocomplete
              options={memoryItemOptions}
              value={filters.memoryItem}
              loading={memoryItemLoading}
              onOpen={() => loadMemoryItems()}
              onInputChange={(_event, value, reason) => {
                if (reason === 'input') {
                  loadMemoryItems(value);
                }
              }}
              onChange={(_event, value) => setFilters((current) => ({ ...current, memoryItem: value }))}
              getOptionLabel={(option) => option?.name || `Memory item ${option?.id ?? ''}`}
              isOptionEqualToValue={(option, value) => Number(option.id) === Number(value.id)}
              renderOption={(props, option) => {
                const { key, ...optionProps } = props;
                return (
                  <li {...optionProps} key={option.id}>
                    {option?.name || `Memory item ${option?.id ?? ''}`}
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField {...params} label="Memory item" placeholder="Filter by memory item" />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              label="Start date"
              type="date"
              value={filters.startDate}
              onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              label="End date"
              type="date"
              value={filters.endDate}
              onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField
              select
              label="Status"
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              fullWidth
            >
              {STATUS_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Memory item</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Started</TableCell>
              <TableCell>Ended</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Alert threshold</TableCell>
              <TableCell>Alert triggered</TableCell>
              <TableCell>Stop reason</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9}>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ py: 4 }}>
                    <CircularProgress size={22} />
                    <Typography>Loading sessions...</Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            ) : sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9}>
                  <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                    No sessions found for the current filters.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((session) => (
                <TableRow key={session.id} hover>
                  <TableCell>{new Date(session.started_at).toLocaleDateString()}</TableCell>
                  <TableCell>{session.memory_item_name || 'Unlinked'}</TableCell>
                  <TableCell>{session.title || '-'}</TableCell>
                  <TableCell>{new Date(session.started_at).toLocaleString()}</TableCell>
                  <TableCell>{session.ended_at ? new Date(session.ended_at).toLocaleString() : 'Running'}</TableCell>
                  <TableCell>{formatDuration(getSessionDurationSeconds(session))}</TableCell>
                  <TableCell>{formatThresholdMinutes(session.alert_threshold_minutes)}</TableCell>
                  <TableCell>
                    {session.alert_triggered
                      ? session.alert_triggered_at
                        ? new Date(session.alert_triggered_at).toLocaleString()
                        : 'Yes'
                      : 'No'}
                  </TableCell>
                  <TableCell>{session.stop_reason || (session.is_running ? 'running' : '-')}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}
