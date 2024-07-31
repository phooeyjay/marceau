import { appsettings } from '../../utils/common';

export const period_in_msec = 120_000;

export const hex_yn: [guilty: string, inno: string] = ['💀', '😇'];
export const hex_marks: [death: string, scarlet: string, kismet: string, shade: string] = [appsettings('HEX_DEATH'), appsettings('HEX_SCARL'), appsettings('HEX_KISMT'), appsettings('HEX_SHADE')];
export const hex_categories: [parent_group: string, murdist_court: string, avenger: string] = [appsettings('HEX_GROUPER'), appsettings('HEX_MURDIST'), appsettings('HEX_AVENGER')];

export const can_indirect_hex = (state: string) => state === hex_marks[1] || state === hex_marks[2];