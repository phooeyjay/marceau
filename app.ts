import { getenv } from './res/utils';
(async () => {
    (await import('./res/login')).login(getenv('DEBUG_MODE') === 'true' && 'invisible' || 'online');
})();