'use client';

import * as React from 'react';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
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
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  createTimeTrackingSession,
  deleteTimeTrackingSession,
  fetchMemoryItemOptions,
  fetchTimeTrackingSessions,
  formatDuration,
  formatThresholdMinutes,
  getDateBucketTotals,
  getElapsedDurationSeconds,
  getSessionDurationSeconds,
  updateTimeTrackingSession,
} from '@/app/lib/timeTracker';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All sessions' },
  { value: 'active', label: 'Active only' },
  { value: 'completed', label: 'Completed only' },
];

function getTodayDateInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateTimeLocalInputValue(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function createSessionDraft(memoryItem = null) {
  const now = new Date();
  return {
    memoryItem,
    title: '',
    notes: '',
    startedAt: getDateTimeLocalInputValue(now),
    endedAt: getDateTimeLocalInputValue(now),
    alertThresholdMinutes: '',
    stopReason: 'manual-entry',
  };
}

function createDraftFromSession(session) {
  return {
    memoryItem: session?.memory_item_id
      ? {
          id: Number(session.memory_item_id),
          name: session.memory_item_name || `Memory item ${session.memory_item_id}`,
        }
      : null,
    title: session?.title || '',
    notes: session?.notes || '',
    startedAt: getDateTimeLocalInputValue(session?.started_at),
    endedAt: session?.ended_at ? getDateTimeLocalInputValue(session.ended_at) : '',
    alertThresholdMinutes: session?.alert_threshold_minutes ?? '',
    stopReason: session?.stop_reason || '',
  };
}

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
  const todayDate = React.useMemo(() => getTodayDateInputValue(), []);
  const [filters, setFilters] = React.useState({
    memoryItem: null,
    startDate: todayDate,
    endDate: todayDate,
    status: 'all',
  });
  const [memoryItemOptions, setMemoryItemOptions] = React.useState([]);
  const [memoryItemLoading, setMemoryItemLoading] = React.useState(false);
  const [sessions, setSessions] = React.useState([]);
  const [summarySessions, setSummarySessions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [successMessage, setSuccessMessage] = React.useState('');
  const [sessionToDelete, setSessionToDelete] = React.useState(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [editorMode, setEditorMode] = React.useState('create');
  const [editingSession, setEditingSession] = React.useState(null);
  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const [isSavingSession, setIsSavingSession] = React.useState(false);
  const [sessionDraft, setSessionDraft] = React.useState(() => createSessionDraft());

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
      const [nextSessions, nextSummarySessions] = await Promise.all([
        fetchTimeTrackingSessions({
          memoryItemId: filters.memoryItem?.id ?? null,
          startDate: filters.startDate,
          endDate: filters.endDate,
          status: filters.status,
        }),
        fetchTimeTrackingSessions({
          memoryItemId: filters.memoryItem?.id ?? null,
          status: filters.status,
        }),
      ]);
      setSessions(nextSessions);
      setSummarySessions(nextSummarySessions);
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

  const handleDeleteSession = React.useCallback(async () => {
    if (!sessionToDelete?.id) {
      return;
    }

    setIsDeleting(true);
    setError('');
    setSuccessMessage('');

    try {
      await deleteTimeTrackingSession(sessionToDelete.id);
      setSessions((currentSessions) => currentSessions.filter((session) => session.id !== sessionToDelete.id));
      setSummarySessions((currentSessions) => currentSessions.filter((session) => session.id !== sessionToDelete.id));
      setSuccessMessage('Time session deleted.');
      setSessionToDelete(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete time session.');
    } finally {
      setIsDeleting(false);
    }
  }, [sessionToDelete]);

  const totals = React.useMemo(() => getDateBucketTotals(summarySessions), [summarySessions]);

  const handleSessionClick = React.useCallback((session) => {
    setError('');
    setSuccessMessage('');
    setFilters((current) => ({
      ...current,
      memoryItem: session?.memory_item_id
        ? {
            id: Number(session.memory_item_id),
            name: session.memory_item_name || `Memory item ${session.memory_item_id}`,
          }
        : null,
    }));
  }, []);

  const handleDraftChange = React.useCallback((field, value) => {
    setSessionDraft((current) => ({ ...current, [field]: value }));
  }, []);

  const handleOpenCreateDialog = React.useCallback(() => {
    setError('');
    setSuccessMessage('');
    setEditorMode('create');
    setEditingSession(null);
    setSessionDraft(createSessionDraft(filters.memoryItem));
    setIsEditorOpen(true);
  }, [filters.memoryItem]);

  const handleOpenEditDialog = React.useCallback((session) => {
    setError('');
    setSuccessMessage('');
    setEditorMode('edit');
    setEditingSession(session);
    setSessionDraft(createDraftFromSession(session));
    setIsEditorOpen(true);
  }, []);

  const handleCloseEditor = React.useCallback(() => {
    if (isSavingSession) {
      return;
    }

    setIsEditorOpen(false);
    setEditingSession(null);
  }, [isSavingSession]);

  const handleSaveSession = React.useCallback(async () => {
    const startedAt = sessionDraft.startedAt ? new Date(sessionDraft.startedAt) : null;
    const endedAt = sessionDraft.endedAt ? new Date(sessionDraft.endedAt) : null;

    if (!startedAt || Number.isNaN(startedAt.getTime())) {
      setError('A valid start date and time is required.');
      return;
    }

    if (!editingSession?.is_running) {
      if (!endedAt || Number.isNaN(endedAt.getTime())) {
        setError('A valid end date and time is required.');
        return;
      }

      if (endedAt.getTime() < startedAt.getTime()) {
        setError('End date and time must be after the start date and time.');
        return;
      }
    }

    setIsSavingSession(true);
    setError('');
    setSuccessMessage('');

    try {
      if (editorMode === 'create') {
        await createTimeTrackingSession({
          memoryItemId: sessionDraft.memoryItem?.id ?? null,
          title: sessionDraft.title,
          notes: sessionDraft.notes,
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          alertThresholdMinutes: sessionDraft.alertThresholdMinutes,
          stopReason: sessionDraft.stopReason,
        });
        setSuccessMessage('Time session added.');
      } else if (editingSession?.id) {
        const updatePayload = {
          memory_item_id: sessionDraft.memoryItem?.id ?? null,
          title: sessionDraft.title,
          notes: sessionDraft.notes,
          started_at: startedAt.toISOString(),
          alert_threshold_minutes: sessionDraft.alertThresholdMinutes,
        };

        if (editingSession.is_running) {
          updatePayload.ended_at = null;
          updatePayload.stop_reason = null;
          updatePayload.duration_seconds = null;
          updatePayload.is_running = true;
        } else {
          updatePayload.ended_at = endedAt.toISOString();
          updatePayload.stop_reason = sessionDraft.stopReason;
          updatePayload.is_running = false;
          updatePayload.duration_seconds = getElapsedDurationSeconds(startedAt.toISOString(), endedAt.toISOString());
        }

        await updateTimeTrackingSession(editingSession.id, updatePayload);
        setSuccessMessage('Time session updated.');
      }

      setIsEditorOpen(false);
      setEditingSession(null);
      await loadSessions();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save time session.');
    } finally {
      setIsSavingSession(false);
    }
  }, [editingSession, editorMode, loadSessions, sessionDraft]);

  const editorMemoryItemValue = sessionDraft.memoryItem;

  return (
    <Stack spacing={3} sx={{ p: 3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box>
          <Typography variant="h4">Time Sessions</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            Review active and completed tracked sessions linked to your memory items.
          </Typography>
        </Box>

        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreateDialog}>
          Add session
        </Button>
      </Box>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard label="Total today" value={formatDuration(totals.today)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard label="Total this week" value={formatDuration(totals.thisWeek)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard label="Total this month" value={formatDuration(totals.thisMonth)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard label="Total all time" value={formatDuration(totals.allTime)} />
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
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10}>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ py: 4 }}>
                    <CircularProgress size={22} />
                    <Typography>Loading sessions...</Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            ) : sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10}>
                  <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                    No sessions found for the current filters.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((session) => (
                <TableRow
                  key={session.id}
                  hover
                  onClick={() => handleSessionClick(session)}
                  sx={{ cursor: 'pointer' }}
                >
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
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title="Edit session">
                        <span>
                          <IconButton
                            color="primary"
                            size="small"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleOpenEditDialog(session);
                            }}
                            aria-label={`Edit time session ${session.id}`}
                          >
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={session.is_running ? 'Stop the running session before deleting it.' : 'Delete session'}>
                        <span>
                          <IconButton
                            color="error"
                            size="small"
                            disabled={session.is_running || isDeleting}
                            onClick={(event) => {
                              event.stopPropagation();
                              setError('');
                              setSuccessMessage('');
                              setSessionToDelete(session);
                            }}
                            aria-label={`Delete time session ${session.id}`}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={isEditorOpen} onClose={handleCloseEditor} maxWidth="sm" fullWidth>
        <DialogTitle>{editorMode === 'create' ? 'Add time session' : 'Edit time session'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Autocomplete
              options={memoryItemOptions}
              value={editorMemoryItemValue}
              loading={memoryItemLoading}
              onOpen={() => loadMemoryItems()}
              onInputChange={(_event, value, reason) => {
                if (reason === 'input') {
                  loadMemoryItems(value);
                }
              }}
              onChange={(_event, value) => handleDraftChange('memoryItem', value)}
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
                <TextField {...params} label="Linked memory item" placeholder="Search memory items" />
              )}
            />

            <TextField
              label="Title"
              value={sessionDraft.title}
              onChange={(event) => handleDraftChange('title', event.target.value)}
              fullWidth
            />

            <TextField
              label="Notes"
              value={sessionDraft.notes}
              onChange={(event) => handleDraftChange('notes', event.target.value)}
              minRows={4}
              multiline
              fullWidth
            />

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Started"
                  type="datetime-local"
                  value={sessionDraft.startedAt}
                  onChange={(event) => handleDraftChange('startedAt', event.target.value)}
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Ended"
                  type="datetime-local"
                  value={sessionDraft.endedAt}
                  onChange={(event) => handleDraftChange('endedAt', event.target.value)}
                  fullWidth
                  disabled={Boolean(editingSession?.is_running)}
                  helperText={editingSession?.is_running ? 'Running sessions do not have an end time yet.' : 'Required for manual sessions.'}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Alert threshold (minutes)"
                  type="number"
                  value={sessionDraft.alertThresholdMinutes}
                  onChange={(event) => handleDraftChange('alertThresholdMinutes', event.target.value)}
                  inputProps={{ min: 1 }}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Stop reason"
                  value={sessionDraft.stopReason}
                  onChange={(event) => handleDraftChange('stopReason', event.target.value)}
                  fullWidth
                  disabled={Boolean(editingSession?.is_running)}
                  helperText={editingSession?.is_running ? 'Stop reason is set when the running session ends.' : ''}
                />
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditor} disabled={isSavingSession}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveSession} disabled={isSavingSession}>
            {isSavingSession ? 'Saving...' : editorMode === 'create' ? 'Add session' : 'Save changes'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(sessionToDelete)} onClose={() => (isDeleting ? null : setSessionToDelete(null))} maxWidth="xs" fullWidth>
        <DialogTitle>Delete time session?</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1}>
            <Typography>
              This will permanently remove the selected time session.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {sessionToDelete?.memory_item_name || 'Unlinked'}
              {sessionToDelete?.title ? ` | ${sessionToDelete.title}` : ''}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSessionToDelete(null)} disabled={isDeleting}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteSession} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}