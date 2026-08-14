export type SuperAdminUser = {
  name: string;
  identifier: string;
  role: "super_admin";
};

export const superAdminUsers: SuperAdminUser[] = [
  { name: "Allan Nascimento", identifier: "fxpagenciadigital@outlook.com", role: "super_admin" },
  { name: "Gabriela Nascimento", identifier: "gabrielanascimento", role: "super_admin" },
  { name: "Ita Silva", identifier: "itasilva", role: "super_admin" },
  { name: "Derek Nascimento", identifier: "dereknascimento", role: "super_admin" },
];

export function normalizeLoginIdentifier(value: string) {
  return value.trim().toLowerCase();
}

export function findSuperAdminByIdentifier(identifier: string) {
  const normalizedIdentifier = normalizeLoginIdentifier(identifier);
  return superAdminUsers.find((user) => normalizeLoginIdentifier(user.identifier) === normalizedIdentifier) ?? null;
}
