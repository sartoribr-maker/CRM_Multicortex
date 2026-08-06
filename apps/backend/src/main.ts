import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1', { exclude: ['api/docs', 'api/docs-json'] });

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  });

  const config = new DocumentBuilder()
    .setTitle('Multicortex CRM API')
    .setDescription('API REST da plataforma Multicortex CRM')
    .setVersion('0.1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.BACKEND_PORT ?? 3333;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Multicortex CRM backend rodando em http://localhost:${port}/api/v1`);
}

bootstrap();
