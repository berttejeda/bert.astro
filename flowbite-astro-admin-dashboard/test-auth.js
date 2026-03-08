import { loadEnv } from 'vite';
const env = loadEnv('', process.cwd(), '');
console.log("AUTHELIA_URL:", env.AUTHELIA_URL);
