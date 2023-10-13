import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { Logger, throwexc } from './utils';

class Connection implements Disposable {
    private ct = new DynamoDB({ 
        apiVersion: process.env.APIVER, 
        region: process.env.REGION, 
        credentials: { secretAccessKey: process.env.SECRET || throwexc('[env.SECRET] undefined.'), accessKeyId: process.env.ACCKEY || throwexc('[env.ACCKEY] undefined.') } 
    });
    dt = DynamoDBDocument.from(this.ct);
    [Symbol.dispose](): void { this.dt.destroy(); this.ct.destroy(); }
}
type TableName = 'Member';

export const fetchItem = async (t: TableName, key: Record<string, any>) => {
    try {
        return (await (new Connection()).dt.get({ 
            TableName: t, 
            Key: key, 
            ConsistentRead: true 
        })).Item;
    } catch (err) { Logger.basic(err); return undefined; }
};

export const insertItem = async (t: TableName, item: Record<string, any>) => {
    try {
        return (await (new Connection()).dt.put({
            TableName: t,
            Item: item,
            ReturnValues: 'UPDATED_NEW'
        }))?.Attributes !== undefined
    } catch (err) { Logger.basic(err); return false; }
};

export const updateItem = async (t: TableName, key: Record<string, any>, updates: { [attribute: string]: { Action: 'ADD' | 'PUT' | 'DELETE', Value: any } }, condition: string ) => {
    try {
        return (await (new Connection()).dt.update({
            TableName: t,
            Key: key,
            AttributeUpdates: updates,
            ConditionExpression: condition,
            ReturnValues: 'UPDATED_NEW'
        }))?.Attributes !== undefined;
    } catch (err) { Logger.basic(err); return false; }
};