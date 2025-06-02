import * as React from 'react';
import { NextAppProvider } from '@toolpad/core/nextjs';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PersonIcon from '@mui/icons-material/Person';
import BookIcon from '@mui/icons-material/Book';
import CenterFocusWeakIcon from '@mui/icons-material/CenterFocusWeak';
import Box from '@mui/material/Box';
import SearchIcon from '@mui/icons-material/Search';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';

//import type { Navigation } from '@toolpad/core/AppProvider';
import { SessionProvider, signIn, signOut } from 'next-auth/react';
import { auth } from '../auth';
import theme from '../theme';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import ToolbarActionsSearch from './components/ToolbarActionsSearch';

import {
  DashboardLayout,
  ThemeSwitcher,
  type SidebarFooterProps,
} from '@toolpad/core/DashboardLayout';

export const metadata = {
  title: 'Memory Core',
  description: 'This is a sample app built with Toolpad Core and Next.js',
};

// Remove this (it's invalid)
// import type { Navigation } from '@toolpad/core/AppProvider';

// Add this instead
type Navigation = {
  kind?: 'header' | 'page';
  segment?: string;
  title: string;
  icon?: React.ReactNode;
  href?: string;
  pattern?: string;
}[];


const NAVIGATION: Navigation = [
  {
    kind: 'header',
    title: 'Main items',
  },
  {
    segment: '',
    title: 'Dashboard',
    icon: <DashboardIcon />,
  },
  {
    kind: 'page',
    segment: 'memories',
    title: 'Memories',
    icon: <CenterFocusWeakIcon />, // Or any icon you like
    href: '/memories',
  },
   {
    kind: 'page',
    segment: 'starredLists', // Use query param to toggle behavior
    title: 'Starred Lists',
    icon: <BookIcon />, // Or any icon you like
  },
  {
    segment: 'memoryTester',
    title: 'Memory Tester',
    icon: <BookIcon />,
  },
  {
    segment: 'budget',
    title: 'Budget',
    icon: <BookIcon />,
  },
  {
    segment: 'employees',
    title: 'Employees',
    icon: <PersonIcon />,
    pattern: 'employees{/:employeeId}*',
  },
  {
    segment: 'testPage',
    title: 'Test Page',
    icon: <PersonIcon />,
  },
  {
    segment:'sample',
    title: 'Sample Dashboard',
  }
];

const BRANDING = {
  title: 'Memory Core',
    logo: (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <CenterFocusWeakIcon
        fontSize="small"
        sx={{ color: 'text.primary' }} // Uses theme's primary text color
      />
    </Box>
  ),
};


const AUTHENTICATION = {
  signIn,
  signOut,
};




export default async function RootLayout(props: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="en" data-toolpad-color-scheme="light" suppressHydrationWarning>
      <body>
        <SessionProvider session={session}>
          <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          
            <NextAppProvider
              navigation={NAVIGATION}
              branding={BRANDING}
              session={session}
              authentication={AUTHENTICATION}
              theme={theme}
            
            >
          {props.children}
            </NextAppProvider>
            
          </AppRouterCacheProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
