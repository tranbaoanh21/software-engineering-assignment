import { createApp } from './create-app.js';
import { SETTINGS, type Settings } from './config/settings.js';

const app = await createApp();
app.enableShutdownHooks();
const settings = app.get<Settings>(SETTINGS);
await app.listen(settings.port, process.env.API_HOST ?? '127.0.0.1');
