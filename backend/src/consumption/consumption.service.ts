import { Inject, Injectable, HttpException } from '@nestjs/common';
import { Pool } from 'pg';

export interface Consumption {
    id: string;
    propertyId: string;
    date: Date;
    type: string;
    amount: number;
    created_at?: Date;
}

import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ConsumptionService {
    constructor(
        @Inject('DATABASE_POOL') private pool: Pool,
        private readonly httpService: HttpService,
        private readonly configService: ConfigService
    ) { }

    private getAnalyticsUrl(): string {
        return this.configService.get<string>('ANALYTICS_SERVICE_URL') || 'http://localhost:8000';
    }

    async analyzeTrend(data: Consumption[]): Promise<any> {
        const payload = {
            data: data.map(d => ({ date: d.date.toISOString().split('T')[0], value: Number(d.amount) }))
        };
        try {
            const response = await firstValueFrom(this.httpService.post(`${this.getAnalyticsUrl()}/analytics/trend`, payload));
            return response.data;
        } catch (error) {
            const msg = error.response?.data?.detail || error.message;
            console.error('Analytics Trend Error:', msg);
            throw new HttpException(msg, error.response?.status || 500);
        }
    }

    async analyzeSpike(data: Consumption[]): Promise<any> {
        const payload = {
            data: data.map(d => ({ date: d.date.toISOString().split('T')[0], value: Number(d.amount) }))
        };
        try {
            const response = await firstValueFrom(this.httpService.post(`${this.getAnalyticsUrl()}/analytics/spike`, payload));
            return response.data;
        } catch (error) {
            const msg = error.response?.data?.detail || error.message;
            console.error('Analytics Spike Error:', msg);
            // Propagate the specific error (e.g. 400 Bad Request if not enough data)
            throw new HttpException(msg, error.response?.status || 500);
        }
    }

    async create(propertyId: string, date: Date, type: string, amount: number): Promise<Consumption> {
        try {
            const result = await this.pool.query(
                'INSERT INTO consumption (propertyId, date, type, amount) VALUES ($1, $2, $3, $4) RETURNING *',
                [propertyId, date, type, amount],
            );
            return result.rows[0];
        } catch (error) {
            console.error('Failed to create consumption record:', error);
            throw new HttpException('Failed to create consumption record. Please check inputs and database connection.', 500);
        }
    }

    async findAll(propertyId: string, from?: Date, to?: Date, type?: string, resolution: 'raw' | 'hour' | 'day' | 'month' = 'raw'): Promise<Consumption[]> {
        let query = '';
        const params: any[] = [propertyId];

        // Base Query construction
        if (resolution === 'raw') {
            query = 'SELECT * FROM consumption WHERE propertyId = $1';
        } else {
            // Aggregation Column Selection
            const dateCol = `date_trunc('${resolution}', date)`;
            const typeValue = type === 'combined' ? `'combined'` : 'type';
            query = `SELECT propertyId, ${dateCol} as date, ${typeValue} as type, SUM(amount) as amount FROM consumption WHERE propertyId = $1`;
        }

        // Date Filtering
        if (from) {
            params.push(from);
            query += ` AND date >= $${params.length}`;
        }
        if (to) {
            const toDate = new Date(to);
            toDate.setHours(23, 59, 59, 999);
            params.push(toDate);
            query += ` AND date <= $${params.length}`;
        }

        // Type Filtering
        // If type is 'combined' or 'both', we don't filter by type in WHERE unless we want to sum specific things?
        // 'combined' implies SUM of all types. 'both' implies distinct types.
        // If type is specific ('electric'), we filter.
        if (type && type !== 'both' && type !== 'combined') {
            params.push(type);
            query += ` AND type = $${params.length}`;
        }

        // Grouping (Aggregation)
        if (resolution !== 'raw') {
            const dateCol = `date_trunc('${resolution}', date)`;
            // If combined, we don't group by type (it's hardcoded to 'combined').
            // If both or specific, we group by type to keep them distinct.
            const groupBy = type === 'combined' ? `propertyId, ${dateCol}` : `propertyId, ${dateCol}, type`;
            query += ` GROUP BY ${groupBy}`;
        }

        query += ' ORDER BY date DESC';
        try {
            const result = await this.pool.query(query, params);
            return result.rows; // TODO: Map sum to number if PG returns string? standard pg behavior for SUM is often string.
        } catch (error) {
            console.error('Failed to retrieve consumption data:', error);
            throw new HttpException('Failed to retrieve consumption data.', 500);
        }
    }

    async exportToCsv(userId: string, from?: Date, to?: Date, type?: string, propertyId?: string): Promise<string> {
        let query = `
            SELECT c.date, p.name as property_name, c.type, c.amount
            FROM consumption c
            JOIN properties p ON c.propertyId = p.id
            WHERE p.userId = $1
        `;
        const params: any[] = [userId];

        // Property Filtering
        if (propertyId && propertyId !== 'all') {
            params.push(propertyId);
            query += ` AND c.propertyId = $${params.length}`;
        }

        if (from) {
            params.push(from);
            query += ` AND c.date >= $${params.length}`;
        }
        if (to) {
            const toDate = new Date(to);
            toDate.setHours(23, 59, 59, 999);
            params.push(toDate);
            query += ` AND c.date <= $${params.length}`;
        }

        if (type && type !== 'both' && type !== 'combined') {
            params.push(type);
            query += ` AND c.type = $${params.length}`;
        }

        // Aggregation for Export if 'combined'
        if (type === 'combined') {
            query = `
                SELECT date_trunc('day', c.date) as date, p.name as property_name, 'combined' as type, SUM(c.amount) as amount
                FROM consumption c
                JOIN properties p ON c.propertyId = p.id
                WHERE p.userId = $1
             `;

            // Re-apply filters for combined query
            let pIdx = 2;
            if (propertyId && propertyId !== 'all') query += ` AND c.propertyId = $${pIdx++}`;
            if (from) query += ` AND c.date >= $${pIdx++}`;
            if (to) query += ` AND c.date <= $${pIdx++}`;

            query += ` GROUP BY date_trunc('day', c.date), p.name`;
        }

        query += ` ORDER BY c.date DESC`;

        const result = await this.pool.query(query, params);

        if (result.rows.length === 0) {
            return 'Date,Property,Type,Amount\n';
        }

        const header = 'Date,Property,Type,Amount\n';
        const rows = result.rows.map(row =>
            `${new Date(row.date).toISOString().split('T')[0]},${row.property_name},${row.type},${row.amount}`
        ).join('\n');

        return header + rows;
    }
}
