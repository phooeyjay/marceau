import { ChatInputCommandInteraction } from 'discord.js';
import { LOGGER, error } from '../utils';

import * as MARK from './hex/mark';
import * as PRAY from './hex/pray';
import * as MUTE from './mod/mute';

export const DATASET = [MARK.DATA, PRAY.DATA, MUTE.DATA].map(d => d.toJSON());
export const EXECUTE = (i: ChatInputCommandInteraction): Promise<LOGGER.SLASH_COMMAND_RESULT> => {
    switch (i.commandName) {
        case 'mark':    return MARK.exec(i);
        case 'pray':    return PRAY.exec(i);
        case 'mute':    return MUTE.exec(i);
        default:        return error('Command not implemented.');
    }
};