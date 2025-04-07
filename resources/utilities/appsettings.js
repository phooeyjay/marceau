import 'dotenv/config';

//#region application setttings
export const GENERIC_ERROR_MESSAGE = process.env.GENERIC_ERROR_MESSAGE || 'Something went wrong, please retry!';
export const APPLICATION_LOGGER_URL = process.env.APPLICATION_LOGGER_URL || '/* NO URL */';
export const APPLICATION_TOKEN = process.env.APPLICATION_TOKEN || '/* NO TOKEN */';
export const DEBUG_MODE = process.env.DEBUG_MODE  || 'true';

/** @type {[DEATH: string, SCARL: string, KISMT: string, SHADE: string]} */
export const HEX_SEQUENCE = [
    process.env.HEX_DEATH || '0A',
    process.env.HEX_SCARL || '0B',
    process.env.HEX_KISMT || '0C',
    process.env.HEX_SHADE || '0D'
];
export const HEX_CURSEMARKED = process.env.HEX_CURSEMARKED || '0E';
export const HEX_AUDIENCE = process.env.HEX_AUDIENCE || '0F';
export const HEX_AVENGER = process.env.HEX_AVENGER || '0G';
//#endregion