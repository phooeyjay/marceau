import { ExtendedClient } from './client';
import dotenv from 'dotenv';

declare global { 
    var blMarkOngoing: boolean;
    var oClient: ExtendedClient;
}

dotenv.config();
(async () => await (global.oClient = ExtendedClient.initialize()).login(process.env.TOKEN))();