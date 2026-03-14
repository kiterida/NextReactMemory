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
import WidgetCardShell from './WidgetCardShell';
import WidgetConfigDialog from './WidgetConfigDialog';
import WidgetPickerDialog from './WidgetPickerDialog';
import {
  createDashboardWidget,
  deleteDashboardWidget,
  fetchDashboardWidgets,
  updateDashboardWidget,
} from './widgetQueries';
import { getWidgetDefinition } from './widgetRegistry';

function WidgetRenderer({ widget, onEdit, onDelete }) {
  const definition = getWidgetDefinition(widget.widget_type);

  if (!definition) {
    return (
      <Alert severity="warning">
        Unknown widget type: {widget.widget_type}
      </Alert>
    );
  }

  const WidgetComponent = definition.component;
  return (
    <WidgetCardShell onEdit={onEdit} onDelete={onDelete}>
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

  const handleWidgetTypeSelect = (widgetType) => {
    setSelectedWidgetType(widgetType);
    setEditingWidget(null);
    setPickerOpen(false);
    setConfigOpen(true);
  };

  const handleSaveWidget = async (widgetValues) => {
    if (editingWidget) {
      const updatedWidget = await updateDashboardWidget(editingWidget.id, widgetValues);

      setWidgets((prev) =>
        prev.map((widget) => (widget.id === updatedWidget.id ? updatedWidget : widget))
      );
    } else {
      const currentWidgetCount = widgets.length;

      const createdWidget = await createDashboardWidget({
        userId,
        dashboardId,
        widgetType: selectedWidgetType,
        title: widgetValues.title,
        width: widgetValues.width,
        height: widgetValues.height,
        sortOrder: currentWidgetCount,
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

  return (
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
              onEdit={() => handleEditWidget(widget)}
              onDelete={() => handleDeleteWidget(widget)}
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
  );
}
