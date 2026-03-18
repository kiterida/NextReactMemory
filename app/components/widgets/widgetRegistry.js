import SchoolIcon from '@mui/icons-material/School';
import HistoryIcon from '@mui/icons-material/History';
import ChecklistIcon from '@mui/icons-material/Checklist';
import CurrentCoursesWidget from './CurrentCoursesWidget';
import HistoryWidget from './HistoryWidget';
import ToDoListWidget from './ToDoListWidget';

export const widgetRegistry = {
  current_courses: {
    label: 'Current Courses',
    description: 'See the courses you are currently focused on.',
    icon: SchoolIcon,
    component: CurrentCoursesWidget,
    defaultTitle: 'Current Courses',
    defaultSize: {
      width: 6,
      height: 2,
    },
    defaultConfig: {
      memoryItemId: '',
    },
  },
  history: {
    label: 'History',
    description: 'Review your recent activity and updates.',
    icon: HistoryIcon,
    component: HistoryWidget,
    defaultTitle: 'Recent History',
    defaultSize: {
      width: 4,
      height: 2,
    },
    defaultConfig: {
      maxItems: 5,
    },
  },
  todo_list: {
    label: 'To Do List',
    description: 'Track tasks and manage your linked to-do list.',
    icon: ChecklistIcon,
    component: ToDoListWidget,
    defaultTitle: 'To Do List',
    defaultSize: {
      width: 6,
      height: 2,
    },
    defaultConfig: {
      todo_list_id: '',
    },
  },
};

export function getWidgetDefinition(widgetType) {
  return widgetRegistry[widgetType] || null;
}

export function getWidgetTypeOptions() {
  return Object.entries(widgetRegistry).map(([widgetType, definition]) => ({
    widgetType,
    label: definition.label,
    description: definition.description,
    icon: definition.icon,
  }));
}
