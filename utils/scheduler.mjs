import { Client, inlineCode } from 'discord.js';
import cron from 'node-cron';

import { basic_log } from './logger.mjs';
import { UTC8_TZ } from './constants.mjs';

export const initialize = (/** @type {Client} */ client) => {
    cron.schedule('0 0-23/6 * * *', _ => { 
        basic_log(`${inlineCode(client.user.username)} is active.`);
    }, { scheduled: true, timezone: UTC8_TZ, name: 'SYS_CLOCKIN' }); // report active status every 6 hours.
}
export const end = _ => cron.getTasks().forEach(task => task.stop());