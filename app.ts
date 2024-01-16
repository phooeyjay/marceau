(async () => {
    (await import('./res/login')).login(process.env.DEBUG_MODE === 'true' && 'invisible' || 'online');
})();