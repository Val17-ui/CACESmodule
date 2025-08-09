
import { Session, Trainer, Referential, QuestionWithId, BlockUsage } from '@common/types';

export const sortByDateDesc = (a: { dateSession: string }, b: { dateSession: string }) =>
  new Date(b.dateSession).getTime() - new Date(a.dateSession).getTime();

export const sortByNameAsc = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name);

export const sortByCodeAsc = (a: { code: string }, b: { code: string }) =>
  a.code.localeCompare(b.code);

export const sortByNomCompletAsc = (a: { nom_complet: string }, b: { nom_complet: string }) =>
  a.nom_complet.localeCompare(b.nom_complet);

export const sortByIdAsc = (a: { id?: number }, b: { id?: number }) =>
  (a.id ?? 0) - (b.id ?? 0);

export const sortByBlocCodeAsc = (a: { blocCode: string }, b: { blocCode: string }) =>
  a.blocCode.localeCompare(b.blocCode);

export const sortByThemeNameAsc = (a: { themeName: string }, b: { themeName: string }) =>
  a.themeName.localeCompare(b.themeName);

// Generic sorter for objects with a 'name' property
export function sortByName<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name);
}

// Generic sorter for objects with a 'code' property
export function sortByCode<T extends { code: string }>(a: T, b: T): number {
  return a.code.localeCompare(b.code);
}

// Generic sorter for objects with a 'nom_complet' property
export function sortByNomComplet<T extends { nom_complet: string }>(a: T, b: T): number {
  return a.nom_complet.localeCompare(b.nom_complet);
}

// Generic sorter for objects with an optional 'id' property
export function sortById<T extends { id?: number }>(a: T, b: T): number {
  return (a.id ?? 0) - (b.id ?? 0);
}

// Generic sorter for objects with a 'dateSession' property (for sessions)
export function sortBySessionDateDesc<T extends { dateSession: string }>(a: T, b: T): number {
  return new Date(b.dateSession).getTime() - new Date(a.dateSession).getTime();
}

// For BlockUsage type
export function sortBlockUsage<T extends BlockUsage>(a: T, b: T, sortKey: keyof T, sortDirection: 'asc' | 'desc'): number {
  const valA = a[sortKey];
  const valB = b[sortKey];

  if (typeof valA === 'string' && typeof valB === 'string') {
    return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
  }
  if (typeof valA === 'number' && typeof valB === 'number') {
    return sortDirection === 'asc' ? valA - valB : valB - valA;
  }
  return 0;
}

// For questions with usageCount and correctResponseRate
export function sortQuestions<T extends QuestionWithId>(a: T, b: T, sortKey: keyof T, sortDirection: 'asc' | 'desc'): number {
  const valA = a[sortKey];
  const valB = b[sortKey];

  if (typeof valA === 'string' && typeof valB === 'string') {
    return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
  }
  if (typeof valA === 'number' && typeof valB === 'number') {
    return sortDirection === 'asc' ? valA - valB : valB - valA;
  }
  return 0;
}
