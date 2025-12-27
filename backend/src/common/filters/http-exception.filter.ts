import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        const message =
            exception instanceof HttpException
                ? exception.getResponse()
                : { message: (exception as Error).message || 'Internal server error' };

        // Standardize the structure
        // If message is an object (string or object from Nest defaults), handle it
        let errorMessage = 'Internal Server Error';
        if (typeof message === 'string') {
            errorMessage = message;
        } else if (typeof message === 'object' && message !== null) {
            errorMessage = (message as any).message || (message as any).error || JSON.stringify(message);
            // If message is array (class-validator), join them
            if (Array.isArray(errorMessage)) {
                errorMessage = errorMessage.join(', ');
            }
        }

        console.error(`[${new Date().toISOString()}] Error on ${request.url}:`, exception);

        response
            .status(status)
            .json({
                statusCode: status,
                timestamp: new Date().toISOString(),
                path: request.url,
                message: errorMessage,
            });
    }
}
