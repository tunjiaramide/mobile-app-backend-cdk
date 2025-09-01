import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { v4 as uuidv4 } from "uuid";

const db = new DynamoDBClient({ region: process.env.AWS_REGION });

export const handler = async (event) => {
  const body = JSON.parse(event.body || "{}");

  const id = uuidv4();

  await db.send(new PutItemCommand({
    TableName: process.env.TABLE_NAME,
    Item: {
      id: { S: id },
      title: { S: body.title },
      videoUrl: { S: body.videoUrl },
      thumbnailUrl: { S: body.thumbnailUrl },
      uploadedAt: { S: new Date().toISOString() },
      metadata: { S: JSON.stringify(body.metadata || {}) }
    }
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Movie added successfully" }),
  };
};
