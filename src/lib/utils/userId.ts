import { v4 as uuidv4 } from "uuid";

const USER_ID_KEY = "user-id";

export function getOrCreateUserId(): string {
  if (typeof localStorage === "undefined") {
    throw new Error("localStorage is not available");
  }

  let userId = localStorage.getItem(USER_ID_KEY);

  if (!userId) {
    userId = uuidv4();
    localStorage.setItem(USER_ID_KEY, userId);
  }

  return userId || ""; // Ensure a string is always returned
}
