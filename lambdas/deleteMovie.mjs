import { DynamoDBClient, GetItemCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const db = new DynamoDBClient({ region: process.env.AWS_REGION });
const s3 = new S3Client({ region: process.env.AWS_REGION });

export const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: '',
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { id } = body;

    if (!id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Movie ID is required" }),
      };
    }

    // Get movie item from DynamoDB
    const getResult = await db.send(new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: { id: { S: id } }
    }));

    if (!getResult.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Movie not found" }),
      };
    }

    const videoUrl = getResult.Item.videoUrl.S;
    const thumbnailUrl = getResult.Item.thumbnailUrl.S;

    // Helper to extract S3 key from URL
    const getKeyFromUrl = (url) => {
      try {
        const path = new URL(url).pathname;
        return path.startsWith("/") ? path.slice(1) : path;
      } catch {
        return url; // If not a valid URL, assume it's already a key
      }
    };

    // Delete video and thumbnail from S3
    if (videoUrl) {
      await s3.send(new DeleteObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: getKeyFromUrl(videoUrl)
      }));
    }

    if (thumbnailUrl) {
      await s3.send(new DeleteObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: getKeyFromUrl(thumbnailUrl)
      }));
    }

    // Delete movie record from DynamoDB
    await db.send(new DeleteItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: { id: { S: id } }
    }));

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: "Movie deleted successfully" }),
    };

  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to delete movie" }),
    };
  }
};
