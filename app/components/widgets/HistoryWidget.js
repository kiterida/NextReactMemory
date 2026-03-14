'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export default function HistoryWidget({ widget }) {
  const maxItems = Number(widget?.config?.maxItems ?? 5);
  const historyItems = [];

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Typography variant="h6">{widget.title}</Typography>
          <Typography variant="body2" color="text.secondary">
            This widget is ready for history tracking. It will eventually show the most recent list items the user opened.
          </Typography>

          {historyItems.length === 0 ? (
            <Alert severity="info">
              No history data is connected yet. Current config will display up to {maxItems} items once tracking is added.
            </Alert>
          ) : (
            <List dense disablePadding>
              {historyItems.slice(0, maxItems).map((item) => (
                <ListItem key={item.id} disableGutters>
                  <ListItemText primary={item.label} secondary={item.visitedAt} />
                </ListItem>
              ))}
            </List>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
