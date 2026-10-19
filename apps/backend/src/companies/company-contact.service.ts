import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
}

export interface CompanyContactOption {
  companyName: string | null;
  companyDocument: string | null;
  companySegment: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
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
    const missing: Prisma.CompanyUpdateInput = {
      ...(!company.document && document ? { document } : {}),
      ...(!company.segment && segment ? { segment } : {}),
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
        data: { name, normalizedName, email, normalizedEmail, phone, companyId, createdBy: actorUserId },
      });
      return created.id;
    }

    const missing: Prisma.ContactUncheckedUpdateInput = {
      ...(!existing.email && email ? { email, normalizedEmail } : {}),
      ...(!existing.phone && phone ? { phone } : {}),
      ...(!existing.companyId && companyId ? { companyId } : {}),
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
        contactName: null,
        contactEmail: null,
        contactPhone: null,
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
    return contacts.map((contact) => ({
      companyName: contact.company?.deletedAt ? null : (contact.company?.name ?? null),
      companyDocument: contact.company?.deletedAt ? null : (contact.company?.document ?? null),
      companySegment: contact.company?.deletedAt ? null : (contact.company?.segment ?? null),
      contactName: contact.name,
      contactEmail: contact.email,
      contactPhone: contact.phone,
    }));
  }
}
