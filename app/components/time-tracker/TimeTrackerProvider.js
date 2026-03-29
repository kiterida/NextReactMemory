'use client';

import * as React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import {
  DEFAULT_TIME_TRACKING_ALERT_THRESHOLD_MINUTES,
  TIME_TRACKING_ACTIVITY_SYNC_MS,
  fetchMemoryItemOptions,
  fetchTimeTrackingSessionById,
  formatDuration,
  getAlertThresholdSeconds,
  getSessionDurationSeconds,
  isSessionOverThreshold,
  startTimeTrackingSession,
  stopTimeTrackingSession,
  updateTimeTrackingSession,
} from '@/app/lib/timeTracker';
import { playTimeTrackerAlertSound, prepareTimeTrackerAlertSound } from '@/app/lib/timeTrackerAudio';
import { fetchMemoryItemById } from '@/app/components/memoryData';
import { TimeTrackerContext } from './TimeTrackerContext';
import TimeTrackerDialog from './TimeTrackerDialog';
import MinimizedTimeTracker from './MinimizedTimeTracker';

const STORAGE_KEY = 'memory-core.time-tracker';

const createDefaultDraft = () => ({
  memoryItemId: null,
  memoryItemName: '',
  title: '',
  notes: '',
  alertEnabled: false,
  alertThresholdMinutes: DEFAULT_TIME_TRACKING_ALERT_THRESHOLD_MINUTES,
});

export default function TimeTrackerProvider({ children }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const singleListViewId = searchParams.get('listId');
  const [activeSession, setActiveSession] = React.useState(null);
  const [draft, setDraft] = React.useState(createDefaultDraft);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [minimized, setMinimized] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [elapsedNowSeconds, setElapsedNowSeconds] = React.useState(0);
  const [memoryItemOptions, setMemoryItemOptions] = React.useState([]);
  const [memoryItemOptionsLoading, setMemoryItemOptionsLoading] = React.useState(false);
  const [snackbarState, setSnackbarState] = React.useState({
    open: false,
    severity: 'success',
    message: '',
  });

  const hydrationCompleteRef = React.useRef(false);
  const saveDraftTimeoutRef = React.useRef(null);
  const lastActivityAtRef = React.useRef(Date.now());
  const lastActivitySyncedAtRef = React.useRef(0);
  const activeSessionRef = React.useRef(null);
  const draftRef = React.useRef(createDefaultDraft());
  const alertTriggerInFlightRef = React.useRef(null);
  const titleBaseRef = React.useRef('');

  const showSnackbar = React.useCallback((message, severity = 'success') => {
    setSnackbarState({ open: true, severity, message });
  }, []);

  const syncLastActivity = React.useCallback(async (force = false) => {
    const session = activeSessionRef.current;
    if (!session?.id) {
      return;
    }

    const now = Date.now();
    if (!force && now - lastActivitySyncedAtRef.current < TIME_TRACKING_ACTIVITY_SYNC_MS) {
      return;
    }

    lastActivitySyncedAtRef.current = now;

    try {
      const updatedSession = await updateTimeTrackingSession(session.id, {
        last_activity_at: new Date(now).toISOString(),
      });
      setActiveSession(updatedSession);
    } catch (syncError) {
      console.error(syncError);
    }
  }, []);

  const triggerDurationAlert = React.useCallback(async (session) => {
    if (!session?.id || session.alert_triggered || alertTriggerInFlightRef.current === session.id) {
      return;
    }

    alertTriggerInFlightRef.current = session.id;
    const triggeredAt = new Date().toISOString();

    try {
      const updatedSession = await updateTimeTrackingSession(session.id, {
        alert_triggered: true,
        alert_triggered_at: triggeredAt,
      });
      setActiveSession(updatedSession);
    } catch (alertError) {
      console.error(alertError);
    } finally {
      const played = await playTimeTrackerAlertSound();
      showSnackbar(
        played
          ? `Session reached ${session.alert_threshold_minutes} minutes.`
          : `Session reached ${session.alert_threshold_minutes} minutes, but the alert sound could not be played.`,
        'warning'
      );
      alertTriggerInFlightRef.current = null;
    }
  }, [showSnackbar]);

  const markActivity = React.useCallback(() => {
    if (!activeSessionRef.current) {
      return;
    }

    lastActivityAtRef.current = Date.now();
    void prepareTimeTrackerAlertSound({ unlock: true });
    void syncLastActivity(false);
  }, [syncLastActivity]);

  const loadMemoryItemOptions = React.useCallback(async (searchTerm = '') => {
    setMemoryItemOptionsLoading(true);

    try {
      const options = await fetchMemoryItemOptions(searchTerm);
      setMemoryItemOptions(options);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load memory items.');
    } finally {
      setMemoryItemOptionsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    activeSessionRef.current = activeSession;
    if (!activeSession) {
      lastActivitySyncedAtRef.current = 0;
      alertTriggerInFlightRef.current = null;
    }
  }, [activeSession]);

  React.useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  React.useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    if (!activeSession?.is_running) {
      if (titleBaseRef.current) {
        document.title = titleBaseRef.current;
      } else {
        titleBaseRef.current = document.title;
      }
      return undefined;
    }

    if (!titleBaseRef.current) {
      titleBaseRef.current = document.title;
    }

    const elapsed = formatDuration(elapsedNowSeconds);
    const overduePrefix = isSessionOverThreshold(activeSession, elapsedNowSeconds) ? 'Overdue ' : '';
    const nextTitle = `${overduePrefix}${elapsed} | ${titleBaseRef.current}`;
    const applyTitle = () => {
      if (document.title !== nextTitle) {
        document.title = nextTitle;
      }
    };

    applyTitle();

    const observer = new MutationObserver(() => {
      applyTitle();
    });

    observer.observe(document.head, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [activeSession, elapsedNowSeconds, pathname]);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let cancelled = false;
    const restore = async () => {
      const storedRaw = window.localStorage.getItem(STORAGE_KEY);
      if (!storedRaw) {
        hydrationCompleteRef.current = true;
        return;
      }

      try {
        const stored = JSON.parse(storedRaw);
        setDraft({
          ...createDefaultDraft(),
          ...(stored.draft ?? {}),
        });
        setIsDialogOpen(Boolean(stored.isDialogOpen));
        setMinimized(Boolean(stored.minimized));

        if (stored.activeSessionId) {
          const restoredSession = await fetchTimeTrackingSessionById(stored.activeSessionId);
          if (!cancelled && restoredSession?.is_running) {
            setActiveSession(restoredSession);
          }
        }
      } catch (restoreError) {
        console.error(restoreError);
      } finally {
        if (!cancelled) {
          hydrationCompleteRef.current = true;
        }
      }
    };

    void restore();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!hydrationCompleteRef.current || typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        activeSessionId: activeSession?.id ?? null,
        draft,
        isDialogOpen,
        minimized,
      })
    );
  }, [activeSession, draft, isDialogOpen, minimized]);

  React.useEffect(() => {
    if (!singleListViewId || pathname !== '/singleListView' || activeSessionRef.current) {
      return undefined;
    }

    let cancelled = false;

    const syncSingleListDraft = async () => {
      try {
        const memoryItem = await fetchMemoryItemById(singleListViewId);
        if (!memoryItem || cancelled) {
          return;
        }

        setDraft((currentDraft) => {
          if (
            Number(currentDraft.memoryItemId) === Number(memoryItem.id) &&
            currentDraft.memoryItemName === (memoryItem.name ?? '')
          ) {
            return currentDraft;
          }

          return {
            ...currentDraft,
            memoryItemId: Number(memoryItem.id),
            memoryItemName: memoryItem.name ?? '',
          };
        });
      } catch (loadError) {
        console.error(loadError);
      }
    };

    void syncSingleListDraft();

    return () => {
      cancelled = true;
    };
  }, [activeSession, pathname, singleListViewId]);

  React.useEffect(() => {
    if (!activeSession?.started_at) {
      setElapsedNowSeconds(0);
      return undefined;
    }

    const updateElapsed = () => {
      const session = activeSessionRef.current;
      const nextElapsedSeconds = getSessionDurationSeconds(session);
      setElapsedNowSeconds(nextElapsedSeconds);

      if (
        session?.is_running &&
        !session?.alert_triggered &&
        getAlertThresholdSeconds(session) !== null &&
        nextElapsedSeconds >= getAlertThresholdSeconds(session)
      ) {
        void triggerDurationAlert(session);
      }
    };

    updateElapsed();

    const intervalId = window.setInterval(updateElapsed, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeSession, triggerDurationAlert]);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    const handleActivity = () => {
      markActivity();
    };

    for (const eventName of activityEvents) {
      window.addEventListener(eventName, handleActivity, { passive: true });
    }

    return () => {
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, handleActivity);
      }
      if (saveDraftTimeoutRef.current) {
        window.clearTimeout(saveDraftTimeoutRef.current);
      }
    };
  }, [markActivity]);

  React.useEffect(() => {
    if (!activeSession?.id) {
      return undefined;
    }

    if (saveDraftTimeoutRef.current) {
      window.clearTimeout(saveDraftTimeoutRef.current);
    }

    saveDraftTimeoutRef.current = window.setTimeout(async () => {
      try {
        const updatedSession = await updateTimeTrackingSession(activeSession.id, {
          memory_item_id: draft.memoryItemId,
          title: draft.title,
          notes: draft.notes,
        });
        setActiveSession(updatedSession);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Failed to save session changes.');
      }
    }, 500);

    return () => {
      if (saveDraftTimeoutRef.current) {
        window.clearTimeout(saveDraftTimeoutRef.current);
      }
    };
  }, [activeSession?.id, draft.memoryItemId, draft.title, draft.notes]);

  const setDraftValue = React.useCallback((key, value) => {
    setDraft((previousDraft) => ({
      ...previousDraft,
      [key]: value,
    }));
  }, []);

  const openDialog = React.useCallback(() => {
    setIsDialogOpen(true);
    setMinimized(false);
    void prepareTimeTrackerAlertSound({ unlock: true });
    void loadMemoryItemOptions();
  }, [loadMemoryItemOptions]);

  const closeDialog = React.useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  const minimizeDialog = React.useCallback(() => {
    setIsDialogOpen(false);
    setMinimized(true);
  }, []);

  const startSession = React.useCallback(async () => {
    setIsSaving(true);
    setError('');

    try {
      await prepareTimeTrackerAlertSound({ unlock: true });

      const startedSession = await startTimeTrackingSession({
        memoryItemId: draftRef.current.memoryItemId,
        title: draftRef.current.title,
        notes: draftRef.current.notes,
        lastActivityAt: new Date().toISOString(),
        alertThresholdMinutes: draftRef.current.alertEnabled
          ? draftRef.current.alertThresholdMinutes
          : null,
      });

      setActiveSession(startedSession);
      setDraft({
        memoryItemId: startedSession.memory_item_id ?? null,
        memoryItemName: startedSession.memory_item_name ?? '',
        title: startedSession.title ?? '',
        notes: startedSession.notes ?? '',
        alertEnabled: Boolean(startedSession.alert_threshold_minutes),
        alertThresholdMinutes: startedSession.alert_threshold_minutes ?? DEFAULT_TIME_TRACKING_ALERT_THRESHOLD_MINUTES,
      });
      setIsDialogOpen(true);
      setMinimized(false);
      lastActivityAtRef.current = Date.now();
      lastActivitySyncedAtRef.current = 0;
      showSnackbar('Time tracking session started.');
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Failed to start time tracking session.');
    } finally {
      setIsSaving(false);
    }
  }, [showSnackbar]);

  const stopSession = React.useCallback(async (stopReason = 'manual') => {
    if (!activeSessionRef.current?.id) {
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const sessionToStop = activeSessionRef.current;

      if (
        sessionToStop &&
        !sessionToStop.alert_triggered &&
        isSessionOverThreshold(sessionToStop, getSessionDurationSeconds(sessionToStop))
      ) {
        await triggerDurationAlert(sessionToStop);
      }

      const stoppedSession = await stopTimeTrackingSession(sessionToStop.id, {
        session: activeSessionRef.current,
        stopReason,
        lastActivityAt: new Date(lastActivityAtRef.current).toISOString(),
      });

      setActiveSession(null);
      setDraft(createDefaultDraft());
      setIsDialogOpen(false);
      setMinimized(false);
      showSnackbar('Time tracking session stopped.');
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : 'Failed to stop time tracking session.');
    } finally {
      setIsSaving(false);
    }
  }, [showSnackbar, triggerDurationAlert]);

  const isOverThreshold = React.useMemo(
    () => isSessionOverThreshold(activeSession, elapsedNowSeconds),
    [activeSession, elapsedNowSeconds]
  );

  const value = React.useMemo(() => ({
    activeSession,
    draft,
    elapsedNowSeconds,
    error,
    isDialogOpen,
    isOverThreshold,
    isSaving,
    memoryItemOptions,
    memoryItemOptionsLoading,
    minimized,
    closeDialog,
    loadMemoryItemOptions,
    minimizeDialog,
    openDialog,
    setDraftValue,
    startSession,
    stopSession,
  }), [
    activeSession,
    closeDialog,
    draft,
    elapsedNowSeconds,
    error,
    isDialogOpen,
    isOverThreshold,
    isSaving,
    loadMemoryItemOptions,
    memoryItemOptions,
    memoryItemOptionsLoading,
    minimizeDialog,
    minimized,
    openDialog,
    setDraftValue,
    startSession,
    stopSession,
  ]);

  return (
    <TimeTrackerContext.Provider value={value}>
      {children}
      <TimeTrackerDialog />
      <MinimizedTimeTracker />

      <Snackbar
        open={snackbarState.open}
        autoHideDuration={5000}
        onClose={() => setSnackbarState((current) => ({ ...current, open: false }))}
      >
        <Alert
          severity={snackbarState.severity}
          variant="filled"
          onClose={() => setSnackbarState((current) => ({ ...current, open: false }))}
          sx={{ width: '100%' }}
        >
          {snackbarState.message}
        </Alert>
      </Snackbar>
    </TimeTrackerContext.Provider>
  );
}
