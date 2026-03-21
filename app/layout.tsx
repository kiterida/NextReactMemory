import * as React from 'react';
import { NextAppProvider } from '@toolpad/core/nextjs';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PersonIcon from '@mui/icons-material/Person';
import BookIcon from '@mui/icons-material/Book';
import CenterFocusWeakIcon from '@mui/icons-material/CenterFocusWeak';
import Box from '@mui/material/Box';
import { SessionProvider, signIn, signOut } from 'next-auth/react';
import { auth } from '../auth';
import theme from '../theme';
import { getDashboardsForUser } from './lib/dashboardServer';
import { getDashboardIconNode } from './components/dashboards/dashboardIcons';

export const metadata = {
  title: 'Memory Core',
  description: 'This is a sample app built with Toolpad Core and Next.js',
};

type Navigation = {
  kind?: 'header' | 'page';
  segment?: string;
  title: string;
  icon?: React.ReactNode;
  href?: string;
  pattern?: string;
}[];

function buildNavigation(dashboards: Array<Record<string, unknown>>): Navigation {
  const dashboardPages = dashboards.length
    ? dashboards.map((dashboard) => ({
        kind: 'page' as const,
        segment: `dashboards/${dashboard.id as string}`,
        title: (dashboard.name as string) || 'Untitled Dashboard',
        href: `/dashboards/${dashboard.id as string}`,
        icon: getDashboardIconNode(dashboard.icon as string, {
          sx: {
            color: (dashboard.color as string) || 'inherit',
          },
        }),
      }))
    : [
        {
          kind: 'page' as const,
          segment: 'dashboards',
          title: 'Dashboards',
          href: '/dashboards',
          icon: <DashboardIcon />,
        },
      ];

  return [
    {
      kind: 'header',
      title: 'Dashboards',
    },
    ...dashboardPages,
    {
      kind: 'header',
      title: 'Main items',
    },
    {
      kind: 'page',
      segment: 'memories',
      title: 'Memories',
      icon: <CenterFocusWeakIcon />,
      href: '/memories',
    },
    {
      kind: 'page',
      segment: 'starredLists',
      title: 'Starred Lists',
      icon: <BookIcon />,
    },
    {
      kind: 'page',
      segment: 'memoryTester',
      title: 'Memory Tester',
      icon: <BookIcon />,
    },
    {
      kind: 'page',
      segment: 'listTester',
      title: 'List Tester',
      icon: <BookIcon />,
    },
    {
      kind: 'page',
      segment: 'budget',
      title: 'Budget',
      icon: <BookIcon />,
    },
    {
      kind: 'page',
      segment: 'employees',
      title: 'Employees',
      icon: <PersonIcon />,
      pattern: 'employees{/:employeeId}*',
    },
    {
      kind: 'page',
      segment: 'sample',
      title: 'Sample Dashboard',
    },
  ];
}

const BRANDING = {
  title: 'Memory Core',
  logo: (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <CenterFocusWeakIcon fontSize="small" sx={{ color: 'text.primary' }} />
    </Box>
  ),
};

const AUTHENTICATION = {
  signIn,
  signOut,
};

export default async function RootLayout(props: { children: React.ReactNode }) {
  const session = await auth();
  const userId = session?.user?.email || session?.user?.name || null;
  const dashboards = await getDashboardsForUser(userId);
  const navigation = buildNavigation(dashboards);

  return (
    <html lang="en" data-toolpad-color-scheme="light" suppressHydrationWarning>
      <body>
        <SessionProvider session={session}>
          <AppRouterCacheProvider options={{ enableCssLayer: true }}>
            <NextAppProvider
              navigation={navigation}
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
