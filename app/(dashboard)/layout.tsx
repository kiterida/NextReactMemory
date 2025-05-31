'use client';
import * as React from 'react';
import { usePathname, useParams } from 'next/navigation';
import { DashboardLayout } from '@toolpad/core/DashboardLayout';
import { PageContainer } from '@toolpad/core/PageContainer';
import '../globals.css';
import Box from '@mui/material/Box';

export default function Layout(props: { children: React.ReactNode }) {
const pathname = usePathname();
  const params = useParams();
  const [employeeId] = params.segments ?? [];

  const title = React.useMemo(() => {
    if (pathname === '/employees/new') {
      return 'New Employee';
    }
    if (employeeId && pathname.includes('/edit')) {
      return `Employee ${employeeId} - Edit`;
    }
    if (employeeId) {
      return `Employee ${employeeId}`;
    }
    return undefined;
  }, [employeeId, pathname]);

  const sxOverride  =
    (pathname === '/memories' || pathname === '/starredLists')
      ? {
          maxWidth: '100% !important',
          margin: '0 !important',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden', // prevent internal scroll
          p: 0, // optional: remove padding to use full height
        }
      : undefined;

        // 🧠 Conditionally import toolbarActions only for relevant routes
  const slots = React.useMemo(() => {
    if (pathname === '/starredLists') {
      // Use dynamic import to prevent unnecessary loading
      const Toolbar = require('./starredLists/page').toolbarActions;
      return { toolbarActions: Toolbar };
    }
    return {};
  }, [pathname]);


  return (
    <DashboardLayout sx={{ height: '100vh', overflow: 'hidden' }} slots={slots}>
      <PageContainer title={title} sx={sxOverride}>  
         {props.children}
      </PageContainer>
    </DashboardLayout>
  );
}  


