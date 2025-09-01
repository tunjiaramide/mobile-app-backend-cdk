import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";

const db = new DynamoDBClient({ region: process.env.AWS_REGION });

const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN;

export const handler = async () => {
  const data = await db.send(new ScanCommand({ TableName: process.env.TABLE_NAME }));
  const movies = data.Items?.map(item => ({
    id: item.id.S,
    title: item.title.S,
    videoUrl: `https://${CLOUDFRONT_DOMAIN}/${item.videoUrl.S}`,
    thumbnailUrl: `https://${CLOUDFRONT_DOMAIN}/${item.thumbnailUrl.S}`,
    uploadedAt: item.uploadedAt.S,
    metadata: item.metadata?.S ? JSON.parse(item.metadata.S) : {}
  }));

  return {
    statusCode: 200,
    body: JSON.stringify(movies),
  };
};
