import bcrypt from 'bcrypt';
import { env } from '../../config/env';

// RNF-02: senhas nunca em texto plano; hash bcrypt com custo mínimo 12.
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, env.bcrypt.saltRounds);
}

export async function comparePassword(plainPassword: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hash);
}
