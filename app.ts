(async () => {
    (await import('./res/login')).login(process.env.DEBUG && 'invisible' || 'online');
})();