import { randomBytes, createHash } from 'crypto';
import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { JwtPayload } from './types/jwt-payload.interface';

interface RequestMeta {
  userAgent?: string;
  ip?: string;
}

interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: { id: string; name: string };
  permissions: string[];
  mustChangePassword: boolean;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  user: AuthenticatedUser;
}

const REFRESH_TOKEN_BYTES = 48;
const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private async loadUserWithPermissions(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
  }

  private toAuthenticatedUser(
    user: NonNullable<Awaited<ReturnType<typeof this.loadUserWithPermissions>>>,
  ): AuthenticatedUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: { id: user.role.id, name: user.role.name },
      permissions: user.role.permissions.map((rp) => rp.permission.key),
      mustChangePassword: user.mustChangePassword,
    };
  }

  async validateUser(email: string, password: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      await this.auditService.record({ action: 'LOGIN_FAILED', metadata: { email } });
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      await this.auditService.record({
        action: 'LOGIN_FAILED',
        actorUserId: user.id,
        metadata: { email },
      });
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    return this.toAuthenticatedUser(user);
  }

  private signAccessToken(user: AuthenticatedUser): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      roleId: user.role.id,
      roleName: user.role.name,
      permissions: user.permissions,
    };
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET', 'dev-secret'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
    });
  }

  createPasswordChangeToken(user: AuthenticatedUser): string {
    return this.jwtService.sign(
      { sub: user.id, purpose: 'password-change' },
      {
        secret: this.configService.get<string>('JWT_SECRET', 'dev-secret'),
        expiresIn: '15m',
      },
    );
  }

  async changeRequiredPassword(changeToken: string, newPassword: string): Promise<void> {
    let payload: { sub?: string; purpose?: string };
    try {
      payload = await this.jwtService.verifyAsync(changeToken, {
        secret: this.configService.get<string>('JWT_SECRET', 'dev-secret'),
      });
    } catch {
      throw new UnauthorizedException('Solicitação de troca de senha inválida ou expirada.');
    }
    if (!payload.sub || payload.purpose !== 'password-change') {
      throw new UnauthorizedException('Solicitação de troca de senha inválida ou expirada.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.deletedAt || user.status !== 'ACTIVE' || !user.mustChangePassword) {
      throw new UnauthorizedException('Solicitação de troca de senha inválida ou já utilizada.');
    }
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      throw new BadRequestException('A nova senha deve ser diferente da senha atual.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, mustChangePassword: false },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.auditService.record({
      action: 'PASSWORD_RESET_COMPLETED',
      actorUserId: user.id,
      metadata: { requiredChange: true },
    });
  }

  private parseExpiresInToMs(expiresIn: string): number {
    const match = /^(\d+)([smhd])$/.exec(expiresIn);
    if (!match) return 15 * 60 * 1000;
    const value = Number(match[1]);
    const unit = match[2];
    const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit] ?? 60_000;
    return value * unitMs;
  }

  private async issueRefreshToken(
    userId: string,
    meta: RequestMeta,
  ): Promise<{ raw: string; expiresAt: Date }> {
    const raw = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const expiresInStr = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const expiresAt = new Date(Date.now() + this.parseExpiresInToMs(expiresInStr));

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(raw),
        expiresAt,
        userAgent: meta.userAgent,
        ip: meta.ip,
      },
    });

    return { raw, expiresAt };
  }

  async login(user: AuthenticatedUser, meta: RequestMeta): Promise<TokenPair> {
    const { raw, expiresAt } = await this.issueRefreshToken(user.id, meta);
    await this.auditService.record({ action: 'LOGIN_SUCCESS', actorUserId: user.id });

    return {
      accessToken: this.signAccessToken(user),
      refreshToken: raw,
      refreshTokenExpiresAt: expiresAt,
      user,
    };
  }

  async refresh(rawToken: string, meta: RequestMeta): Promise<TokenPair> {
    const tokenHash = this.hashToken(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Sessão expirada, faça login novamente.');
    }

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    const userRecord = await this.loadUserWithPermissions(existing.userId);
    if (
      !userRecord ||
      userRecord.deletedAt ||
      userRecord.status !== 'ACTIVE' ||
      userRecord.mustChangePassword
    ) {
      throw new UnauthorizedException('Sessão expirada, faça login novamente.');
    }

    const user = this.toAuthenticatedUser(userRecord);
    const { raw, expiresAt } = await this.issueRefreshToken(user.id, meta);

    return {
      accessToken: this.signAccessToken(user),
      refreshToken: raw,
      refreshTokenExpiresAt: expiresAt,
      user,
    };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const tokenHash = this.hashToken(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!existing || existing.revokedAt) return;

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });
    await this.auditService.record({ action: 'LOGOUT', actorUserId: existing.userId });
  }

  async me(userId: string): Promise<AuthenticatedUser> {
    const user = await this.loadUserWithPermissions(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.toAuthenticatedUser(user);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Resposta sempre "genérica" para não permitir enumeração de e-mails;
    // só criamos o token se o usuário de fato existir.
    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      return;
    }

    const raw = randomBytes(RESET_TOKEN_BYTES).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(raw),
        expiresAt,
      },
    });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const resetLink = `${frontendUrl}/reset-password?token=${raw}`;

    // SMTP real entra na Fase 6+; por ora, simulamos o envio via log.
    this.logger.log(`[email simulado] Reset de senha para ${email}: ${resetLink}`);

    await this.auditService.record({
      action: 'PASSWORD_RESET_REQUESTED',
      actorUserId: user.id,
    });
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    const resetToken = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Token de redefinição inválido ou expirado.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash, mustChangePassword: false },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.auditService.record({
      action: 'PASSWORD_RESET_COMPLETED',
      actorUserId: resetToken.userId,
    });
  }
}
