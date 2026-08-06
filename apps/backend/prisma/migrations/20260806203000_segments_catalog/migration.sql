CREATE TABLE "segments" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" TEXT,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "segments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "segments_name_key" ON "segments"("name");

INSERT INTO "segments" ("id", "name", "description", "updatedAt") VALUES
  (gen_random_uuid()::text, 'Agronegócio', 'Agricultura, pecuária e cadeia agroindustrial', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Comércio e Varejo', 'Lojas físicas, e-commerce e distribuição', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Construção Civil e Imobiliário', 'Construção, engenharia e mercado imobiliário', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Educação', 'Instituições de ensino e educação corporativa', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Energia e Utilities', 'Energia, saneamento e serviços públicos', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Finanças e Seguros', 'Bancos, fintechs, contabilidade e seguros', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Indústria', 'Indústrias de transformação e manufatura', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Logística e Transportes', 'Transporte, armazenagem e cadeia logística', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Saúde', 'Clínicas, hospitais, laboratórios e healthtechs', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Serviços Profissionais', 'Consultoria e serviços especializados', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Tecnologia e Telecomunicações', 'Software, hardware, telecom e serviços digitais', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Turismo, Hotelaria e Eventos', 'Turismo, hospedagem, gastronomia e eventos', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Terceiro Setor', 'Associações, fundações e organizações sociais', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Setor Público', 'Órgãos e empresas públicas', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Outros', 'Demais segmentos de mercado', CURRENT_TIMESTAMP);
