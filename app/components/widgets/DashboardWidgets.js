'use client';

import * as React from 'react';
import AddIcon from '@mui/icons-material/Add';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import WidgetCardShell from './WidgetCardShell';
import WidgetConfigDialog from './WidgetConfigDialog';
import WidgetPickerDialog from './WidgetPickerDialog';
import { assignDisplayOrder, getNextDisplayOrder, moveWidgetInList } from './widgetLayoutUtils';
import {
  createDashboardWidget,
  deleteDashboardWidget,
  fetchDashboardWidgets,
  updateDashboardWidget,
  updateDashboardWidgetCollapsed,
  updateDashboardWidgetOrder,
} from './widgetQueries';
import { getWidgetDefinition } from './widgetRegistry';

function WidgetRenderer({
  widget,
  isDragging,
  isDragOver,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onEdit,
  onDelete,
  onToggleCollapse,
}) {
  const definition = getWidgetDefinition(widget.widget_type);

  if (!definition) {
    return <Alert severity="warning">Unknown widget type: {widget.widget_type}</Alert>;
  }

  const WidgetComponent = definition.component;

  return (
    <WidgetCardShell
      title={widget.title}
      isCollapsed={Boolean(widget.is_collapsed)}
      isDragging={isDragging}
      isDragOver={isDragOver}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onEdit={onEdit}
      onDelete={onDelete}
      onToggleCollapse={onToggleCollapse}
    >
      <WidgetComponent widget={widget} />
    </WidgetCardShell>
  );
}

export default function DashboardWidgets({ userId, dashboardId }) {
  const [widgets, setWidgets] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [configOpen, setConfigOpen] = React.useState(false);
  const [selectedWidgetType, setSelectedWidgetType] = React.useState('');
  const [editingWidget, setEditingWidget] = React.useState(null);
  const [draggingWidgetId, setDraggingWidgetId] = React.useState(null);
  const [dragOverWidgetId, setDragOverWidgetId] = React.useState(null);
  const widgetsRef = React.useRef([]);
  const dragSnapshotRef = React.useRef([]);
  const draggedWidgetIdRef = React.useRef(null);
  const hasPendingReorderRef = React.useRef(false);

  React.useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  const loadWidgets = React.useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await fetchDashboardWidgets({ userId, dashboardId });
      setWidgets(data);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load widgets.');
    } finally {
      setLoading(false);
    }
  }, [dashboardId, userId]);

  React.useEffect(() => {
    loadWidgets();
  }, [loadWidgets]);

  const persistWidgetOrder = React.useCallback(async () => {
    const orderedWidgets = assignDisplayOrder(widgetsRef.current);
    setWidgets(orderedWidgets);

    try {
      const savedWidgets = await updateDashboardWidgetOrder(orderedWidgets);
      setWidgets(savedWidgets);
    } catch (reorderError) {
      setWidgets(dragSnapshotRef.current);
      setError(reorderError.message || 'Unable to save the new widget order.');
    } finally {
      draggedWidgetIdRef.current = null;
      hasPendingReorderRef.current = false;
      setDraggingWidgetId(null);
      setDragOverWidgetId(null);
    }
  }, []);

  const handleWidgetTypeSelect = (widgetType) => {
    setSelectedWidgetType(widgetType);
    setEditingWidget(null);
    setPickerOpen(false);
    setConfigOpen(true);
  };

  const handleSaveWidget = async (widgetValues) => {
    if (editingWidget) {
      const updatedWidget = await updateDashboardWidget(editingWidget.id, widgetValues);

      setWidgets((prev) => prev.map((widget) => (widget.id === updatedWidget.id ? updatedWidget : widget)));
    } else {
      const createdWidget = await createDashboardWidget({
        userId,
        dashboardId,
        widgetType: selectedWidgetType,
        title: widgetValues.title,
        width: widgetValues.width,
        height: widgetValues.height,
        sortOrder: widgets.length,
        displayOrder: getNextDisplayOrder(widgets),
        config: widgetValues.config,
      });

      setWidgets((prev) => [...prev, createdWidget]);
    }

    setConfigOpen(false);
    setSelectedWidgetType('');
    setEditingWidget(null);
  };

  const handleEditWidget = (widget) => {
    setEditingWidget(widget);
    setSelectedWidgetType(widget.widget_type);
    setConfigOpen(true);
  };

  const handleDeleteWidget = async (widget) => {
    const confirmed = window.confirm(`Delete "${widget.title}" from the dashboard?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteDashboardWidget(widget.id);
      setWidgets((prev) => prev.filter((item) => item.id !== widget.id));
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete widget.');
    }
  };

  const handleToggleCollapse = async (widget) => {
    const nextCollapsed = !widget.is_collapsed;

    setWidgets((prev) =>
      prev.map((entry) => (entry.id === widget.id ? { ...entry, is_collapsed: nextCollapsed } : entry))
    );

    try {
      const updatedWidget = await updateDashboardWidgetCollapsed(widget.id, nextCollapsed);
      setWidgets((prev) => prev.map((entry) => (entry.id === widget.id ? updatedWidget : entry)));
    } catch (collapseError) {
      setWidgets((prev) =>
        prev.map((entry) => (entry.id === widget.id ? { ...entry, is_collapsed: widget.is_collapsed } : entry))
      );
      setError(collapseError.message || 'Unable to update widget collapse state.');
    }
  };

  const handleWidgetDragStart = (event, widgetId) => {
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(widgetId));
    }

    draggedWidgetIdRef.current = widgetId;
    dragSnapshotRef.current = widgetsRef.current;
    hasPendingReorderRef.current = false;
    setDraggingWidgetId(widgetId);
    setDragOverWidgetId(widgetId);
  };

  const handleWidgetDragOver = (event, targetWidgetId) => {
    event.preventDefault();

    const draggedWidgetId = draggedWidgetIdRef.current;
    if (!draggedWidgetId || draggedWidgetId === targetWidgetId) {
      return;
    }

    setDragOverWidgetId(targetWidgetId);

    setWidgets((prev) => {
      const nextWidgets = moveWidgetInList(prev, draggedWidgetId, targetWidgetId);

      if (nextWidgets === prev) {
        return prev;
      }

      hasPendingReorderRef.current = true;
      return nextWidgets;
    });
  };

  const handleWidgetDrop = (event, targetWidgetId) => {
    event.preventDefault();
    setDragOverWidgetId(targetWidgetId);
  };

  const handleWidgetDragEnd = async () => {
    if (!hasPendingReorderRef.current) {
      draggedWidgetIdRef.current = null;
      setDraggingWidgetId(null);
      setDragOverWidgetId(null);
      return;
    }

    await persistWidgetOrder();
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1}>
        <Box>
          <Typography variant="h6">Dashboard Widgets</Typography>
          <Typography variant="body2" color="text.secondary">
            Add modular widgets backed by the `memory_core_widgets` table.
          </Typography>
        </Box>

        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setPickerOpen(true)}>
          Add Widget
        </Button>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {loading ? (
        <Box sx={{ py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : null}

      {!loading && widgets.length === 0 ? (
        <Alert severity="info">No widgets have been added to this dashboard yet.</Alert>
      ) : null}

      <Grid container spacing={2}>
        {widgets.map((widget) => (
          <Grid key={widget.id} size={{ xs: 12, md: widget.width || 6 }}>
            <WidgetRenderer
              widget={widget}
              isDragging={draggingWidgetId === widget.id}
              isDragOver={dragOverWidgetId === widget.id && draggingWidgetId !== widget.id}
              onDragStart={(event) => handleWidgetDragStart(event, widget.id)}
              onDragEnd={handleWidgetDragEnd}
              onDragOver={(event) => handleWidgetDragOver(event, widget.id)}
              onDrop={(event) => handleWidgetDrop(event, widget.id)}
              onEdit={() => handleEditWidget(widget)}
              onDelete={() => handleDeleteWidget(widget)}
              onToggleCollapse={() => handleToggleCollapse(widget)}
            />
          </Grid>
        ))}
      </Grid>

      <WidgetPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleWidgetTypeSelect}
      />

      <WidgetConfigDialog
        open={configOpen}
        widgetType={selectedWidgetType}
        initialValues={editingWidget}
        onClose={() => {
          setConfigOpen(false);
          setSelectedWidgetType('');
          setEditingWidget(null);
        }}
        onSave={handleSaveWidget}
      />
      </Stack>
    </DndProvider>
  );
}
