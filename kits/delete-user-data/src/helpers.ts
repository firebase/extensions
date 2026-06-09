import { type DocumentReference, FieldPath } from "firebase-admin/firestore";

export const hasValidUserPath = async (
  ref: DocumentReference,
  path: string,
  uid: string,
  searchFields: string
): Promise<boolean> => {
  if (path.includes(uid)) return true;
  if (searchFields.length === 0) return false;

  const snapshot = await ref.get();
  if (snapshot.exists) {
    for (const field of searchFields.split(",").filter(Boolean)) {
      const fieldValue = snapshot.get(new FieldPath(field));
      if (typeof fieldValue === "string" && fieldValue.includes(uid)) {
        return true;
      }
    }
  }

  return false;
};

export const extractUserPaths = (paths: string, uid: string): string[] =>
  paths.split(",").map((path) => path.replace(/{UID}/g, uid));
