import { Client, PresenceStatusData, TextChannel, inlineCode } from 'discord.js';
import { CronJob } from 'cron';
import { DBXC, LOG, throwexc, getenv } from './utils';
import { DATASET, EXECUTE } from './slash';

export const login = async (presence: PresenceStatusData) => {
    const client = new Client({
        intents:    [ 'Guilds', 'GuildMembers', 'GuildMessages', 'GuildMessageReactions' ],
        presence:   { status: presence }
    });
    const logout = async () => { await client.destroy(); process.exit(1); };

    //#region EVENT LISTENERS
    client.once('ready', async sys => {
        try {
            await sys.rest.put(`/applications/${getenv('APP_IDENTIFIER')}/commands`, { body: DATASET });
            LOG.cmdl(`READY: ${sys.user.username}`);
        } catch (ex) { LOG.cmdl(ex); await logout(); }
    });
    client.on('interactionCreate', async i => {
        if (i.isChatInputCommand()) {
            try {
                LOG.interaction(i, await EXECUTE(i));
            } catch (ex) {
                const response = await (async apology => {
                    if (i.replied || i.deferred) {
                        await i.deleteReply();
                        return await (i.channel as TextChannel).send(apology);
                    } else return await i.reply({ fetchReply: true, content: apology });
                })(getenv('GENERIC_ERROR', '🙇‍♂️'));
                LOG.interaction(i, ['error', response, ex]);
            }
        }
    });
    client.on('guildMemberRemove', async member => LOG.text(`${inlineCode(member.user.username || member.user.tag)} has left the server.`));
    ['SIGINT', 'SIGTERM'].forEach(sig => process.on(sig, async () => { LOG.cmdl('EXIT.'); await logout(); }));
    //#endregion

    //#region CRONJOB
    (tz => {
        CronJob.from({
            timeZone: tz
            , cronTime: '0 0 1 * * *'
            , onTick: async () => await DBXC.sync_users(client)
        }).start();
    })(getenv('LOCAL_TZ', 'UTC'));
    //#endregion

    await client.login(getenv('APP_AUTHTOKEN', false));
};