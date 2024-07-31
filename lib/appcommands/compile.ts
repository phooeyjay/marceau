import { ChatInputCommandInteraction } from 'discord.js';
import { APPCOMMAND_RESULT } from '../utils/logger';
import { throw_exception } from '../utils/common';
import * as mark from './hex/mark';
import * as pray from './hex/pray';
import * as mute from './mod/mute';

export const dataset = [mark.data, pray.data, mute.data].map(d => d.toJSON());
export const execute = async (i: ChatInputCommandInteraction): Promise<APPCOMMAND_RESULT> => {
    switch (i.commandName) {
        case 'mark': return mark.execute(i);
        case 'pray': return pray.execute(i);
        case 'mute': return mute.execute(i);
        default: return throw_exception(`Command [${i.commandName}] not implemented.`);
    }
}