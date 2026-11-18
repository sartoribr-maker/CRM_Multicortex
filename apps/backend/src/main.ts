import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Proxies confiáveis à frente do backend: produção tem dois (Nginx de borda + Nginx do app).
  // Com menos que o real, todos os usuários aparecem com o IP do proxy e dividem o rate limit.
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS);
  app
    .getHttpAdapter()
    .getInstance()
    .set('trust proxy', Number.isInteger(proxyHops) && proxyHops >= 0 ? proxyHops : 1);
  app.enableShutdownHooks();

  app.use(helmet());
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('api/v1', { exclude: ['api/docs', 'api/docs-json'] });

  const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Multicortex CRM API')
    .setDescription('API REST da plataforma Multicortex CRM')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.BACKEND_PORT ?? 3333;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Multicortex CRM backend rodando em http://localhost:${port}/api/v1`);
}

bootstrap();
