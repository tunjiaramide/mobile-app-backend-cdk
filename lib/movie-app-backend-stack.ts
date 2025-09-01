import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export class MovieAppBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket
    const uploadsBucket = new s3.Bucket(this, 'MovieAppUploads', {
      bucketName: 'movie-app-uploads',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.PUT,
            s3.HttpMethods.GET,
          ],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    });

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, 'MovieAppDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(uploadsBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
    });

    // DynamoDB Table
    const moviesTable = new dynamodb.Table(this, 'MoviesTable', {
      tableName: 'Movies',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda Role
    const lambdaRole = new iam.Role(this, 'LambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    lambdaRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'));
    uploadsBucket.grantReadWrite(lambdaRole);
    moviesTable.grantReadWriteData(lambdaRole);

    // Lambdas from /lambdas folder
    const getUploadUrlsLambda = new lambda.Function(this, 'GetUploadUrlsLambda', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'getUploadUrls.handler',
      code: lambda.Code.fromAsset('lambdas' ),
      role: lambdaRole,
      environment: {
        BUCKET_NAME: uploadsBucket.bucketName,
      },
    });

    const saveMovieLambda = new lambda.Function(this, 'SaveMovieLambda', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'saveMovie.handler',
      code: lambda.Code.fromAsset('lambdas'),
      role: lambdaRole,
      environment: {
        TABLE_NAME: moviesTable.tableName,
      },
    });

    const getMoviesLambda = new lambda.Function(this, 'GetMoviesLambda', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'getMovies.handler',
      code: lambda.Code.fromAsset('lambdas'),
      role: lambdaRole,
      environment: {
        TABLE_NAME: moviesTable.tableName,
        CLOUDFRONT_DOMAIN: distribution.domainName,
      },
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'MovieAppApi', {
      restApiName: 'Movie App API',
    });

    api.root.addResource('upload-urls').addMethod('POST', new apigateway.LambdaIntegration(getUploadUrlsLambda));
    const moviesResource = api.root.addResource('movies');
    moviesResource.addMethod('POST', new apigateway.LambdaIntegration(saveMovieLambda));
    moviesResource.addMethod('GET', new apigateway.LambdaIntegration(getMoviesLambda));

    // Outputs
    new cdk.CfnOutput(this, 'CloudFrontURL', { value: distribution.domainName });
    new cdk.CfnOutput(this, 'ApiEndpoint', { value: api.url });
  }
}
