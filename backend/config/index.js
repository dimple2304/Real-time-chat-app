import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const {
    DB_PASSWORD,
    DB_CONNECTION_STRING,
    PORT,
    EMAIL_USER,
    EMAIL_PASS,
    JWT_SECRET,
    JWT_EXPIRES_IN

} = process.env;
