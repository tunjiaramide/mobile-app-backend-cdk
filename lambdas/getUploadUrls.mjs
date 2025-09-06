import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

const s3 = new S3Client({ region: process.env.AWS_REGION });

export const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: '',
    };
  }

  const body = JSON.parse(event.body || "{}");
  const videoKey = `videos/${uuidv4()}-${body.videoFileName}`;
  const thumbnailKey = `thumbnails/${uuidv4()}-${body.thumbnailFileName}`;

  const videoUploadUrl = await getSignedUrl(s3, new PutObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: videoKey,
  }), { expiresIn: 300 });

  const thumbnailUploadUrl = await getSignedUrl(s3, new PutObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: thumbnailKey,
  }), { expiresIn: 300 });

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      videoUploadUrl,
      thumbnailUploadUrl,
      videoKey,
      thumbnailKey
    }),
  };
};
