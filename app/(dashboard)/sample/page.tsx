'use client';
import * as React from 'react';
import PropTypes from 'prop-types';
import { useDemoRouter } from '@toolpad/core/internal';
import {
  PageContainer,
  PageHeader,
  PageHeaderToolbar,
} from '@toolpad/core/PageContainer';
import { NextAppProvider } from '@toolpad/core/nextjs';
//import  AppProvider  from '@toolpad/core/AppProvider';
import { LocalizationProvider } from '@mui/x-date-pickers-pro/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers-pro/AdapterDayjs';
import { SingleInputDateRangeField } from '@mui/x-date-pickers-pro/SingleInputDateRangeField';
import { DateRangePicker } from '@mui/x-date-pickers-pro/DateRangePicker';
import Button from '@mui/material/Button';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import dayjs from 'dayjs';
import { useTheme } from '@mui/material/styles';
import Paper from '@mui/material/Paper';
import PageContent from './PageContent';

const NAVIGATION = [
  { segment: '', title: 'Weather' },
  { segment: 'orders', title: 'Orders' },
];

// preview-start
function CustomPageToolbar({ status } : { status : string}) {
  return (
    <PageHeaderToolbar>
      <p>Current status: {status}</p>
      <Button startIcon={<FileDownloadIcon />} color="inherit">
        Export
      </Button>

      <DateRangePicker
        sx={{ width: 220 }}
        defaultValue={[dayjs(), dayjs().add(14, 'day')]}
        slots={{ field: SingleInputDateRangeField }}
        slotProps={{ field: { } }}
        label="Period"
      />
    </PageHeaderToolbar>
  );
}

CustomPageToolbar.propTypes = {
  status: PropTypes.string.isRequired,
};

function CustomPageHeader({ status } : { status : string}) {
  const CustomPageToolbarComponent = React.useCallback(
    () => <CustomPageToolbar status={status} />,
    [status],
  );

  return <PageHeader slots={{ toolbar: CustomPageToolbarComponent }} />;
}
// preview-end

CustomPageHeader.propTypes = {
  status: PropTypes.string.isRequired,
};

export default function ActionsPageContainer() {
  const router = useDemoRouter();
  const status = 'Active';

  const CustomPageHeaderComponent = React.useCallback(
    () => <CustomPageHeader status={status} />,
    [status],
  );
  const theme = useTheme();

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <NextAppProvider navigation={NAVIGATION} router={router} theme={theme}>
        <Paper sx={{ width: '100%' }}>
          <PageContainer slots={{ header: CustomPageHeaderComponent }}>
            <PageContent />
          </PageContainer>
        </Paper>
      </NextAppProvider>
    </LocalizationProvider>
  );
}
