import { ExtendedClient } from './client';
import dotenv from 'dotenv';

dotenv.config({ path: __dirname + '/.env' });
(async () => await ExtendedClient.initialize().login(process.env.TOKEN))();