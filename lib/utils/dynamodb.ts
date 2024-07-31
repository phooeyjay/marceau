import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { appsettings } from './common';

const db_client = () => DynamoDBDocument.from(new DynamoDBClient({
    apiVersion: appsettings('AWS_VERSION')
    , region: appsettings('AWS_REGION')
    , credentials: { secretAccessKey: appsettings('AWS_SECRET'), accessKeyId: appsettings('AWS_AUTHKEY') } 
}));