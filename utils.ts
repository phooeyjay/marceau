import { BaseInteraction, Collection, WebhookClient, codeBlock, inlineCode } from 'discord.js';
import { webcrypto as wc, randomBytes } from 'node:crypto';
import { CronJob, CronCommand } from 'cron';
import { TZ_GMT8 } from './constants';

//#region MISCELLANEOUS FUNCTIONS
/** 
 * - An `Error` will be reduced to the first 2 lines of the stack trace. 
 * - An `Object` or `Array` will rely on the JSON.stringify method. 
 * - Otherwise, the value will be forcibly converted into a string by concatenating an empty string. 
 */
export const text = (a: any) => a instanceof Error && (a.stack || '') || typeof a !== 'object' && a + '' || JSON.stringify(a, a instanceof Array && undefined || Object.getOwnPropertyNames(a));

/** Current time as a localized string. */
export const time = () => new Date().toLocaleString('en-GB', { timeZone: TZ_GMT8, timeZoneName: 'short', year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: 'numeric' });

/** Uint8Array randomized between 0 ~ 255. Division with 256 to ensure number between 0 (inclusive) and 1 (exclusive). */
export const random = ((sz?: number) => {
    const arr = Array.from(wc.getRandomValues(new Uint8Array(sz && Math.max(sz, 1) || 1)), n => n / 256);
    return (sz && sz > 1) && arr || arr[0];
}) as (() => number) & ((sz: number) => number & number[]);

/** Generates a 6-character randomized character string. */
export const randstr = () => randomBytes(3).toString('hex');

export const throwexc = (s: string) => { throw Error(s) };
//#endregion

//#region LOGGER FUNCTIONS
const logger = new WebhookClient({ url: 'https://discord.com/api/webhooks/1103945700141699142/s_u94Gm8OJej36OO_NGbsMpZF0uKv_TchsDNdRnSp2imxHaaQk_cnTvl2hRRHBcUeBsV' });
export const Logger = {
    console: (...parts: any[]) => console.log(time(), '\u00A0\u00A0', ...(parts.map(text))), // tabspace simulation

    basic: (a: any) => {
        (async () => {
            try {
                await logger.send({ content: `${inlineCode(time())} 📝 ${a = text(a)}` });
            } catch (e) { Logger.console('[Logger.basic] error:', e); Logger.console(a); }
        })();
    },

    interact: (i: BaseInteraction, err?: any) => {
        (async () => {
            try {
                const data = {
                    name: i.isChatInputCommand() && i.commandName || i.isMessageComponent() && i.customId || 'NO_IDENT',
                    url: i.isChatInputCommand() && i.replied && (await i.fetchReply()).url || i.isMessageComponent() && i.message.url || 'NO_URL'
                }
                , header = `${inlineCode(time())} ${err === undefined && '🆗' || '🆘'} ${i.user.username} triggered ${inlineCode(data.name)} ${data.url}`
                , errbox = err !== undefined && text(err) || undefined;
                await logger.send({ content: header + (errbox && `\n${codeBlock(errbox)}` || ''), allowedMentions: { users: [] } });
            } catch (e) { Logger.console('[Logger.interaction] error:', e); e && Logger.console(err) || {}; }
        })();
    }
}
//#endregion

//#region SCHEDULER FUNCTIONS
const tasks = new Collection<string, CronJob>();
export const Scheduler = {
    /** Launch a periodic `task` if the `when` paramater is specified a _string_ (in which case an `ident` is required), or a run-once job if a _Date_ is provided instead. */
    launch: (when: string | Date, task: CronCommand, ident?: string) => {
        (job => {
            if (typeof when === 'string') {
                ident && (!tasks.has(ident) && tasks.set(ident, job) || Logger.basic(`Unable to re-assign an existing identity [${ident}].`)) || Logger.basic('Unable to create a recurring task without a valid identity.');
            }
            job.start();
        })(new CronJob(when, task, null, false, TZ_GMT8));
    },

    halt: (ident?: string) => tasks.filter((_, i) => ident && i === ident || true).map(v => v).forEach(task => task.stop())
}
//#endregion
