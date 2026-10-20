import { Injectable } from '@nestjs/common';
import { Company, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { cleanText, normalizeEmail, normalizeName } from './company-contact.normalize';

type Tx = Prisma.TransactionClient;

export interface LeadPartyInput {
  companyName?: string | null;
  companyDocument?: string | null;
  companySegment?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  companyLocation?: string | null;
  companyLinkedinUrl?: string | null;
  companyWebsite?: string | null;
  companyPhone?: string | null;
  companySizeEstimate?: string | null;
  companyRevenue?: string | null;
  companyEmployeeCount?: string | null;
  contactPosition?: string | null;
  contactLinkedinUrl?: string | null;
}

export interface CompanyContactOption {
  companyName: string | null;
  companyDocument: string | null;
  companySegment: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  companyLocation: string | null;
  companyLinkedinUrl: string | null;
  companyWebsite: string | null;
  companyPhone: string | null;
  companySizeEstimate: string | null;
  companyRevenue: string | null;
  companyEmployeeCount: string | null;
  contactPosition: string | null;
  contactLinkedinUrl: string | null;
}

/** Campos complementares da empresa: (campo do lead, coluna da empresa). */
const COMPANY_EXTRA_FIELDS = [
  ['companyLocation', 'location'],
  ['companyLinkedinUrl', 'linkedinUrl'],
  ['companyWebsite', 'website'],
  ['companyPhone', 'phone'],
  ['companySizeEstimate', 'sizeEstimate'],
  ['companyRevenue', 'revenue'],
  ['companyEmployeeCount', 'employeeCount'],
] as const;

/** Campos complementares do contato: (campo do lead, coluna do contato). */
const CONTACT_EXTRA_FIELDS = [
  ['contactPosition', 'position'],
  ['contactLinkedinUrl', 'linkedinUrl'],
] as const;

/** Valores informados no lead para as colunas complementares, limpos. */
function extraValues(
  input: LeadPartyInput,
  fields: typeof COMPANY_EXTRA_FIELDS | typeof CONTACT_EXTRA_FIELDS,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [leadField, column] of fields) {
    const value = cleanText(input[leadField]);
    if (value) values[column] = value;
  }
  return values;
}

function companyOption(company: Company | null) {
  return Object.fromEntries(
    COMPANY_EXTRA_FIELDS.map(([leadField, column]) => [leadField, company?.[column] ?? null]),
  ) as Record<(typeof COMPANY_EXTRA_FIELDS)[number][0], string | null>;
}

const AUTOCOMPLETE_LIMIT = 8;

/**
 * Cadastro de empresas e contatos alimentado pelos leads: ao salvar um lead,
 * a empresa e o contato informados são gravados se ainda não existirem e
 * completados (sem sobrescrever) se já existirem.
 */
@Injectable()
export class CompanyContactService {
  constructor(private readonly prisma: PrismaService) {}

  async syncForLead(
    tx: Tx,
    input: LeadPartyInput,
    actorUserId: string,
  ): Promise<{ companyId: string | null; contactId: string | null }> {
    const companyId = await this.syncCompany(tx, input, actorUserId);
    const contactId = await this.syncContact(tx, input, companyId, actorUserId);
    return { companyId, contactId };
  }

  private async syncCompany(tx: Tx, input: LeadPartyInput, actorUserId: string) {
    const name = cleanText(input.companyName);
    if (!name) return null;
    const normalizedName = normalizeName(name);
    const document = cleanText(input.companyDocument);
    const segment = cleanText(input.companySegment);

    // ON CONFLICT evita duplicidade quando dois leads da mesma empresa são salvos juntos.
    await tx.$executeRaw`
      INSERT INTO "companies" ("id", "name", "normalizedName", "document", "segment", "createdBy", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, ${name}, ${normalizedName}, ${document}, ${segment}, ${actorUserId}, now(), now())
      ON CONFLICT ("normalizedName") DO NOTHING
    `;
    const company = await tx.company.findUniqueOrThrow({ where: { normalizedName } });
    const extras = extraValues(input, COMPANY_EXTRA_FIELDS);
    const missing: Prisma.CompanyUpdateInput = {
      ...(!company.document && document ? { document } : {}),
      ...(!company.segment && segment ? { segment } : {}),
      ...Object.fromEntries(
        Object.entries(extras).filter(([column]) => !company[column as keyof Company]),
      ),
    };
    if (Object.keys(missing).length) {
      await tx.company.update({ where: { id: company.id }, data: missing });
    }
    return company.id;
  }

  private async syncContact(
    tx: Tx,
    input: LeadPartyInput,
    companyId: string | null,
    actorUserId: string,
  ) {
    const name = cleanText(input.contactName);
    if (!name) return null;
    const normalizedName = normalizeName(name);
    const email = cleanText(input.contactEmail);
    const normalizedEmail = normalizeEmail(email);
    const phone = cleanText(input.contactPhone);
    const extras = extraValues(input, CONTACT_EXTRA_FIELDS);

    // Mesmo e-mail e mesmo nome; senão, mesmo nome dentro da mesma empresa.
    // Exigir o nome evita vincular o lead a outra pessoa que usou o mesmo e-mail.
    const existing =
      (normalizedEmail
        ? await tx.contact.findFirst({
            where: { normalizedEmail, normalizedName, deletedAt: null },
            orderBy: { createdAt: 'asc' },
          })
        : null) ??
      (await tx.contact.findFirst({
        where: { normalizedName, companyId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      }));
    if (!existing) {
      const created = await tx.contact.create({
        data: {
          name,
          normalizedName,
          email,
          normalizedEmail,
          phone,
          ...extras,
          companyId,
          createdBy: actorUserId,
        },
      });
      return created.id;
    }

    const missing: Prisma.ContactUncheckedUpdateInput = {
      ...(!existing.email && email ? { email, normalizedEmail } : {}),
      ...(!existing.phone && phone ? { phone } : {}),
      ...(!existing.companyId && companyId ? { companyId } : {}),
      ...Object.fromEntries(
        Object.entries(extras).filter(([column]) => !existing[column as keyof typeof existing]),
      ),
    };
    if (Object.keys(missing).length) {
      await tx.contact.update({ where: { id: existing.id }, data: missing });
    }
    return existing.id;
  }

  /** Sugestões do formulário de lead, a partir de toda a base de empresas e contatos. */
  async autocomplete(type: 'company' | 'contact', search: string): Promise<CompanyContactOption[]> {
    const term = search.trim();
    if (type === 'company') {
      const companies = await this.prisma.company.findMany({
        where: { deletedAt: null, name: { contains: term, mode: 'insensitive' } },
        orderBy: { updatedAt: 'desc' },
        take: AUTOCOMPLETE_LIMIT,
      });
      return companies.map((company) => ({
        companyName: company.name,
        companyDocument: company.document,
        companySegment: company.segment,
        ...companyOption(company),
        contactName: null,
        contactEmail: null,
        contactPhone: null,
        contactPosition: null,
        contactLinkedinUrl: null,
      }));
    }

    const contacts = await this.prisma.contact.findMany({
      where: {
        deletedAt: null,
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
        ],
      },
      include: { company: true },
      orderBy: { updatedAt: 'desc' },
      take: AUTOCOMPLETE_LIMIT,
    });
    return contacts.map((contact) => {
      const company = contact.company?.deletedAt ? null : contact.company;
      return {
        companyName: company?.name ?? null,
        companyDocument: company?.document ?? null,
        companySegment: company?.segment ?? null,
        ...companyOption(company),
        contactName: contact.name,
        contactEmail: contact.email,
        contactPhone: contact.phone,
        contactPosition: contact.position,
        contactLinkedinUrl: contact.linkedinUrl,
      };
    });
  }
}
