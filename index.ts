import { login } from './client';
import dotenv from 'dotenv';

//#region Global variables
declare global { 
    var bCursePend: boolean;
}
//#endregion

dotenv.config();
//(async () => await (global.oClient = ExtendedClient.initialize()).login(process.env.TOKEN))();