'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import RefreshIcon from '@mui/icons-material/Refresh';

type UsageOverview = {
  generatedAt: string;
  supabase: {
    configured: boolean;
    bucketCount: number;
    objectCount: number;
    totalBytes: number;
    limitBytes: number;
    note: string;
    error?: string;
    buckets: Array<{
      id: string;
      name: string;
      public: boolean;
      objectCount: number;
      totalBytes: number;
    }>;
  };
  r2: {
    bucketName: string | null;
    configured: boolean;
    objectCount: number;
    totalBytes: number;
    lastModified: string | null;
    limitBytes: number;
    classAIncludedMonthly: number;
    classBIncludedMonthly: number;
    note: string;
    error?: string;
    setup: {
      cloudflareAnalyticsConfigured: boolean;
      env: Array<{
        name: string;
        present: boolean;
        required: boolean;
        note: string;
      }>;
    };
    monthlyOperations: {
      available: boolean;
      periodStart: string;
      periodEnd: string;
      classARequests: number;
      classBRequests: number;
      unclassifiedRequests: number;
      note: string;
      error?: string;
      breakdown: Array<{
        actionType: string;
        requests: number;
        operationClass: 'A' | 'B' | 'unclassified';
      }>;
    };
  };
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function formatPercent(used: number, limit: number) {
  if (!limit || !Number.isFinite(limit) || limit <= 0) {
    return 0;
  }

  return Math.min((used / limit) * 100, 100);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return 'N/A';
  }

  return new Date(value).toLocaleString();
}

function UsageCard({
  title,
  usedBytes,
  limitBytes,
  subtitle,
  children,
}: {
  title: string;
  usedBytes: number;
  limitBytes: number;
  subtitle: string;
  children?: React.ReactNode;
}) {
  const percent = formatPercent(usedBytes, limitBytes);

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6">{title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          </Box>

          <Box>
            <Typography variant="h4">{formatBytes(usedBytes)}</Typography>
            <Typography variant="body2" color="text.secondary">
              Limit reference: {formatBytes(limitBytes)}
            </Typography>
          </Box>

          <Box>
            <LinearProgress variant="determinate" value={percent} sx={{ height: 10, borderRadius: 999 }} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
              {percent.toFixed(1)}% of the configured limit reference
            </Typography>
          </Box>

          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}

function OperationUsageRow({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const percent = formatPercent(used, limit);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ mb: 0.75 }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" color="text.secondary">
          {used.toLocaleString()} / {limit.toLocaleString()}
        </Typography>
      </Stack>
      <LinearProgress variant="determinate" value={percent} sx={{ height: 8, borderRadius: 999 }} />
    </Box>
  );
}

export default function UsagePage() {
  const [data, setData] = React.useState<UsageOverview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const loadUsage = React.useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/usage/overview', { cache: 'no-store' });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load usage overview');
      }

      setData(payload as UsageOverview);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load usage overview');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  return (
    <Stack spacing={3} sx={{ p: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>
        <Box>
          <Typography variant="h4">Storage Usage</Typography>
          <Typography color="text.secondary">
            Server-side snapshot of your Supabase Storage and Cloudflare R2 usage.
          </Typography>
        </Box>

        <Button variant="contained" startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />} onClick={() => void loadUsage()} disabled={loading}>
          Refresh
        </Button>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {loading && !data ? (
        <Stack direction="row" spacing={1} alignItems="center">
          <CircularProgress size={20} />
          <Typography color="text.secondary">Loading usage...</Typography>
        </Stack>
      ) : null}

      {data ? (
        <>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
            <Box sx={{ flex: 1 }}>
              <UsageCard
                title="Supabase Storage"
                usedBytes={data.supabase.totalBytes}
                limitBytes={data.supabase.limitBytes}
                subtitle="Aggregated across all storage buckets in this project."
              >
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip label={`${data.supabase.bucketCount} bucket${data.supabase.bucketCount === 1 ? '' : 's'}`} />
                  <Chip label={`${data.supabase.objectCount} object${data.supabase.objectCount === 1 ? '' : 's'}`} />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {data.supabase.note}
                </Typography>
                {data.supabase.error ? <Alert severity="warning">{data.supabase.error}</Alert> : null}
              </UsageCard>
            </Box>

            <Box sx={{ flex: 1 }}>
              <UsageCard
                title="Cloudflare R2"
                usedBytes={data.r2.totalBytes}
                limitBytes={data.r2.limitBytes}
                subtitle={data.r2.bucketName ? `Bucket: ${data.r2.bucketName}` : 'Bucket name not configured'}
              >
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip label={`${data.r2.objectCount} object${data.r2.objectCount === 1 ? '' : 's'}`} />
                  <Chip label={`Class A included: ${data.r2.classAIncludedMonthly.toLocaleString()}/mo`} />
                  <Chip label={`Class B included: ${data.r2.classBIncludedMonthly.toLocaleString()}/mo`} />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {data.r2.note}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Latest object update: {formatDateTime(data.r2.lastModified)}
                </Typography>
                {data.r2.error ? <Alert severity="warning">{data.r2.error}</Alert> : null}
              </UsageCard>
            </Box>
          </Stack>

          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h6">Cloudflare Setup</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Server-side environment status for R2 analytics.
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    color={data.r2.setup.cloudflareAnalyticsConfigured ? 'success' : 'warning'}
                    label={data.r2.setup.cloudflareAnalyticsConfigured ? 'Analytics configured' : 'Analytics setup incomplete'}
                  />
                </Stack>

                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Variable</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Notes</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.r2.setup.env.map((item) => (
                      <TableRow key={item.name}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={item.present ? 'success' : item.required ? 'warning' : 'default'}
                            label={item.present ? 'Present' : item.required ? 'Missing' : 'Optional'}
                          />
                        </TableCell>
                        <TableCell>{item.note}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h6">Cloudflare R2 Monthly Operations</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Current month to date, grouped into Class A and Class B request buckets.
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip label={`Period start: ${formatDateTime(data.r2.monthlyOperations.periodStart)}`} />
                  <Chip label={`Period end: ${formatDateTime(data.r2.monthlyOperations.periodEnd)}`} />
                </Stack>

                <OperationUsageRow
                  label="Class A requests"
                  used={data.r2.monthlyOperations.classARequests}
                  limit={data.r2.classAIncludedMonthly}
                />
                <OperationUsageRow
                  label="Class B requests"
                  used={data.r2.monthlyOperations.classBRequests}
                  limit={data.r2.classBIncludedMonthly}
                />

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip label={`Class A used: ${data.r2.monthlyOperations.classARequests.toLocaleString()}`} />
                  <Chip label={`Class B used: ${data.r2.monthlyOperations.classBRequests.toLocaleString()}`} />
                  <Chip label={`Unclassified: ${data.r2.monthlyOperations.unclassifiedRequests.toLocaleString()}`} />
                </Stack>

                <Typography variant="body2" color="text.secondary">
                  {data.r2.monthlyOperations.note}
                </Typography>

                {data.r2.monthlyOperations.error ? <Alert severity="warning">{data.r2.monthlyOperations.error}</Alert> : null}

                {data.r2.monthlyOperations.breakdown.length > 0 ? (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Action Type</TableCell>
                        <TableCell>Class</TableCell>
                        <TableCell align="right">Requests</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.r2.monthlyOperations.breakdown.map((item) => (
                        <TableRow key={item.actionType}>
                          <TableCell>{item.actionType}</TableCell>
                          <TableCell>{item.operationClass}</TableCell>
                          <TableCell align="right">{item.requests.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Alert severity="info">No Cloudflare R2 operation analytics are available yet for this month, or the analytics token is not configured.</Alert>
                )}
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h6">Supabase Bucket Breakdown</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Current usage grouped by bucket.
                  </Typography>
                </Box>

                {data.supabase.buckets.length === 0 ? (
                  <Alert severity="info">No Supabase storage buckets were found, or usage could not be read.</Alert>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Bucket</TableCell>
                        <TableCell>Visibility</TableCell>
                        <TableCell align="right">Objects</TableCell>
                        <TableCell align="right">Size</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.supabase.buckets.map((bucket) => (
                        <TableRow key={bucket.id}>
                          <TableCell>{bucket.name}</TableCell>
                          <TableCell>{bucket.public ? 'Public' : 'Private'}</TableCell>
                          <TableCell align="right">{bucket.objectCount.toLocaleString()}</TableCell>
                          <TableCell align="right">{formatBytes(bucket.totalBytes)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="h6">Plan Reference Notes</Typography>
                <Typography variant="body2" color="text.secondary">
                  Supabase uses a configurable storage limit reference in this page. If you do not set `SUPABASE_STORAGE_LIMIT_BYTES`, it defaults to a 1 GB free-plan reference.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  R2 uses a configurable storage limit reference in this page. If you do not set `R2_STORAGE_LIMIT_BYTES`, it defaults to a 10 GB included-usage reference, with 1,000,000 Class A and 10,000,000 Class B operations per month.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  To load real monthly Cloudflare R2 Class A/Class B usage, add `CLOUDFLARE_API_TOKEN`. If needed, also add `CLOUDFLARE_ACCOUNT_ID`; otherwise the page falls back to `R2_ACCOUNT_ID`.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  The Cloudflare token should have account-level analytics read access so the GraphQL Analytics API can query R2 operations.
                </Typography>
                <Divider />
                <Typography variant="caption" color="text.secondary">
                  Snapshot generated: {formatDateTime(data.generatedAt)}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </>
      ) : null}
    </Stack>
  );
}
