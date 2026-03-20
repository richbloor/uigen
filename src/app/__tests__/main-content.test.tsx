import { test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MainContent } from "@/app/main-content";

vi.mock("@/lib/contexts/file-system-context", () => ({
  FileSystemProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/lib/contexts/chat-context", () => ({
  ChatProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/components/chat/ChatInterface", () => ({
  ChatInterface: () => <div data-testid="chat-interface" />,
}));

vi.mock("@/components/preview/PreviewFrame", () => ({
  PreviewFrame: () => <div data-testid="preview-frame" />,
}));

vi.mock("@/components/editor/CodeEditor", () => ({
  CodeEditor: () => <div data-testid="code-editor" />,
}));

vi.mock("@/components/editor/FileTree", () => ({
  FileTree: () => <div data-testid="file-tree" />,
}));

vi.mock("@/components/HeaderActions", () => ({
  HeaderActions: () => <div data-testid="header-actions" />,
}));

vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({ children }: any) => <div>{children}</div>,
  ResizablePanel: ({ children }: any) => <div>{children}</div>,
  ResizableHandle: () => <div />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("shows preview by default", () => {
  render(<MainContent />);

  expect(screen.getByTestId("preview-frame")).toBeDefined();
  expect(screen.queryByTestId("code-editor")).toBeNull();
  expect(screen.queryByTestId("file-tree")).toBeNull();
});

test("Preview and Code tab buttons are both rendered", () => {
  render(<MainContent />);

  expect(screen.getByRole("tab", { name: "Preview" })).toBeDefined();
  expect(screen.getByRole("tab", { name: "Code" })).toBeDefined();
});

test("Preview tab is active by default", () => {
  render(<MainContent />);

  const previewTab = screen.getByRole("tab", { name: "Preview" });
  const codeTab = screen.getByRole("tab", { name: "Code" });

  expect(previewTab.getAttribute("data-state")).toBe("active");
  expect(codeTab.getAttribute("data-state")).toBe("inactive");
});

test("clicking Code button switches to code view", () => {
  render(<MainContent />);

  fireEvent.click(screen.getByRole("tab", { name: "Code" }));

  expect(screen.getByTestId("code-editor")).toBeDefined();
  expect(screen.getByTestId("file-tree")).toBeDefined();
  expect(screen.queryByTestId("preview-frame")).toBeNull();
});

test("Code tab becomes active after clicking", () => {
  render(<MainContent />);

  fireEvent.click(screen.getByRole("tab", { name: "Code" }));

  const codeTab = screen.getByRole("tab", { name: "Code" });
  const previewTab = screen.getByRole("tab", { name: "Preview" });

  expect(codeTab.getAttribute("data-state")).toBe("active");
  expect(previewTab.getAttribute("data-state")).toBe("inactive");
});

test("clicking Preview button after Code switches back to preview", () => {
  render(<MainContent />);

  fireEvent.click(screen.getByRole("tab", { name: "Code" }));
  expect(screen.getByTestId("code-editor")).toBeDefined();

  fireEvent.click(screen.getByRole("tab", { name: "Preview" }));

  expect(screen.getByTestId("preview-frame")).toBeDefined();
  expect(screen.queryByTestId("code-editor")).toBeNull();
  expect(screen.queryByTestId("file-tree")).toBeNull();
});

test("Preview tab becomes active again after switching back from Code", () => {
  render(<MainContent />);

  fireEvent.click(screen.getByRole("tab", { name: "Code" }));
  fireEvent.click(screen.getByRole("tab", { name: "Preview" }));

  const previewTab = screen.getByRole("tab", { name: "Preview" });
  const codeTab = screen.getByRole("tab", { name: "Code" });

  expect(previewTab.getAttribute("data-state")).toBe("active");
  expect(codeTab.getAttribute("data-state")).toBe("inactive");
});

test("tab buttons are not disabled", () => {
  render(<MainContent />);

  const previewTab = screen.getByRole("tab", { name: "Preview" });
  const codeTab = screen.getByRole("tab", { name: "Code" });

  expect(previewTab.hasAttribute("disabled")).toBe(false);
  expect(codeTab.hasAttribute("disabled")).toBe(false);
});

test("toggle can be performed multiple times", () => {
  render(<MainContent />);

  fireEvent.click(screen.getByRole("tab", { name: "Code" }));
  expect(screen.getByTestId("code-editor")).toBeDefined();

  fireEvent.click(screen.getByRole("tab", { name: "Preview" }));
  expect(screen.getByTestId("preview-frame")).toBeDefined();

  fireEvent.click(screen.getByRole("tab", { name: "Code" }));
  expect(screen.getByTestId("code-editor")).toBeDefined();

  fireEvent.click(screen.getByRole("tab", { name: "Preview" }));
  expect(screen.getByTestId("preview-frame")).toBeDefined();
});
