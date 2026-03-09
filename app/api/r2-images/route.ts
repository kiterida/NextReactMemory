import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL;
const MEMORY_IMAGES_PREFIX = 'memory-images/';

function getR2Client() {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error('Cloudflare R2 credentials are not configured');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

export async function GET() {
  try {
    if (!R2_BUCKET_NAME || !R2_PUBLIC_BASE_URL) {
      return NextResponse.json(
        { error: 'R2_BUCKET_NAME or R2_PUBLIC_BASE_URL is missing' },
        { status: 500 },
      );
    }

    const client = getR2Client();
    const objects = [];
    let continuationToken: string | undefined;

    do {
      const response = await client.send(
        new ListObjectsV2Command({
          Bucket: R2_BUCKET_NAME,
          Prefix: MEMORY_IMAGES_PREFIX,
          ContinuationToken: continuationToken,
        }),
      );

      if (response.Contents?.length) {
        objects.push(...response.Contents);
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    const baseUrl = R2_PUBLIC_BASE_URL.replace(/\/+$/, '');
    const images = objects
      .filter((item) => item.Key && item.Size && item.Key.startsWith(MEMORY_IMAGES_PREFIX))
      .map((item) => ({
        key: item.Key as string,
        url: `${baseUrl}/${item.Key}`,
        size: item.Size as number,
        lastModified: item.LastModified?.toISOString() ?? null,
      }))
      .sort((a, b) => {
        if (!a.lastModified && !b.lastModified) return a.key.localeCompare(b.key);
        if (!a.lastModified) return 1;
        if (!b.lastModified) return -1;
        return b.lastModified.localeCompare(a.lastModified);
      });

    return NextResponse.json({ images });
  } catch (error) {
    console.error('R2 image listing failed:', error);
    return NextResponse.json({ error: 'Unable to list images' }, { status: 500 });
  }
}
