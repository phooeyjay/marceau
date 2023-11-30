import { ChatInputCommandInteraction, WebhookClient, channelMention, codeBlock, inlineCode } from 'discord.js';
import { webcrypto as wc } from 'node:crypto';

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
export module DynamoDB {
    type RegisteredSchema = 'UserProfile' | 'Markend';
    
}
// type TableName = 'Member' | undefined;
// export abstract class DB {
//     static Connection = class implements Disposable {
//         private _ct = new DynamoDB({ 
//             apiVersion: process.env.APIVER, 
//             region: process.env.REGION, 
//             credentials: { secretAccessKey: process.env.SECRET || throwexc('[env.SECRET] undefined.'), accessKeyId: process.env.ACCKEY || throwexc('[env.ACCKEY] undefined.') } 
//         });
//         dt = DynamoDBDocument.from(this._ct);
//         [Symbol.dispose] = () => [this.dt, this._ct].forEach(asset => asset.destroy());
//     }

//     static fetch = async (t: TableName, k: Record<string, any>) => {
//         try {
//             return (await (new DB.Connection()).dt.get({ 
//                 TableName: t, 
//                 Key: k, 
//                 ConsistentRead: true 
//             })).Item;
//         } catch (err) { Logger.plaintext(err); return undefined; }
//     };
//     static insert = async (t: TableName, item: Record<string, any>) => {
//         try {
//             return (await (new DB.Connection()).dt.put({
//                 TableName: t,
//                 Item: item,
//                 ReturnValues: 'UPDATED_NEW'
//             }))?.Attributes !== undefined
//         } catch (err) { Logger.plaintext(err); return false; }
//     };
//     static update = async (t: TableName, key: Record<string, any>, updates: { [attribute: string]: { Action: 'ADD' | 'PUT' | 'DELETE', Value: any } }, condition: string ) => {
//         try {
//             return (await (new DB.Connection()).dt.update({
//                 TableName: t,
//                 Key: key,
//                 AttributeUpdates: updates,
//                 ConditionExpression: condition,
//                 ReturnValues: 'UPDATED_NEW'
//             }))?.Attributes !== undefined;
//         } catch (err) { Logger.plaintext(err); return false; }
//     };
// }
//#endregion