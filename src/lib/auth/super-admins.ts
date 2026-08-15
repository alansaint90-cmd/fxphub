import { createHash } from "node:crypto";

export type SuperAdminUser = {
  name: string;
  identifier: string;
  aliases?: string[];
  passwordHash: string;
  role: "super_admin";
};

function hashPassword(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export const superAdminUsers: SuperAdminUser[] = [
  {
    name: "Allan Nascimento",
    identifier: "fxpagenciadigital@outlook.com",
    passwordHash: "8539d593ddd13076504fa45ce2ed4afd17048fe3db6a485296fc9793c38ba646",
    role: "super_admin",
  },
  {
    name: "Gabriela Nascimento",
    identifier: "gabriela@fxphub.com",
    aliases: ["gabrielanascimento"],
    passwordHash: "0854a14bc2481062b09f34d4b439295a33119f5240d138456aa91e7a4efd2640",
    role: "super_admin",
  },
  {
    name: "Ita Silva",
    identifier: "ita@fxphub.com",
    aliases: ["itasilva"],
    passwordHash: "98b8a316862781da5e55bc62801f21f87a313ff727f9212f997a06ba4022984a",
    role: "super_admin",
  },
  {
    name: "Derek Nascimento",
    identifier: "derek@fxphub.com",
    aliases: ["dereknascimento"],
    passwordHash: "3703c81aec721956cc17b33b74242301f6f04f1bc1b3c13c11a07608a1916119",
    role: "super_admin",
  },
];

export function normalizeLoginIdentifier(value: string) {
  return value.trim().toLowerCase();
}

export function findSuperAdminByIdentifier(identifier: string) {
  const normalizedIdentifier = normalizeLoginIdentifier(identifier);
  return (
    superAdminUsers.find(
      (user) =>
        normalizeLoginIdentifier(user.identifier) === normalizedIdentifier ||
        user.aliases?.some((alias) => normalizeLoginIdentifier(alias) === normalizedIdentifier),
    ) ?? null
  );
}

export function validateSuperAdminPassword(user: SuperAdminUser, password: string) {
  return hashPassword(password) === user.passwordHash;
}
