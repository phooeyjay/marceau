import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { get_env } from './misc';

const API = DynamoDBDocument.from(new DynamoDBClient({ 
    apiVersion:     get_env('AWS_VERSION', false)
    , region:       get_env('AWS_REGION', false)
    , credentials:  { secretAccessKey: get_env('AWS_SECRET', false), accessKeyId: get_env('AWS_AUTHKEY', false) } 
}));

//#region BLUEPRINT METHODS
const fetch = async <R extends Record<string, unknown> = never>(from: string, key: Record<string, string | number>) => {
    const response = await API.get({ TableName: from, Key: key, ConsistentRead: true });
    return response.Item ? response.Item as R : null;
};
const where = async <R extends Record<string, unknown> = never>(from: string, op: '=' | '<>' | '>' | '>=' | '<' | '<=', path: string, value: unknown) => {
    const filter = `${path} ${op} ${JSON.stringify(value)}`;
    const response = await API.query({ TableName: from, FilterExpression: filter, ConsistentRead: true });
    return response.Items ? response.Items.map(r => r as R) : null;
};
const amend = async <T extends string = never>(from: T, key: Record<string, string | number>, op: 'SET' | 'ADD' | 'DELETE', ...kv: Array<[string, string | number | boolean | object]>) => {
    const stmt = `${op} ` + kv.map(([k, v]) => k + (op === 'SET' ? ' = ' : ' ') + JSON.stringify(v));
    const response = await API.update({ TableName: from, Key: key, UpdateExpression: stmt, ReturnValues: 'UPDATED_NEW' });
    return response.Attributes && Object.keys(response.Attributes).length > 0;
};
//#endregion