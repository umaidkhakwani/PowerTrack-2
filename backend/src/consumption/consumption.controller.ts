import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ConsumptionService } from './consumption.service';
import { AuthGuard } from '@nestjs/passport';
import { IsDateString, IsNotEmpty, IsNumber, IsString, IsUUID, IsOptional } from 'class-validator';

class CreateConsumptionDto {
    @IsNotEmpty()
    @IsUUID()
    propertyId: string;

    @IsNotEmpty()
    @IsDateString()
    date: string;

    @IsNotEmpty()
    @IsString()
    type: string;

    @IsNotEmpty()
    @IsNumber()
    amount: number;
}

class ExportConsumptionDto {
    @IsOptional()
    @IsDateString()
    from?: string;

    @IsOptional()
    @IsDateString()
    to?: string;

    @IsOptional()
    @IsString()
    type?: string;

    @IsOptional()
    @IsString()
    propertyId?: string;
}

@UseGuards(AuthGuard('jwt'))
@Controller('consumption')
export class ConsumptionController {
    constructor(private readonly consumptionService: ConsumptionService) { }

    @Post()
    create(@Body() dto: CreateConsumptionDto) {
        return this.consumptionService.create(
            dto.propertyId,
            new Date(dto.date),
            dto.type,
            dto.amount,
        );
    }

    @Get()
    findAll(
        @Query('propertyId') propertyId: string,
        @Query('from') from?: string,
        @Query('to') to?: string,
        @Query('type') type?: string,
        @Query('resolution') resolution?: 'raw' | 'hour' | 'day' | 'month',
    ) {
        return this.consumptionService.findAll(
            propertyId,
            from ? new Date(from) : undefined,
            to ? new Date(to) : undefined,
            type,
            resolution,
        );
    }

    @Post('export')
    async export(@Request() req, @Body() body: ExportConsumptionDto) {
        // Using body for export params since it's a POST
        console.log('Export Params:', body, 'User:', req.user.userId);
        const from = body.from ? new Date(body.from) : undefined;
        const to = body.to ? new Date(body.to) : undefined;
        const type = body.type;
        const propertyId = body.propertyId;

        const csv = await this.consumptionService.exportToCsv(req.user.userId, from, to, type, propertyId);
        return { csv };
    }

    @Post('analytics/trend')
    async analyzeTrend(@Body() body: ExportConsumptionDto) {
        // reuse export dto for filters, as they are the same
        const data = await this.consumptionService.findAll(
            body.propertyId || 'all', // defaulting logic
            body.from ? new Date(body.from) : undefined,
            body.to ? new Date(body.to) : undefined,
            body.type,
            'day' // Use daily resolution for trend analysis to reduce noise/volume
        );
        return this.consumptionService.analyzeTrend(data);
    }

    @Post('analytics/detect-anomalies')
    async detectAnomalies(@Body() body: ExportConsumptionDto) {
        const data = await this.consumptionService.findAll(
            body.propertyId || 'all',
            body.from ? new Date(body.from) : undefined,
            body.to ? new Date(body.to) : undefined,
            body.type,
            'day' // Daily resolution for spikes
        );
        return this.consumptionService.analyzeSpike(data);
    }
}
