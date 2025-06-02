import * as React from 'react';
import Typography from '@mui/material/Typography';
import { auth } from '../../auth';
import TodoListWidget from '../components/widgets/ToDoListWidget';
import Box from '@mui/material/Box';

export default async function HomePage() {
  const session = await auth();

  return (    
    <>
      <Typography>
        Welcome to your Memory Core, {session?.user?.name || 'User'}!
      </Typography>
      <div>Todo</div>
      <div>I want a todo list here</div>
      <div>Need an add button on this page that allows you to add widgets to the dashboardd like &lsquo;To Do List&lsquo;, &lsquo;Current Memory List&lsquo;, &lsquo;Current Project&lsquo;. etc</div>
      <Box sx={{ p: 2, mt:2, width: '100%', backgroundColor: 'grey'}}>
        <Box>
          <Typography>Create new table for app settings, widgets, etc..</Typography>
          <Typography>Query for included widgets</Typography>
          <Typography>Map widgets onto dashboard</Typography>
          <Typography>Create ability to add and delete widgets</Typography>
        </Box>
        <TodoListWidget />
      </Box>
      </>
  );
}
