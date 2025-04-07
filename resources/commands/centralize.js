import * as mute from './moderation/mute';
import * as pray from './hex/pray';
import * as mark from './hex/mark';

export const DATA_ARRAY = [mute.data.toJSON(), mark.data.toJSON(), pray.data.toJSON()];
export const EXECUTE_FN = {
    'mute': mute.execute,
    'mark': mark.execute,
    'pray': pray.execute
};