'use client';

import * as React from 'react';

export const TimeTrackerContext = React.createContext(null);

export function useTimeTracker() {
  const value = React.useContext(TimeTrackerContext);

  if (!value) {
    throw new Error('useTimeTracker must be used within a TimeTrackerProvider.');
  }

  return value;
}
