import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Read config
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Global Route Prefix (/api/v1)
  app.setGlobalPrefix('api/v1');

  // Global DTO Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global Response Transformer ({ success: true, data: ... })
  app.useGlobalInterceptors(new TransformInterceptor());

  // Global Exception Filter ({ success: false, error: { code, message } })
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(port);
  logger.log(`🚀 TeamUp Backend API running on: http://localhost:${port}/api/v1`);
}

bootstrap();
