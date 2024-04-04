import { get_env } from '../../utils';

export const HEX_SEQUENCE: [death: string, scarlet: string, kismet: string, shade: string] = [get_env('HEX_DEATH'), get_env('HEX_SCARL'), get_env('HEX_KISMT'), get_env('HEX_SHADE')]
, HEX_GROUPER = get_env('HEX_GROUPER')
, HEX_MURDIST = get_env('HEX_MURDIST')
, HEX_AVENGER = get_env('HEX_AVENGER');

/** Defined 2-min timeframe. */ 
export const PERIOD_MS = 120_000;
export const CHOICES: [yes: string, no: string] = ['💀', '😇'];

export const indirect_hex = (t: string) => t === HEX_SEQUENCE[1] || t === HEX_SEQUENCE[2];