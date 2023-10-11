import { ExtendedClient } from './client';
import dotenv from 'dotenv';

dotenv.config();
(async () => await ExtendedClient.initialize().login(process.env.TOKEN))();