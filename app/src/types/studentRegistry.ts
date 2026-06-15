/** Row shape aligned with future `master_students` / registry imports. */
export interface MasterStudent {
  id: string;
  studentId: string;
  fullName: string;
  course: string;
  program: string;
  yearLevel: string;
  email?: string;
  archived?: boolean;
  /** Source row index from last import (for preview errors). */
  sourceRow?: number;
}

/** `YY-XXXX` e.g. 23-0669 */
export const STUDENT_ID_PATTERN = /^\d{2}-\d{4}$/;

export function normalizeStudentId(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidStudentIdFormat(id: string): boolean {
  return STUDENT_ID_PATTERN.test(normalizeStudentId(id));
}
