import { createContext, useContext } from "react";

/**
 * Staff-side "view as student" sandbox. When set, the student portal renders
 * for the given student id instead of the signed-in user's own student row,
 * and every write path simulates its outcome locally: nothing is saved, no
 * notifications fire, no server functions run. Null in the real portal.
 */
export type StudentSandbox = { studentId: string } | null;

export const StudentSandboxContext = createContext<StudentSandbox>(null);

export const useStudentSandbox = () => useContext(StudentSandboxContext);
