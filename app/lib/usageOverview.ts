import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { getSupabaseAdminClient } from '@/app/lib/supabaseAdmin';

const DEFAULT_SUPABASE_STORAGE_LIMIT_BYTES = 1 * 1024 * 1024 * 1024;
const DEFAULT_R2_STORAGE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024;
const DEFAULT_R2_CLASS_A_LIMIT = 1000000;
const DEFAULT_R2_CLASS_B_LIMIT = 10000000;
const STORAGE_OBJECT_PAGE_SIZE = 1000;
const CLOUDFLARE_GRAPHQL_ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';
const R2_CLASS_A_ACTIONS = new Set([
  'ListBuckets',
  'PutBucket',
  'ListObjects',
  'PutObject',
  'CopyObject',
  'CompleteMultipartUpload',
  'CreateMultipartUpload',
  'LifecycleStorageTierTransition',
  'ListMultipartUploads',
  'UploadPart',
  'UploadPartCopy',
  'ListParts',
  'PutBucketEncryption',
  'PutBucketCors',
  'PutBucketLifecycleConfiguration',
]);
const R2_CLASS_B_ACTIONS = new Set([
  'HeadBucket',
  'HeadObject',
  'GetObject',
  'UsageSummary',
  'GetBucketEncryption',
  'GetBucketLocation',
  'GetBucketCors',
  'GetBucketLifecycleConfiguration',
]);

type StorageObjectMetadata = {
  size?: number | string | null;
  contentLength?: number | string | null;
  httpMetadata?: {
    contentLength?: number | string | null;
  } | null;
} | null;

type SupabaseStorageListItem = {
  name: string;
  id?: string | null;
  metadata?: StorageObjectMetadata;
};

type SupabaseBucketSummary = {
  id: string;
  name: string;
  public: boolean;
  objectCount: number;
  totalBytes: number;
};

type EnvStatusItem = {
  name: string;
  present: boolean;
  required: boolean;
  note: string;
};

type UsageSetupSummary = {
  cloudflareAnalyticsConfigured: boolean;
  env: EnvStatusItem[];
};

type R2ActionBreakdown = {
  actionType: string;
  requests: number;
  operationClass: 'A' | 'B' | 'unclassified';
};

type R2MonthlyOperations = {
  available: boolean;
  periodStart: string;
  periodEnd: string;
  classARequests: number;
  classBRequests: number;
  unclassifiedRequests: number;
  breakdown: R2ActionBreakdown[];
  note: string;
  error?: string;
};

type R2Summary = {
  bucketName: string | null;
  configured: boolean;
  objectCount: number;
  totalBytes: number;
  lastModified: string | null;
  limitBytes: number;
  classAIncludedMonthly: number;
  classBIncludedMonthly: number;
  note: string;
  monthlyOperations: R2MonthlyOperations;
  setup: UsageSetupSummary;
  error?: string;
};

type SupabaseSummary = {
  configured: boolean;
  bucketCount: number;
  objectCount: number;
  totalBytes: number;
  limitBytes: number;
  buckets: SupabaseBucketSummary[];
  note: string;
  error?: string;
};

export type UsageOverview = {
  generatedAt: string;
  supabase: SupabaseSummary;
  r2: R2Summary;
};

function parsePositiveIntegerEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getObjectSizeBytes(metadata: StorageObjectMetadata) {
  const value =
    metadata?.size ??
    metadata?.contentLength ??
    metadata?.httpMetadata?.contentLength;

  const size = Number(value);
  return Number.isFinite(size) && size > 0 ? size : 0;
}

function formatErrorDetails(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (!error || typeof error !== 'object') {
    return fallback;
  }

  const errorRecord = error as Record<string, unknown>;
  const parts = [
    typeof errorRecord.message === 'string' ? errorRecord.message : null,
    typeof errorRecord.error_description === 'string' ? errorRecord.error_description : null,
    typeof errorRecord.details === 'string' ? `details: ${errorRecord.details}` : null,
    typeof errorRecord.hint === 'string' ? `hint: ${errorRecord.hint}` : null,
    typeof errorRecord.code === 'string' ? `code: ${errorRecord.code}` : null,
    typeof errorRecord.status === 'number' ? `status: ${errorRecord.status}` : null,
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(' | ');
  }

  try {
    return JSON.stringify(errorRecord);
  } catch {
    return fallback;
  }
}

function getCurrentMonthUtcRange(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  return {
    periodStart: start.toISOString(),
    periodEnd: now.toISOString(),
  };
}

function getCloudflareSetupSummary(): UsageSetupSummary {
  const hasR2AccountId = Boolean(process.env.R2_ACCOUNT_ID);
  const hasCloudflareAccountId = Boolean(process.env.CLOUDFLARE_ACCOUNT_ID);
  const hasApiToken = Boolean(process.env.CLOUDFLARE_API_TOKEN);

  return {
    cloudflareAnalyticsConfigured: hasApiToken && (hasCloudflareAccountId || hasR2AccountId),
    env: [
      {
        name: 'CLOUDFLARE_API_TOKEN',
        present: hasApiToken,
        required: true,
        note: 'Required for Cloudflare GraphQL analytics requests.',
      },
      {
        name: 'CLOUDFLARE_ACCOUNT_ID',
        present: hasCloudflareAccountId,
        required: false,
        note: 'Recommended. If missing, the app falls back to R2_ACCOUNT_ID.',
      },
      {
        name: 'R2_ACCOUNT_ID',
        present: hasR2AccountId,
        required: true,
        note: 'Already used for R2 storage access and also works as the fallback Cloudflare account id.',
      },
      {
        name: 'R2_BUCKET_NAME',
        present: Boolean(process.env.R2_BUCKET_NAME),
        required: true,
        note: 'Required for bucket-level storage and analytics filtering.',
      },
    ],
  };
}

function getDefaultMonthlyOperations(note: string, overrides?: Partial<R2MonthlyOperations>): R2MonthlyOperations {
  const { periodStart, periodEnd } = getCurrentMonthUtcRange();

  return {
    available: false,
    periodStart,
    periodEnd,
    classARequests: 0,
    classBRequests: 0,
    unclassifiedRequests: 0,
    breakdown: [],
    note,
    ...overrides,
  };
}

async function getSupabaseFolderUsage(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  bucketName: string,
  folderPath = '',
): Promise<{ objectCount: number; totalBytes: number }> {
  let objectCount = 0;
  let totalBytes = 0;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(bucketName).list(folderPath, {
      limit: STORAGE_OBJECT_PAGE_SIZE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error) {
      throw new Error(
        `Storage API list failed for bucket "${bucketName}" at "${folderPath || '/'}": ${formatErrorDetails(error, 'Unknown storage list error')}`,
      );
    }

    const items = (data ?? []) as SupabaseStorageListItem[];

    for (const item of items) {
      const isFolder = item.id == null && item.metadata == null;

      if (isFolder) {
        const childPath = folderPath ? `${folderPath}/${item.name}` : item.name;
        const childUsage = await getSupabaseFolderUsage(supabase, bucketName, childPath);
        objectCount += childUsage.objectCount;
        totalBytes += childUsage.totalBytes;
        continue;
      }

      objectCount += 1;
      totalBytes += getObjectSizeBytes(item.metadata ?? null);
    }

    if (items.length < STORAGE_OBJECT_PAGE_SIZE) {
      break;
    }

    offset += STORAGE_OBJECT_PAGE_SIZE;
  }

  return { objectCount, totalBytes };
}

async function getSupabaseStorageSummary(): Promise<SupabaseSummary> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
      throw new Error(`Bucket listing failed: ${formatErrorDetails(bucketsError, 'Unknown bucket listing error')}`);
    }

    const bucketSummaries: SupabaseBucketSummary[] = [];

    for (const bucket of buckets ?? []) {
      const usage = await getSupabaseFolderUsage(supabase, bucket.name);

      bucketSummaries.push({
        id: bucket.id,
        name: bucket.name,
        public: Boolean(bucket.public),
        objectCount: usage.objectCount,
        totalBytes: usage.totalBytes,
      });
    }

    bucketSummaries.sort((a, b) => b.totalBytes - a.totalBytes);

    const totals = bucketSummaries.reduce(
      (acc, bucket) => {
        acc.objectCount += bucket.objectCount;
        acc.totalBytes += bucket.totalBytes;
        return acc;
      },
      { objectCount: 0, totalBytes: 0 },
    );

    return {
      configured: true,
      bucketCount: bucketSummaries.length,
      objectCount: totals.objectCount,
      totalBytes: totals.totalBytes,
      limitBytes: parsePositiveIntegerEnv(
        process.env.SUPABASE_STORAGE_LIMIT_BYTES,
        DEFAULT_SUPABASE_STORAGE_LIMIT_BYTES,
      ),
      buckets: bucketSummaries,
      note: 'Current usage is calculated from the Supabase Storage API by listing files in each bucket.',
    };
  } catch (error) {
    const errorMessage = formatErrorDetails(error, 'Unknown Supabase error');
    console.error('Supabase storage usage failed:', error);

    return {
      configured: false,
      bucketCount: 0,
      objectCount: 0,
      totalBytes: 0,
      limitBytes: parsePositiveIntegerEnv(
        process.env.SUPABASE_STORAGE_LIMIT_BYTES,
        DEFAULT_SUPABASE_STORAGE_LIMIT_BYTES,
      ),
      buckets: [],
      note: 'Supabase storage usage could not be loaded.',
      error: errorMessage,
    };
  }
}

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

async function getCloudflareR2MonthlyOperations(bucketName: string | null): Promise<R2MonthlyOperations> {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;

  if (!apiToken || !accountId) {
    return getDefaultMonthlyOperations(
      'Monthly Class A/Class B usage is available when CLOUDFLARE_API_TOKEN and a Cloudflare account ID are configured for the GraphQL Analytics API.',
    );
  }

  const { periodStart, periodEnd } = getCurrentMonthUtcRange();
  const query = `
    query R2MonthlyOperations($accountTag: string!, $startDate: Time!, $endDate: Time!, $bucketName: string) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          r2OperationsAdaptiveGroups(
            limit: 10000
            filter: {
              datetime_geq: $startDate
              datetime_leq: $endDate
              bucketName: $bucketName
            }
          ) {
            sum {
              requests
            }
            dimensions {
              actionType
            }
          }
        }
      }
    }
  `;

  const response = await fetch(CLOUDFLARE_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({
      query,
      variables: {
        accountTag: accountId,
        startDate: periodStart,
        endDate: periodEnd,
        bucketName,
      },
    }),
    cache: 'no-store',
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(`Cloudflare GraphQL request failed: ${response.status} ${response.statusText}`);
  }

  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    const combined = payload.errors
      .map((item: { message?: string }) => item?.message)
      .filter(Boolean)
      .join(' | ');
    throw new Error(`Cloudflare GraphQL returned errors: ${combined || 'Unknown GraphQL error'}`);
  }

  const groups = payload?.data?.viewer?.accounts?.[0]?.r2OperationsAdaptiveGroups;
  if (!Array.isArray(groups)) {
    throw new Error('Cloudflare GraphQL returned an unexpected response for r2OperationsAdaptiveGroups.');
  }

  let classARequests = 0;
  let classBRequests = 0;
  let unclassifiedRequests = 0;

  const breakdown: R2ActionBreakdown[] = groups
    .map((group: { sum?: { requests?: number }; dimensions?: { actionType?: string } }) => {
      const actionType = group?.dimensions?.actionType || 'Unknown';
      const requests = Number(group?.sum?.requests ?? 0);
      let operationClass: 'A' | 'B' | 'unclassified' = 'unclassified';

      if (R2_CLASS_A_ACTIONS.has(actionType)) {
        operationClass = 'A';
        classARequests += requests;
      } else if (R2_CLASS_B_ACTIONS.has(actionType)) {
        operationClass = 'B';
        classBRequests += requests;
      } else {
        unclassifiedRequests += requests;
      }

      return {
        actionType,
        requests,
        operationClass,
      };
    })
    .sort((a, b) => b.requests - a.requests);

  return {
    available: true,
    periodStart,
    periodEnd,
    classARequests,
    classBRequests,
    unclassifiedRequests,
    breakdown,
    note: 'Monthly operations are derived from Cloudflare R2 GraphQL analytics for the current month to date. Cloudflare notes that GraphQL analytics are aggregated analytics and may not exactly match billable usage.',
  };
}

async function getR2StorageSummary(): Promise<R2Summary> {
  const bucketName = process.env.R2_BUCKET_NAME ?? null;
  const client = getR2Client();
  const limitBytes = parsePositiveIntegerEnv(process.env.R2_STORAGE_LIMIT_BYTES, DEFAULT_R2_STORAGE_LIMIT_BYTES);
  const classAIncludedMonthly = parsePositiveIntegerEnv(
    process.env.R2_CLASS_A_MONTHLY_LIMIT,
    DEFAULT_R2_CLASS_A_LIMIT,
  );
  const classBIncludedMonthly = parsePositiveIntegerEnv(
    process.env.R2_CLASS_B_MONTHLY_LIMIT,
    DEFAULT_R2_CLASS_B_LIMIT,
  );
  const setup = getCloudflareSetupSummary();

  if (!bucketName || !client) {
    return {
      bucketName,
      configured: false,
      objectCount: 0,
      totalBytes: 0,
      lastModified: null,
      limitBytes,
      classAIncludedMonthly,
      classBIncludedMonthly,
      note: 'R2 usage is unavailable until the server-side R2 environment variables are configured.',
      monthlyOperations: getDefaultMonthlyOperations(
        'Monthly Class A/Class B usage is unavailable until the server-side R2 environment variables are configured.',
      ),
      setup,
    };
  }

  try {
    let objectCount = 0;
    let totalBytes = 0;
    let continuationToken: string | undefined;
    let lastModified: string | null = null;

    do {
      const response = await client.send(
        new ListObjectsV2Command({
          Bucket: bucketName,
          ContinuationToken: continuationToken,
        }),
      );

      for (const object of response.Contents ?? []) {
        objectCount += 1;
        totalBytes += object.Size ?? 0;

        const isoDate = object.LastModified?.toISOString() ?? null;
        if (isoDate && (!lastModified || isoDate > lastModified)) {
          lastModified = isoDate;
        }
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    let monthlyOperations = getDefaultMonthlyOperations(
      'Monthly Class A/Class B usage is unavailable because Cloudflare analytics are not configured yet.',
    );
    try {
      monthlyOperations = await getCloudflareR2MonthlyOperations(bucketName);
    } catch (analyticsError) {
      monthlyOperations = getDefaultMonthlyOperations(
        'Monthly Class A/Class B usage could not be loaded from Cloudflare analytics.',
        {
          error: formatErrorDetails(analyticsError, 'Unknown Cloudflare analytics error'),
        },
      );
    }

    return {
      bucketName,
      configured: true,
      objectCount,
      totalBytes,
      lastModified,
      limitBytes,
      classAIncludedMonthly,
      classBIncludedMonthly,
      note: 'Current bucket usage is calculated by listing objects via the R2 S3-compatible API.',
      monthlyOperations,
      setup,
    };
  } catch (error) {
    return {
      bucketName,
      configured: true,
      objectCount: 0,
      totalBytes: 0,
      lastModified: null,
      limitBytes,
      classAIncludedMonthly,
      classBIncludedMonthly,
      note: 'R2 usage could not be loaded.',
      monthlyOperations: getDefaultMonthlyOperations(
        'Monthly Class A/Class B usage was skipped because bucket usage could not be loaded.',
      ),
      setup,
      error: formatErrorDetails(error, 'Unknown R2 error'),
    };
  }
}

export async function getUsageOverview(): Promise<UsageOverview> {
  const [supabase, r2] = await Promise.all([
    getSupabaseStorageSummary(),
    getR2StorageSummary(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    supabase,
    r2,
  };
}
