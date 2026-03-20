import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSignInAction = vi.fn();
const mockSignUpAction = vi.fn();
vi.mock("@/actions", () => ({
  signIn: (...args: unknown[]) => mockSignInAction(...args),
  signUp: (...args: unknown[]) => mockSignUpAction(...args),
}));

const mockGetAnonWorkData = vi.fn();
const mockClearAnonWork = vi.fn();
vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: () => mockGetAnonWorkData(),
  clearAnonWork: () => mockClearAnonWork(),
}));

const mockGetProjects = vi.fn();
vi.mock("@/actions/get-projects", () => ({
  getProjects: () => mockGetProjects(),
}));

const mockCreateProject = vi.fn();
vi.mock("@/actions/create-project", () => ({
  createProject: (...args: unknown[]) => mockCreateProject(...args),
}));

const { useAuth } = await import("@/hooks/use-auth");

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "new-project-id" });
});

describe("useAuth initial state", () => {
  test("isLoading starts as false", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  test("exposes signIn and signUp functions", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
  });
});

describe("signIn", () => {
  test("calls signIn action with email and password", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([{ id: "proj-1" }]);

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signIn("user@example.com", "password123"));

    expect(mockSignInAction).toHaveBeenCalledWith("user@example.com", "password123");
  });

  test("returns the result from the signIn action", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([{ id: "proj-1" }]);

    const { result } = renderHook(() => useAuth());
    const returned = await act(() => result.current.signIn("user@example.com", "password123"));

    expect(returned).toEqual({ success: true });
  });

  test("returns failure result without redirecting", async () => {
    mockSignInAction.mockResolvedValue({ success: false, error: "Invalid credentials" });

    const { result } = renderHook(() => useAuth());
    const returned = await act(() => result.current.signIn("user@example.com", "wrong"));

    expect(returned).toEqual({ success: false, error: "Invalid credentials" });
    expect(mockPush).not.toHaveBeenCalled();
  });

  test("resets isLoading to false after signIn completes", async () => {
    mockSignInAction.mockResolvedValue({ success: false, error: "fail" });

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signIn("a@b.com", "pass"));

    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false even when signIn action throws", async () => {
    mockSignInAction.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      try {
        await result.current.signIn("a@b.com", "pass");
      } catch {
        // expected
      }
    });

    expect(result.current.isLoading).toBe(false);
  });
});

describe("signUp", () => {
  test("calls signUp action with email and password", async () => {
    mockSignUpAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([{ id: "proj-1" }]);

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signUp("new@example.com", "secure123"));

    expect(mockSignUpAction).toHaveBeenCalledWith("new@example.com", "secure123");
  });

  test("returns the result from the signUp action", async () => {
    mockSignUpAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([{ id: "proj-1" }]);

    const { result } = renderHook(() => useAuth());
    const returned = await act(() => result.current.signUp("new@example.com", "secure123"));

    expect(returned).toEqual({ success: true });
  });

  test("returns failure result without redirecting", async () => {
    mockSignUpAction.mockResolvedValue({ success: false, error: "Email already registered" });

    const { result } = renderHook(() => useAuth());
    const returned = await act(() => result.current.signUp("existing@example.com", "pass12345"));

    expect(returned).toEqual({ success: false, error: "Email already registered" });
    expect(mockPush).not.toHaveBeenCalled();
  });

  test("resets isLoading to false after signUp completes", async () => {
    mockSignUpAction.mockResolvedValue({ success: false, error: "fail" });

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signUp("a@b.com", "pass"));

    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false even when signUp action throws", async () => {
    mockSignUpAction.mockRejectedValue(new Error("server error"));

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      try {
        await result.current.signUp("a@b.com", "pass");
      } catch {
        // expected
      }
    });

    expect(result.current.isLoading).toBe(false);
  });
});

describe("post sign-in navigation: anonymous work present", () => {
  const anonWork = {
    messages: [{ role: "user", content: "hello" }],
    fileSystemData: { "/App.jsx": { type: "file", content: "export default () => <div/>" } },
  };

  test("creates a project from anon work and redirects to it", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue(anonWork);
    mockCreateProject.mockResolvedValue({ id: "anon-project-id" });

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signIn("a@b.com", "pass"));

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: anonWork.messages,
        data: anonWork.fileSystemData,
      })
    );
    expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
  });

  test("clears anon work after migrating it", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue(anonWork);
    mockCreateProject.mockResolvedValue({ id: "anon-project-id" });

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signIn("a@b.com", "pass"));

    expect(mockClearAnonWork).toHaveBeenCalled();
  });

  test("does not call getProjects when anon work exists", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue(anonWork);
    mockCreateProject.mockResolvedValue({ id: "anon-project-id" });

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signIn("a@b.com", "pass"));

    expect(mockGetProjects).not.toHaveBeenCalled();
  });

  test("skips anon migration when messages array is empty", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
    mockGetProjects.mockResolvedValue([{ id: "existing-proj" }]);

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signIn("a@b.com", "pass"));

    expect(mockPush).toHaveBeenCalledWith("/existing-proj");
  });

  test("skips anon migration when getAnonWorkData returns null", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([{ id: "existing-proj" }]);

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signIn("a@b.com", "pass"));

    expect(mockClearAnonWork).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/existing-proj");
  });
});

describe("post sign-in navigation: no anonymous work", () => {
  test("redirects to the most recent existing project", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([{ id: "recent-proj" }, { id: "older-proj" }]);

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signIn("a@b.com", "pass"));

    expect(mockPush).toHaveBeenCalledWith("/recent-proj");
  });

  test("creates a new project when user has no existing projects", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "brand-new-proj" });

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signIn("a@b.com", "pass"));

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [], data: {} })
    );
    expect(mockPush).toHaveBeenCalledWith("/brand-new-proj");
  });

  test("does not create a project when existing projects are found", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([{ id: "existing-proj" }]);

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signIn("a@b.com", "pass"));

    expect(mockCreateProject).not.toHaveBeenCalled();
  });
});

describe("post sign-up navigation", () => {
  test("follows the same post-auth flow after successful sign-up", async () => {
    mockSignUpAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([{ id: "user-proj" }]);

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signUp("new@example.com", "secure123"));

    expect(mockPush).toHaveBeenCalledWith("/user-proj");
  });

  test("migrates anon work after successful sign-up", async () => {
    const anonWork = {
      messages: [{ role: "user", content: "hi" }],
      fileSystemData: { "/App.jsx": {} },
    };
    mockSignUpAction.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue(anonWork);
    mockCreateProject.mockResolvedValue({ id: "migrated-proj" });

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signUp("new@example.com", "secure123"));

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: anonWork.messages })
    );
    expect(mockPush).toHaveBeenCalledWith("/migrated-proj");
  });
});
