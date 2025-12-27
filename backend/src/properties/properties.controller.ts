import { Controller, Get, Post, Body, UseGuards, Request, Param } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { AuthGuard } from '@nestjs/passport';
import { IsNotEmpty, IsString } from 'class-validator';

class CreatePropertyDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsString()
    location: string;
}

@UseGuards(AuthGuard('jwt'))
@Controller('properties')
export class PropertiesController {
    constructor(private readonly propertiesService: PropertiesService) { }

    @Post()
    create(@Request() req, @Body() createPropertyDto: CreatePropertyDto) {
        return this.propertiesService.create(
            req.user.userId,
            createPropertyDto.name,
            createPropertyDto.location,
        );
    }

    @Get()
    findAll(@Request() req) {
        return this.propertiesService.findAll(req.user.userId);
    }
}
