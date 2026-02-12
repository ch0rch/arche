/** @vitest-environment jsdom */

import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LeftPanel } from "@/components/workspace/left-panel";
import type { AgentCatalogItem } from "@/hooks/use-workspace";
import type { WorkspaceFileNode, WorkspaceSession } from "@/lib/opencode/types";

const sessions: WorkspaceSession[] = [
  {
    id: "s1",
    title: "Alpha chat",
    status: "idle",
    updatedAt: "now",
    updatedAtRaw: 1,
  },
  {
    id: "s2",
    title: "Beta chat",
    status: "idle",
    updatedAt: "now",
    updatedAtRaw: 2,
  },
];

const fileNodes: WorkspaceFileNode[] = [
  {
    id: "f1",
    name: "alpha.md",
    path: "alpha.md",
    type: "file",
  },
  {
    id: "f2",
    name: "beta.md",
    path: "beta.md",
    type: "file",
  },
];

const agents: AgentCatalogItem[] = [
  {
    id: "a1",
    displayName: "Alpha Agent",
    isPrimary: true,
  },
  {
    id: "a2",
    displayName: "Beta Agent",
    isPrimary: false,
  },
];

describe("LeftPanel", () => {
  it("filters sections using internal search state", () => {
    render(
      <LeftPanel
        sessions={sessions}
        activeSessionId={"s1"}
        onSelectSession={vi.fn()}
        onCreateSession={vi.fn()}
        agents={agents}
        onSelectAgent={vi.fn()}
        fileNodes={fileNodes}
        activeFilePath={null}
        onSelectFile={vi.fn()}
        searchInputRef={createRef<HTMLInputElement>()}
      />
    );

    const searchInput = screen.getByLabelText("Search chats, knowledge, and agents");
    if (!(searchInput instanceof HTMLInputElement)) {
      throw new Error("Expected search input element");
    }
    fireEvent.change(searchInput, { target: { value: "beta" } });

    expect(screen.queryByText("Alpha chat")).toBeNull();
    expect(screen.getByText("Beta chat")).toBeTruthy();

    expect(screen.queryByText("alpha.md")).toBeNull();
    expect(screen.getByText("beta.md")).toBeTruthy();

    expect(screen.queryByText("Alpha Agent")).toBeNull();
    expect(screen.getByText("Beta Agent")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(searchInput.value).toBe("");
    expect(screen.getByText("Alpha chat")).toBeTruthy();
    expect(screen.getByText("alpha.md")).toBeTruthy();
    expect(screen.getByText("Alpha Agent")).toBeTruthy();
  });
});
