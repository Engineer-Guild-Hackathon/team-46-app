import { render, fireEvent, waitFor } from "@testing-library/svelte";
import { describe, it, expect } from "vitest";
import UsernameModal from "$lib/components/UsernameModal.svelte";
import { user } from "$lib/stores/user";

// Helper to get current user store value
function getUser() {
  let val: { userId: string | null; username: string | null } = {
    userId: null,
    username: null,
  };
  const unsub = user.subscribe((v) => (val = v));
  unsub();
  return val;
}

describe("UsernameModal", () => {
  it("requires a username before continuing", async () => {
    const { getByRole, queryByRole } = render(UsernameModal);
    const btn = getByRole("button", { name: "Save username" });
    await fireEvent.click(btn);
    expect(queryByRole("alert")).toBeTruthy();
  });

  it("stores username and userId on submit", async () => {
    const { getByPlaceholderText, getByRole } = render(UsernameModal);
    const input = getByPlaceholderText("e.g. korewata") as HTMLInputElement;
    await fireEvent.input(input, { target: { value: "tester" } });
    const btn = getByRole("button", { name: "Save username" });
    await fireEvent.click(btn);
    await waitFor(() => {
      const u = getUser();
      expect(u.username).toBe("tester");
      expect(u.userId).toMatch(/^tester-/);
    });
  });

  it("rejects uppercase and symbols", async () => {
    const { getByPlaceholderText, getByRole, queryByRole } =
      render(UsernameModal);
    const input = getByPlaceholderText("e.g. korewata") as HTMLInputElement;
    await fireEvent.input(input, { target: { value: "Test_User-123" } });
    // Input should sanitize: lowercase then remove non a-z and digits -> 'testuser'
    expect(input.value).toBe("testuser");
    const btn = getByRole("button", { name: "Save username" });
    await fireEvent.click(btn);
    const u = getUser();
    expect(u.username).toBe("testuser");
    expect(u.userId).toMatch(/^testuser-/);
    expect(queryByRole("alert")).toBeFalsy();
  });

  it("shows error if only invalid chars entered", async () => {
    const {
      getByPlaceholderText,
      getByRole,
      getByRole: get,
    } = render(UsernameModal);
    const input = getByPlaceholderText("e.g. korewata") as HTMLInputElement;
    await fireEvent.input(input, { target: { value: "12345***" } });
    expect(input.value).toBe("");
    const btn = getByRole("button", { name: "Save username" });
    await fireEvent.click(btn);
    get("alert");
  });

  it("enforces minimum length", async () => {
    const {
      getByPlaceholderText,
      getByRole,
      getByRole: get,
    } = render(UsernameModal);
    const input = getByPlaceholderText("e.g. korewata") as HTMLInputElement;
    await fireEvent.input(input, { target: { value: "ab" } });
    const btn = getByRole("button", { name: "Save username" });
    await fireEvent.click(btn);
    const alert = get("alert");
    expect(alert.textContent).toMatch(/at least/i);
  });

  it("accepts exactly max length", async () => {
    const { getByPlaceholderText, getByRole } = render(UsernameModal);
    const input = getByPlaceholderText("e.g. korewata") as HTMLInputElement;
    const maxName = "a".repeat(24);
    await fireEvent.input(input, { target: { value: maxName } });
    const btn = getByRole("button", { name: "Save username" });
    await fireEvent.click(btn);
    await waitFor(() => {
      const u = getUser();
      expect(u.username).toBe(maxName);
    });
  });

  it("rejects over max length", async () => {
    const {
      getByPlaceholderText,
      getByRole,
      getByRole: get,
    } = render(UsernameModal);
    const input = getByPlaceholderText("e.g. korewata") as HTMLInputElement;
    const longName = "a".repeat(30);
    await fireEvent.input(input, { target: { value: longName } });
    // Input sanitized will truncate? (component does not truncate, just allows full then validation error)
    const btn = getByRole("button", { name: "Save username" });
    await fireEvent.click(btn);
    const alert = get("alert");
    expect(alert.textContent).toMatch(/at most/i);
  });
});
