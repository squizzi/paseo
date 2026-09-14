import path from "node:path";
import { test, expect } from "../support/fixtures";
import { gotoAppShell } from "../support/helpers/app";
import {
  closeMobileAgentSidebar,
  expectMobileAgentSidebarHidden,
  expectMobileAgentSidebarVisible,
  openMobileAgentSidebar,
  pinWorkspaceFromSidebar,
} from "../support/helpers/sidebar";
import { seedWorkspace, createWorkspaceInProject } from "../support/helpers/seed-client";
import { expectWorkspaceHeader, waitForSidebarHydration } from "../support/helpers/workspace-ui";
import { getServerId } from "../support/helpers/server-id";
import { projectEquivalenceViewKey } from "../support/helpers/project-view-key";
import { escapeRegex } from "../support/helpers/regex";
import { openFilesPanel } from "../support/helpers/workspace-tabs";
import { seedMockAgentWorkspace } from "../support/helpers/mock-agent";
import { createTempDirectory } from "../support/helpers/workspace";

const GITHUB_REMOTE_URL = "https://github.com/test-owner/test-repo.git";

function getWorkspaceRowTestId(workspaceId: string): string {
  return `sidebar-workspace-row-${getServerId()}:${workspaceId}`;
}

async function openWorkspaceFromSidebar(
  page: import("@playwright/test").Page,
  workspaceId: string,
) {
  const row = page.getByTestId(getWorkspaceRowTestId(workspaceId));
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.click();
  await expect(page).toHaveURL(/\/workspace\//, { timeout: 30_000 });
  return row;
}

async function waitForSidebarProject(page: import("@playwright/test").Page, projectName: string) {
  const row = page
    .getByRole("button", {
      name: new RegExp(escapeRegex(projectName), "i"),
    })
    .first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  return row;
}

async function waitForSidebarWorkspace(page: import("@playwright/test").Page, workspaceId: string) {
  const row = page.getByTestId(getWorkspaceRowTestId(workspaceId));
  await expect(row).toBeVisible({ timeout: 30_000 });
  return row;
}

async function openWorkspaceReadAction(
  page: import("@playwright/test").Page,
  workspaceId: string,
  action: "read" | "unread",
) {
  const workspaceKey = `${getServerId()}:${workspaceId}`;
  const row = await waitForSidebarWorkspace(page, workspaceId);
  await row.hover();
  await page.getByTestId(`sidebar-workspace-kebab-${workspaceKey}`).click();
  const item = page.getByTestId(`sidebar-workspace-menu-mark-as-${action}-${workspaceKey}`);
  await expect(item).toBeVisible({ timeout: 30_000 });
  return item;
}

async function openWorkspaceHoverCard(page: import("@playwright/test").Page, workspaceId: string) {
  const row = await waitForSidebarWorkspace(page, workspaceId);
  await row.hover();

  const hoverCard = page.getByRole("menu", { name: "Workspace scripts" });
  await expect(hoverCard).toBeVisible({ timeout: 30_000 });
  return hoverCard;
}

interface PaseoOwnedWorktree {
  projectName: string;
  workspaceId: string;
  worktreeSlug: string;
}

async function withPaseoOwnedWorktree(
  run: (workspace: PaseoOwnedWorktree) => Promise<void>,
): Promise<void> {
  const project = await seedWorkspace({ repoPrefix: "sidebar-hover-owned-worktree-" });
  const worktreeSlug = "hover-card-owned-worktree";

  try {
    const created = await project.client.createWorkspace({
      source: {
        kind: "worktree",
        cwd: project.repoPath,
        projectId: project.projectId,
        worktreeSlug,
      },
    });
    if (!created.workspace) {
      throw new Error(created.error ?? "Failed to create Paseo-owned worktree");
    }
    expect(path.basename(created.workspace.workspaceDirectory)).toBe(worktreeSlug);

    await run({
      projectName: path.basename(project.repoPath),
      workspaceId: created.workspace.id,
      worktreeSlug,
    });
  } finally {
    await project.cleanup();
  }
}

test.describe("Sidebar workspace list", () => {
  test("project with GitHub remote shows its selected folder name in sidebar", async ({ page }) => {
    const workspace = await seedWorkspace({
      repoPrefix: "sidebar-remote-",
      repo: { withRemote: true, originUrl: GITHUB_REMOTE_URL },
    });

    try {
      const projectName = path.basename(workspace.repoPath);
      await gotoAppShell(page);
      await waitForSidebarProject(page, projectName);
      await waitForSidebarWorkspace(page, workspace.workspaceId);

      const projectRow = page
        .locator('[data-testid^="sidebar-project-row-"]')
        .filter({ hasText: projectName })
        .first();

      await expect(projectRow).toBeVisible({ timeout: 30_000 });
      await expect(projectRow).not.toContainText("test-owner/test-repo");
    } finally {
      await workspace.cleanup();
    }
  });

  test("non-git project shows directory name", async ({ page }) => {
    const workspace = await seedWorkspace({ repoPrefix: "sidebar-directory-", git: false });

    try {
      await gotoAppShell(page);

      const directoryName = path.basename(workspace.repoPath);
      const projectRow = await waitForSidebarProject(page, directoryName);
      await expect(projectRow).toContainText(directoryName);
    } finally {
      await workspace.cleanup();
    }
  });

  test("workspace header uses the selected folder name instead of its GitHub remote", async ({
    page,
  }) => {
    const workspace = await seedWorkspace({
      repoPrefix: "sidebar-header-",
      repo: { withRemote: true, originUrl: GITHUB_REMOTE_URL },
    });

    try {
      const projectName = path.basename(workspace.repoPath);
      await gotoAppShell(page);
      await waitForSidebarProject(page, projectName);
      await waitForSidebarWorkspace(page, workspace.workspaceId);
      await openWorkspaceFromSidebar(page, workspace.workspaceId);

      await expectWorkspaceHeader(page, {
        title: workspace.workspaceName,
        subtitle: projectName,
      });
    } finally {
      await workspace.cleanup();
    }
  });

  test("git project shows branch name in workspace row", async ({ page }) => {
    const workspace = await seedWorkspace({ repoPrefix: "sidebar-branch-" });

    try {
      await gotoAppShell(page);
      await waitForSidebarProject(page, path.basename(workspace.repoPath));

      expect(workspace.workspaceName).toBe("main");
      await expect(await waitForSidebarWorkspace(page, workspace.workspaceId)).toContainText(
        "main",
      );
    } finally {
      await workspace.cleanup();
    }
  });

  test("workspace hover card shows host as metadata", async ({ page }) => {
    const workspace = await seedWorkspace({ repoPrefix: "sidebar-hover-host-" });

    try {
      await gotoAppShell(page);
      await waitForSidebarProject(page, path.basename(workspace.repoPath));

      const hoverCard = await openWorkspaceHoverCard(page, workspace.workspaceId);
      await expect(page.getByTestId("hover-card-workspace-host")).toHaveText("localhost");
      await expect(hoverCard).not.toContainText(/\b(Online|Connecting|Offline|Error|Idle)\b/);
    } finally {
      await workspace.cleanup();
    }
  });

  test("marks a finished workspace unread until it is opened again", async ({ page }) => {
    const workspace = await seedMockAgentWorkspace({
      repoPrefix: "sidebar-mark-unread-",
      title: "Mark unread",
      initialPrompt: "Finish this test turn.",
    });

    try {
      await workspace.client.waitForFinish(workspace.agentId, 20_000);
      await workspace.client.clearWorkspaceAttention(workspace.workspaceId);
      expect(workspace.client.getLastServerInfoMessage()?.features?.workspaceMarkUnread).toBe(true);
      await gotoAppShell(page);

      const row = await waitForSidebarWorkspace(page, workspace.workspaceId);
      await expect(row.getByTestId("workspace-status-indicator-done")).toBeVisible();
      await (await openWorkspaceReadAction(page, workspace.workspaceId, "unread")).click();
      await openWorkspaceReadAction(page, workspace.workspaceId, "read");

      await page.keyboard.press("Escape");
      await openWorkspaceFromSidebar(page, workspace.workspaceId);
      await openWorkspaceReadAction(page, workspace.workspaceId, "unread");
    } finally {
      await workspace.cleanup();
    }
  });

  test("Paseo-owned worktree hover card shows the worktree directory name", async ({ page }) => {
    await withPaseoOwnedWorktree(async ({ projectName, workspaceId, worktreeSlug }) => {
      await gotoAppShell(page);
      await waitForSidebarProject(page, projectName);
      await openWorkspaceHoverCard(page, workspaceId);

      await expect(page.getByTestId("hover-card-workspace-cwd")).toHaveText(worktreeSlug);
    });
  });

  test("eases a project section with several workspaces instead of snapping", async ({ page }) => {
    const seeded = await seedWorkspace({
      git: false,
      repoPrefix: "sidebar-project-collapse-clip-",
      title: "One",
    });
    const siblingDirs = await Promise.all([
      createTempDirectory("sidebar-project-collapse-clip-two-"),
      createTempDirectory("sidebar-project-collapse-clip-three-"),
      createTempDirectory("sidebar-project-collapse-clip-four-"),
    ]);
    try {
      const siblings = await Promise.all(
        siblingDirs.map((directory, index) =>
          createWorkspaceInProject({
            client: seeded.client,
            path: directory.path,
            projectId: seeded.projectId,
            title: ["Two", "Three", "Four"][index] ?? "Extra",
          }),
        ),
      );
      await gotoAppShell(page);
      await waitForSidebarHydration(page);
      await expect(page.getByTestId(getWorkspaceRowTestId(seeded.workspaceId))).toBeVisible({
        timeout: 30_000,
      });
      for (const sibling of siblings) {
        await expect(page.getByTestId(getWorkspaceRowTestId(sibling.id))).toBeVisible({
          timeout: 30_000,
        });
      }

      const header = page.getByTestId(
        `sidebar-project-row-${projectEquivalenceViewKey(seeded.projectKey)}`,
      );
      const clip = page.getByTestId(
        `sidebar-project-collapse-clip-${projectEquivalenceViewKey(seeded.projectKey)}`,
      );
      await header.click();
      await expect(page.getByTestId(getWorkspaceRowTestId(seeded.workspaceId))).toHaveCount(0, {
        timeout: 10_000,
      });

      await page.evaluate(() => {
        const samples: Array<{ clipHeight: number; contentHeight: number }> = [];
        const startedAt = performance.now();
        const sample = () => {
          const clipNode = document.querySelector<HTMLElement>(
            '[data-testid^="sidebar-project-collapse-clip-"]',
          );
          const inner = clipNode?.firstElementChild;
          if (clipNode instanceof HTMLElement && inner instanceof HTMLElement) {
            samples.push({
              clipHeight: clipNode.getBoundingClientRect().height,
              contentHeight: inner.getBoundingClientRect().height,
            });
          }
          if (performance.now() - startedAt < 600) {
            requestAnimationFrame(sample);
            return;
          }
          Reflect.set(globalThis, "__sidebarProjectCollapseClipSamples", samples);
        };
        requestAnimationFrame(sample);
      });

      await header.click();
      await expect(clip).toBeVisible();
      await expect(page.getByTestId(getWorkspaceRowTestId(seeded.workspaceId))).toBeVisible({
        timeout: 10_000,
      });
      await page.waitForTimeout(700);

      const samples = await page.evaluate(
        () =>
          Reflect.get(globalThis, "__sidebarProjectCollapseClipSamples") as Array<{
            clipHeight: number;
            contentHeight: number;
          }>,
      );
      const grownIndex = samples.findIndex((sample) => sample.clipHeight > 20);
      const afterGrowth = grownIndex === -1 ? [] : samples.slice(grownIndex);
      const clippingSummary = {
        count: samples.length,
        clipping: samples.filter((sample) => sample.contentHeight - sample.clipHeight > 2).length,
        uniqueClipHeights: new Set(samples.map((sample) => Math.round(sample.clipHeight))).size,
        collapsedAfterGrowth: afterGrowth.filter((sample) => sample.clipHeight < 8).length,
      };
      expect(
        clippingSummary.clipping,
        `expected the project child list to stay clipped while it expands, received ${JSON.stringify(clippingSummary)}`,
      ).toBeGreaterThan(2);
      expect(
        clippingSummary.uniqueClipHeights,
        `expected the project clip height to ease across frames, received ${JSON.stringify(clippingSummary)}`,
      ).toBeGreaterThan(2);
      expect(
        clippingSummary.collapsedAfterGrowth,
        `expected the project clip not to collapse when it releases auto height, received ${JSON.stringify(clippingSummary)}`,
      ).toBe(0);
    } finally {
      for (const directory of siblingDirs) {
        try {
          await directory.cleanup();
        } catch {
          // Best-effort; the seeded project cleanup still runs.
        }
      }
      await seeded.cleanup();
    }
  });

  test("keeps a lower project's collapse clip from painting into collapsed rows above it", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const upper = await seedWorkspace({
      git: false,
      repoPrefix: "sidebar-collapse-clip-upper-",
      title: "Upper",
    });
    const middle = await seedWorkspace({
      git: false,
      repoPrefix: "sidebar-collapse-clip-middle-",
      title: "Middle",
    });
    const lower = await seedWorkspace({
      git: false,
      repoPrefix: "sidebar-collapse-clip-lower-",
      title: "Lower",
    });

    try {
      await gotoAppShell(page);
      await waitForSidebarHydration(page);
      const upperHeader = page.getByTestId(
        `sidebar-project-row-${projectEquivalenceViewKey(upper.projectKey)}`,
      );
      const middleHeader = page.getByTestId(
        `sidebar-project-row-${projectEquivalenceViewKey(middle.projectKey)}`,
      );
      const lowerHeader = page.getByTestId(
        `sidebar-project-row-${projectEquivalenceViewKey(lower.projectKey)}`,
      );
      await expect(upperHeader).toBeVisible({ timeout: 30_000 });
      await expect(middleHeader).toBeVisible();
      await expect(lowerHeader).toBeVisible();

      await upperHeader.click();
      await middleHeader.click();
      await expect(page.getByTestId(getWorkspaceRowTestId(upper.workspaceId))).toHaveCount(0, {
        timeout: 10_000,
      });
      await expect(page.getByTestId(getWorkspaceRowTestId(middle.workspaceId))).toHaveCount(0);

      const lowerClipTestId = `sidebar-project-collapse-clip-${projectEquivalenceViewKey(lower.projectKey)}`;
      await lowerHeader.click();
      await expect(page.getByTestId(getWorkspaceRowTestId(lower.workspaceId))).toHaveCount(0, {
        timeout: 10_000,
      });
      await page.waitForTimeout(220);

      await page.evaluate((clipTestId) => {
        const samples: Array<{ clipTop: number; innerTop: number }> = [];
        const startedAt = performance.now();
        const sample = () => {
          const clip = document.querySelector<HTMLElement>(`[data-testid="${clipTestId}"]`);
          const inner = clip?.firstElementChild;
          if (clip instanceof HTMLElement && inner instanceof HTMLElement) {
            samples.push({
              clipTop: clip.getBoundingClientRect().top,
              innerTop: inner.getBoundingClientRect().top,
            });
          }
          if (performance.now() - startedAt < 600) {
            requestAnimationFrame(sample);
            return;
          }
          Reflect.set(globalThis, "__sidebarLowerProjectCollapsePlacementSamples", samples);
        };
        requestAnimationFrame(sample);
      }, lowerClipTestId);

      await lowerHeader.click();
      await expect(page.getByTestId(getWorkspaceRowTestId(lower.workspaceId))).toBeVisible({
        timeout: 10_000,
      });
      await page.waitForTimeout(700);

      const samples = await page.evaluate(
        () =>
          Reflect.get(globalThis, "__sidebarLowerProjectCollapsePlacementSamples") as Array<{
            clipTop: number;
            innerTop: number;
          }>,
      );
      const misplaced = samples.filter((sample) => sample.clipTop - sample.innerTop > 8);
      expect(
        misplaced.length,
        `expected the expanding inner to stay in the lower clip, received ${JSON.stringify({
          count: samples.length,
          misplaced: misplaced.length,
          first: samples[0],
          worst: misplaced[0],
        })}`,
      ).toBe(0);
    } finally {
      await lower.cleanup();
      await middle.cleanup();
      await upper.cleanup();
    }
  });
});

test.describe("Mobile sidebar panelState transition", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("showMobileAgent open and close transition", async ({ page }) => {
    await gotoAppShell(page);
    await expectMobileAgentSidebarHidden(page);
    await openMobileAgentSidebar(page);
    await expectMobileAgentSidebarVisible(page);
    await closeMobileAgentSidebar(page);
    await expectMobileAgentSidebarHidden(page);
  });

  test("keeps a pinned workspace rendered while the retained sidebar is closed", async ({
    page,
  }) => {
    const workspace = await seedWorkspace({ repoPrefix: "sidebar-retained-pin-" });

    try {
      await gotoAppShell(page);
      await openMobileAgentSidebar(page);
      await expectMobileAgentSidebarVisible(page);

      const row = page.getByTestId(getWorkspaceRowTestId(workspace.workspaceId));
      await expect(row).toBeVisible({ timeout: 30_000 });
      await pinWorkspaceFromSidebar(page, workspace.workspaceId);
      await expect(page.getByTestId("sidebar-pinned-section")).toBeVisible();

      await closeMobileAgentSidebar(page);
      await expectMobileAgentSidebarHidden(page);

      await expect(row).toHaveCount(1);
    } finally {
      await workspace.cleanup();
    }
  });
});

test.describe("Half-screen desktop layout", () => {
  test.use({ viewport: { width: 751, height: 982 } });

  test("keeps the sidebar scroll position across close and reopen", async ({ page }) => {
    const workspace = await seedWorkspace({ repoPrefix: "sidebar-retained-scroll-" });

    try {
      let lastWorkspaceId = workspace.workspaceId;
      for (let index = 0; index < 24; index += 1) {
        const created = await workspace.client.createWorkspace({
          source: {
            kind: "directory",
            path: workspace.repoPath,
            projectId: workspace.projectId,
          },
          title: `Retained sidebar ${index + 1}`,
        });
        if (!created.workspace) {
          throw new Error(created.error ?? "Failed to fill the retained sidebar");
        }
        lastWorkspaceId = created.workspace.id;
      }

      await gotoAppShell(page);
      await page
        .getByTestId(`sidebar-project-show-more-${projectEquivalenceViewKey(workspace.projectKey)}`)
        .click();
      await waitForSidebarWorkspace(page, lastWorkspaceId);

      const sidebarScroll = page.getByTestId("sidebar-project-workspace-list-scroll");
      const scrollTop = await sidebarScroll.evaluate((element) => {
        element.scrollTop = 160;
        return element.scrollTop;
      });
      expect(scrollTop).toBe(160);

      await page.getByTestId("menu-button").click();
      await expect(page.getByTestId("sidebar-global-new-workspace")).not.toBeVisible();

      await page.getByTestId("menu-button").click();
      await expect(page.getByTestId("sidebar-global-new-workspace")).toBeVisible();
      await expect(sidebarScroll).toHaveJSProperty("scrollTop", scrollTop);
    } finally {
      await workspace.cleanup();
    }
  });

  test("keeps the pinned sidebar at half of a 14-inch Mac display", async ({ page }) => {
    await gotoAppShell(page);
    await expect(page.getByTestId("sidebar-global-new-workspace")).toBeVisible();
    await expect(page.getByTestId("agent-list-backdrop")).not.toBeVisible();
  });

  test("keeps the left toggle center-owned without left window controls", async ({ page }) => {
    await gotoAppShell(page);

    const openToggle = page.getByTestId("menu-button");
    const openIcon = openToggle.locator("svg").first();
    await expect(openIcon).toBeVisible();
    const openBounds = await openIcon.boundingBox();
    expect(openBounds).not.toBeNull();
    expect(openBounds?.x).toBeGreaterThan(12);

    await openToggle.click();
    await expect(page.getByTestId("sidebar-global-new-workspace")).not.toBeVisible();

    const closedToggle = page.getByTestId("menu-button");
    const closedIcon = closedToggle.locator("svg").first();
    await expect(closedIcon).toBeVisible();
    const closedBounds = await closedIcon.boundingBox();
    expect(closedBounds).not.toBeNull();
    expect(closedBounds?.x).toBeCloseTo(9, 0);
    expect(closedBounds?.y).toBe(openBounds?.y);
  });

  test("yields app navigation to the settings split", async ({ page }) => {
    await gotoAppShell(page);
    await page.getByTestId("sidebar-settings").click();

    await expect(page.getByTestId("settings-sidebar")).toBeVisible();
    await expect(page.getByTestId("settings-detail-pane")).toBeVisible();
    await expect(page.getByTestId("sidebar-settings")).not.toBeVisible();
  });

  test("keeps app navigation beside the Explorer pane", async ({ page }) => {
    const workspace = await seedWorkspace({ repoPrefix: "sidebar-half-screen-explorer-" });

    try {
      await gotoAppShell(page);
      await waitForSidebarProject(page, path.basename(workspace.repoPath));
      await openWorkspaceFromSidebar(page, workspace.workspaceId);

      await openFilesPanel(page);
      const explorerToggle = page.getByTestId("workspace-explorer-toggle").first();
      await expect(
        page.getByTestId("explorer-sidebar-tab-files").filter({ visible: true }),
      ).toBeVisible();
      await expect(explorerToggle).toHaveAccessibleName("Close Explorer sidebar");
      await expect(page.getByTestId("sidebar-global-new-workspace")).toBeVisible();
      await expect(page.getByTestId("explorer-sidebar-tab-rail")).toBeVisible();
      await expect(page.getByTestId("workspace-tabs-row").filter({ visible: true })).toHaveCount(1);

      await explorerToggle.click();
      await expect(
        page.getByTestId("explorer-sidebar-tab-files").filter({ visible: true }),
      ).toHaveCount(0);
      await expect(explorerToggle).toHaveAccessibleName("Open Explorer sidebar");
      await expect(page.getByTestId("sidebar-global-new-workspace")).toBeVisible();
    } finally {
      await workspace.cleanup();
    }
  });
});
