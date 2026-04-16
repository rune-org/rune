import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { render, screen, waitFor } from "@/test/render";

const changeMyPasswordMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  changeMyPassword: changeMyPasswordMock,
}));

vi.mock("@/components/ui/toast", () => ({
  toast: toastMock,
}));

import { ChangePasswordForm } from "./ChangePasswordForm";

describe("ChangePasswordForm", () => {
  beforeEach(() => {
    changeMyPasswordMock.mockReset();
    toastMock.success.mockReset();
  });

  it("shows validation errors before submitting", async () => {
    const user = userEvent.setup();

    render(<ChangePasswordForm />);

    await user.type(screen.getByLabelText("Current Password"), "old-password");
    await user.type(screen.getByLabelText("New Password"), "StrongPass1!");
    await user.type(screen.getByLabelText("Confirm New Password"), "Mismatch1!");
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(changeMyPasswordMock).not.toHaveBeenCalled();
  });

  it("submits valid passwords and calls onSuccess", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn().mockResolvedValue(undefined);
    changeMyPasswordMock.mockResolvedValue({ success: true });

    render(<ChangePasswordForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText("Current Password"), "old-password");
    await user.type(screen.getByLabelText("New Password"), "StrongPass1!");
    await user.type(screen.getByLabelText("Confirm New Password"), "StrongPass1!");
    await user.click(screen.getByRole("button", { name: "Change password" }));

    await waitFor(() => {
      expect(changeMyPasswordMock).toHaveBeenCalledWith("old-password", "StrongPass1!");
      expect(toastMock.success).toHaveBeenCalledWith("Password changed successfully!");
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("surfaces API errors to the user", async () => {
    const user = userEvent.setup();
    changeMyPasswordMock.mockRejectedValue({ message: "Current password is incorrect" });

    render(<ChangePasswordForm />);

    await user.type(screen.getByLabelText("Current Password"), "bad-password");
    await user.type(screen.getByLabelText("New Password"), "StrongPass1!");
    await user.type(screen.getByLabelText("Confirm New Password"), "StrongPass1!");
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Current password is incorrect");
  });
});
