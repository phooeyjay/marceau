import cron from 'cron';
import { webcrypto as wc } from 'node:crypto';
import { BaseInteraction, Collection, WebhookClient, codeBlock, inlineCode } from 'discord.js';
import { TZ_GMT8 } from './constants.js';

//#region COMMON FUNCTIONS
export const Common = {
    /** 
     * - An `Error` will be reduced to the first 2 lines of the stack trace. 
     * - An `Object` or `Array` will rely on the JSON.stringify method. 
     * - Otherwise, the value will be forcibly converted into a string by concatenating an empty string. 
     */
    stringify: a => a instanceof Error && a.stack.split('\n').splice(0,2).join(' ') || typeof a !== 'object' && a + '' || JSON.stringify(a, a instanceof Array && undefined || Object.getOwnPropertyNames(a)),

    time: () => new Date().toLocaleString('en-GB', { timeZone: TZ_GMT8, timeZoneName: 'short', year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: 'numeric' }),

    /** Uint8Array randomized between 0 and 255. Map function triggers division to ensure number between 0 (inclusive) and 1 (exclusive). */
    random: (size = 1) => Array.from(wc.getRandomValues(new Uint8Array(size)), n => n / 256),
}
//#endregion

//#region LOGGER FUNCTIONS
const logger = new WebhookClient({ url: 'https://discord.com/api/webhooks/1103945700141699142/s_u94Gm8OJej36OO_NGbsMpZF0uKv_TchsDNdRnSp2imxHaaQk_cnTvl2hRRHBcUeBsV' });
export const Logger = {
    console: (...parts) => console.log(Common.time(), '\u00A0\u00A0', ...(parts.map(Common.stringify))), // \u00A0 helps to simulate a tabspace in this context.
    
    basic: content => {
        (async () => {
            try {
                await logger.send({ content: `${inlineCode(Common.time())} 📝 ${content = Common.stringify(content)}` });
            }
            catch (e) { Logger.console('[Logger.basic] error:', e); Logger.console(content); }
        })();
    },

    interaction: (/** @type {BaseInteraction} */ i, err) => {
        (async () => {
            try {
                const data = {
                    name: i.isChatInputCommand() && i.commandName || i.isMessageComponent() && i.customId || 'NO_IDENT',
                    url: i.isChatInputCommand() && i.replied && (await i.fetchReply()).url || i.isMessageComponent() && i.message.url || 'NO_URL'
                }
                , header = `${inlineCode(Common.time())} ${err === undefined && '🆗' || '🆘'} ${i.user.username} triggered ${inlineCode(data.name)} ${data.url}`
                , errbox = err && Common.stringify(err) || undefined;
                await logger.send({ content: header + (errbox && `\n${codeBlock(errbox)}` || ''), allowedMentions: { users: [] } });
            }
            catch (e) { Logger.console('[Logger.interaction] error:', e); e && Logger.console(err) || {}; }
        })();
    }
}
//#endregion

//#region SCHEDULER FUNCTIONS
/** @type {Collection<string, cron.CronJob>} */ const task_list = new Collection();
export const Scheduler = {
    /**
     * @param {String | Date} when `crontime` or Javascript's `Date` syntax.
     * @param {cron.CronCommand} task Function to run according based on `when`.
     * @param {string} [ident = undefined] Identity of the job if run periodically.
     */
    launch: (when, task, ident) => {
        if (typeof when === 'string') ident && !task_list.has(ident) && task_list.set(ident, new cron.CronJob(when, task, null, true, TZ_GMT8)) || (() => { throw Error('Identity undefined or exists.') })();
        else new cron.CronJob(when, task, null, true, TZ_GMT8);
    },
    /** Without an identity, the method will cease all recurring tasks. */
    halt: (ident = '') => ident && (task_list.get(ident)).stop() || task_list.each(t => t.stop())
}
//#endregion