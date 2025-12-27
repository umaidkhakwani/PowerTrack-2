import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { User } from './user.interface';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
    constructor(@Inject('DATABASE_POOL') private pool: Pool) { }

    async create(email: string, pass: string): Promise<User> {
        const hashedPassword = await bcrypt.hash(pass, 10);
        const result = await this.pool.query(
            'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, created_at',
            [email, hashedPassword],
        );
        return result.rows[0];
    }

    async findOne(email: string): Promise<User | undefined> {
        const result = await this.pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email],
        );
        return result.rows[0];
    }

    async findById(id: string): Promise<User | undefined> {
        const result = await this.pool.query(
            'SELECT id, email, created_at FROM users WHERE id = $1',
            [id]
        );
        return result.rows[0];
    }
}
