import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';

export interface Property {
    id: string;
    userId: string;
    name: string;
    location: string;
    created_at?: Date;
}

@Injectable()
export class PropertiesService {
    constructor(@Inject('DATABASE_POOL') private pool: Pool) { }

    async create(userId: string, name: string, location: string): Promise<Property> {
        const result = await this.pool.query(
            'INSERT INTO properties (userId, name, location) VALUES ($1, $2, $3) RETURNING *',
            [userId, name, location],
        );
        return result.rows[0];
    }

    async findAll(userId: string): Promise<Property[]> {
        const result = await this.pool.query(
            'SELECT * FROM properties WHERE userId = $1 ORDER BY created_at DESC',
            [userId],
        );
        return result.rows;
    }

    async findOne(id: string, userId: string): Promise<Property | undefined> {
        const result = await this.pool.query(
            'SELECT * FROM properties WHERE id = $1 AND userId = $2',
            [id, userId],
        );
        return result.rows[0];
    }
}
