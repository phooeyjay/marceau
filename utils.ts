import { ChatInputCommandInteraction, WebhookClient, channelMention, codeBlock, inlineCode } from 'discord.js';
import { webcrypto as wc } from 'node:crypto';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

//#region MODULE-LESS
/** 
 * - An `Error` will be reduced to the first 2 lines of the stack trace. 
 * - An `Object` or `Array` will rely on the JSON.stringify method. 
 * - Otherwise, string interpolation will be performed.
 */
export const stringify = (a: any) => a instanceof Error ? (a.stack?.split('\n').map(s => s.trim()).slice(0, 2).join(' ') || 'ERR_EMPTY') : typeof a !== 'object' ? `${a}` : JSON.stringify(a);

export const throwexc = (e: string | Error) => { throw e instanceof Error ? e : Error(e); }

/** Uint8Array randomized between 0 ~ 255. Division with 256 to ensure number between 0 (inclusive) and 1 (exclusive). */
export const arbitrary = (sz?: number) => Array.from(wc.getRandomValues(new Uint8Array(sz = Math.max(sz ?? 0, 1))), n => n / 256);

/** Current datetime as a string, which follows the format `dd/mm/yyyy, hh:mm:ss TZ`  */
export const timestamp = () => new Date().toLocaleString('en-GB', { timeZone: 'Asia/Singapore', timeZoneName: 'shortOffset' });
//#endregion

//#region LOGGER
export module Logger {
    const api = new WebhookClient({ url: 'https://discord.com/api/webhooks/1103945700141699142/s_u94Gm8OJej36OO_NGbsMpZF0uKv_TchsDNdRnSp2imxHaaQk_cnTvl2hRRHBcUeBsV' });
    export const cmdl = (...data: any[]) => console.log(timestamp(), '\u00A0\u00A0', ...(data.map(stringify)));
    export const write = (a: any) => {
        (async str => {
            try {
                await api.send({ content: `${inlineCode(timestamp())} \u00A0\u00A0 ${str}` })
            } catch (e) { Logger.cmdl(e, '\n--------------------\n', str); }
        })(stringify(a));
    };
    export const command = (i: ChatInputCommandInteraction, err?: any) => {
        (async (s, ex) => {
            try {
                await api.send({ content: `${inlineCode(timestamp())} \u00A0\u00A0 ${inlineCode(i.user.username)} ▸ ${inlineCode(i.commandName)} ▸ ${channelMention(i.channelId)}${!s ? codeBlock(err) : ''}` });
            } catch (e) { Logger.cmdl(e, !s ? `\n--------------------\n${ex}` : ''); }
        })(!err, err ? stringify(err) : 'NO_ERR');
    }
}
//#endregion

//#region DYNAMODB
export module DB {
    type RegisteredSchema = 'UserProfile' | 'Markend';
    type UpdateExpression = ['SET' | 'ADD' | 'DELETE' | 'REMOVE', attribute: string, value?: string];
    const connect = () => DynamoDBDocument.from(new DynamoDB({ 
        apiVersion: process.env.APIVER,
        region: process.env.REGION,
        credentials: { secretAccessKey: process.env.SECRET!, accessKeyId: process.env.ACCKEY! }
    }));
    export const table = (schema: RegisteredSchema) => (connection => {
        return {
            get: async (key: Record<string, any>, columns?: string[]) => {
                try {
                    return (await connection.get({
                        TableName: schema,
                        Key: key,
                        ProjectionExpression: columns?.join(', ')
                    })).Item || null;
                } catch (ex) { Logger.write(ex); return null; }
            },
            put: async (key: Record<string, any>, updates: UpdateExpression[]) => {
                try {
                    const mappedString = updates.map(([o, a, v]) => o === 'REMOVE' ? `${o} ${a}` : o === 'SET' ? `${o} ${a} = ${v}` : `${o} ${a} ${v}`).join(', ');
                    return (await connection.update({
                        TableName: schema,
                        Key: key,
                        UpdateExpression: mappedString,
                        ReturnValues: 'UPDATED_NEW'
                    })).Attributes !== undefined;
                } catch (ex) { Logger.write(ex); return false; }
            }
        }
    })(connect());
}
//#endregion