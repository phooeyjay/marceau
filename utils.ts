import { 
    ChatInputCommandInteraction
    , Collection
    , WebhookClient
    , channelMention, codeBlock, inlineCode 
} from 'discord.js';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { webcrypto as wc } from 'node:crypto';
import { CronJob, CronCommand } from 'cron';
import { TZ_GMT8 } from './constants';

//#region MODULE-LESS FUNCTIONS
/** 
 * - An `Error` will be reduced to the first 2 lines of the stack trace. 
 * - An `Object` or `Array` will rely on the JSON.stringify method. 
 * - Otherwise, the value will be forcibly converted into a string by concatenating an empty string. 
 */
export const stringify = (a: any) => a instanceof Error ? (a.stack || 'UNKNOWN_ERR') : typeof a !== 'object' ? a + '' : JSON.stringify(a);

/** Current datetime as a string, which follows the format `dd/mm/yyyy, hh:mm:ss TZ`  */
export const timestamp = () => new Date().toLocaleString('en-GB', { timeZone: TZ_GMT8, timeZoneName: 'shortOffset' });

/** Uint8Array randomized between 0 ~ 255. Division with 256 to ensure number between 0 (inclusive) and 1 (exclusive). */
export const arbit = (sz?: number) => Array.from(wc.getRandomValues(new Uint8Array(sz = Math.max(sz ?? 0, 1))), n => n / 256);

export const throwexc = (s: string) => { throw Error(s) };
//#endregion

//#region LOGGER
export abstract class Logger {
    private static readonly _wh = new WebhookClient({ url: 'https://discord.com/api/webhooks/1103945700141699142/s_u94Gm8OJej36OO_NGbsMpZF0uKv_TchsDNdRnSp2imxHaaQk_cnTvl2hRRHBcUeBsV' });

    static cli = (...data: any[]) => console.log(timestamp(), '\u00A0\u00A0', ...(data.map(stringify)));
    static plaintext = (a: any) => {
        (async str => {
            try {
                await this._wh.send({ content: `${inlineCode(timestamp())} \u00A0\u00A0 ${str}` });
            } catch (e) { Logger.cli('[Logger.basic] error:', e, '\n--------------------\n', str); }
        })(stringify(a));
    };
    static command = (i: ChatInputCommandInteraction, exc?: any) => {
        (async (failed, err) => {
            try {
                await this._wh.send({ content: `${inlineCode(timestamp())} \u00A0\u00A0 ${inlineCode(i.user.username)} called ${inlineCode(i.commandName)} in ${channelMention(i.channelId)} ${failed ? codeBlock(err) : ''}` });
            } catch (e) { Logger.cli('[Logger.interaction] error:', e, failed ? `\n--------------------\n${err}` : ''); }
        })(exc !== undefined, exc ? stringify(exc) : 'NO_ERR');
    };
}
//#endregion

//#region SCHEDULER
export abstract class Scheduler {
    static readonly tasks = new Collection<string, CronJob>();

    /** Launch a periodic `task` if the `when` paramater is specified a _string_ (in which case an `ident` is required), or a run-once job if a _Date_ is provided instead. */
    static launch = (when: string | Date, task: CronCommand, ident: string | undefined) => {
        (job => {
            if (typeof when === 'string') {
                ident && (!Scheduler.tasks.has(ident) ? Scheduler.tasks.set(ident, job) : Logger.plaintext(`Unable to re-assign an existing identity [${ident}].`)) || Logger.plaintext('Cannot launch recurring task without a valid [ident].');
            }
            job.start();
        })(new CronJob(when, task, null, false, TZ_GMT8));
    };
    static halt = (ident?: string) => Scheduler.tasks.filter((_, i) => ident && i === ident || true).map(v => v).forEach(task => task.stop());
}
//#endregion

//#region DYNAMODB
type TableName = 'Member' | undefined;
export abstract class DB {
    static Connection = class implements Disposable {
        private _ct = new DynamoDB({ 
            apiVersion: process.env.APIVER, 
            region: process.env.REGION, 
            credentials: { secretAccessKey: process.env.SECRET || throwexc('[env.SECRET] undefined.'), accessKeyId: process.env.ACCKEY || throwexc('[env.ACCKEY] undefined.') } 
        });
        dt = DynamoDBDocument.from(this._ct);
        [Symbol.dispose] = () => [this.dt, this._ct].forEach(asset => asset.destroy());
    }

    static fetch = async (t: TableName, k: Record<string, any>) => {
        try {
            return (await (new DB.Connection()).dt.get({ 
                TableName: t, 
                Key: k, 
                ConsistentRead: true 
            })).Item;
        } catch (err) { Logger.plaintext(err); return undefined; }
    };
    static insert = async (t: TableName, item: Record<string, any>) => {
        try {
            return (await (new DB.Connection()).dt.put({
                TableName: t,
                Item: item,
                ReturnValues: 'UPDATED_NEW'
            }))?.Attributes !== undefined
        } catch (err) { Logger.plaintext(err); return false; }
    };
    static update = async (t: TableName, key: Record<string, any>, updates: { [attribute: string]: { Action: 'ADD' | 'PUT' | 'DELETE', Value: any } }, condition: string ) => {
        try {
            return (await (new DB.Connection()).dt.update({
                TableName: t,
                Key: key,
                AttributeUpdates: updates,
                ConditionExpression: condition,
                ReturnValues: 'UPDATED_NEW'
            }))?.Attributes !== undefined;
        } catch (err) { Logger.plaintext(err); return false; }
    };
}
//#endregion