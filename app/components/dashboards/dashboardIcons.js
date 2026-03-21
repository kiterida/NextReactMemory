import * as React from 'react';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import DashboardIcon from '@mui/icons-material/Dashboard';
import FolderIcon from '@mui/icons-material/Folder';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import PsychologyIcon from '@mui/icons-material/Psychology';
import SchoolIcon from '@mui/icons-material/School';

const ICON_MAP = {
  analytics: AnalyticsIcon,
  dashboard: DashboardIcon,
  folder: FolderIcon,
  'memory-revision': MenuBookIcon,
  psychology: PsychologyIcon,
  school: SchoolIcon,
};

export const DASHBOARD_ICON_OPTIONS = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'school', label: 'Training' },
  { value: 'folder', label: 'Projects' },
  { value: 'psychology', label: 'Memory Revision' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'memory-revision', label: 'Study' },
];

export function getDashboardIconNode(iconName, props = {}) {
  const IconComponent = ICON_MAP[iconName] || DashboardIcon;
  return <IconComponent fontSize="small" {...props} />;
}


