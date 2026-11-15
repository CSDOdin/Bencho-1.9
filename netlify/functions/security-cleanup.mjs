import { cleanupExpired } from '../lib/security.mjs';
export const config = { schedule: '17 * * * *' };
export default async () => { const result=await cleanupExpired(); console.log(JSON.stringify(result)); };

