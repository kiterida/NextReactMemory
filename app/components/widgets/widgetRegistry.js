import CurrentCoursesWidget from './CurrentCoursesWidget';
import HistoryWidget from './HistoryWidget';
import ToDoListWidget from './ToDoListWidget';

export const widgetRegistry = {
  current_courses: {
    label: 'Current Courses',
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
  }));
}
