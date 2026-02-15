import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import { LoginInput } from '../schemas/auth.schema';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  logger.error('JWT_SECRET environment variable is not set. Exiting.');
  process.exit(1);
}

/**
 * Select fields for admin responses — never return password
 */
const adminSelectPublic = {
  id: true,
  username: true,
  name: true,
} as const;

/**
 * Authenticate admin with username and password, return JWT + profile.
 */
export const loginAdmin = async (input: LoginInput) => {
  const admin = await prisma.admin.findUnique({
    where: { username: input.username },
  });

  if (!admin) {
    logger.debug('Login attempt for unknown user', {
      username: input.username,
    });
    return null;
  }

  const valid = await bcrypt.compare(input.password, admin.password);
  if (!valid) {
    logger.debug('Invalid password for user', { username: input.username });
    return null;
  }

  const token = jwt.sign({ adminId: admin.id }, JWT_SECRET!, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
  return {
    token,
    admin: {
      id: admin.id,
      username: admin.username,
      name: admin.name,
    },
  };
};

/**
 * Find admin by ID (for /me endpoint).
 */
export const findAdminById = async (id: string) => {
  return prisma.admin.findUnique({
    where: { id },
    select: adminSelectPublic,
  });
};
