import { ExtendedClient } from './client';
import dotenv from 'dotenv';

declare global { 
    var noStack: boolean;
    var dClient: ExtendedClient;
}

dotenv.config();
(async () => await (global.dClient = ExtendedClient.initialize()).login(process.env.TOKEN))();