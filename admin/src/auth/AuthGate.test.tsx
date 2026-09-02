import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthGate } from "./AuthGate";

afterEach(cleanup);

describe("AuthGate", () => {
  it("accepts and verifies an eight-digit email OTP", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ error: null });
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
        signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
        verifyOtp,
      },
    };

    render(
      <AuthGate client={client as never}>
        {() => <div>Authenticated</div>}
      </AuthGate>,
    );

    fireEvent.change(await screen.findByLabelText("Email address"), {
      target: { value: "admin@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Email me a code" }));

    const tokenInput = await screen.findByLabelText("Email sign-in code");
    fireEvent.change(tokenInput, { target: { value: "12345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and enter" }));

    await waitFor(() => {
      expect(verifyOtp).toHaveBeenCalledWith({
        email: "admin@example.com",
        token: "12345678",
        type: "email",
      });
    });
  });

  it("verifies an existing code without sending another email", async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
    const verifyOtp = vi.fn().mockResolvedValue({ error: null });
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
        signInWithOtp,
        verifyOtp,
      },
    };

    render(
      <AuthGate client={client as never}>
        {() => <div>Authenticated</div>}
      </AuthGate>,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "I already have a code" }),
    );
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "admin@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Email sign-in code"), {
      target: { value: "12345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify and enter" }));

    await waitFor(() => {
      expect(signInWithOtp).not.toHaveBeenCalled();
      expect(verifyOtp).toHaveBeenCalledWith({
        email: "admin@example.com",
        token: "12345678",
        type: "email",
      });
    });
  });
});
