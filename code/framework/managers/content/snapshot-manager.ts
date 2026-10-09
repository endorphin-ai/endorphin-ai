/**
 * Page Snapshot Manager
 * Handles creation, storage, and comparison of page snapshots
 */

import { Page } from 'playwright';
import { warn, logWithIcon, LogLevel } from '../../core/logger.js';
import type {
  ChangeRecord,
  DeltaSummary,
  DOMSnapshot,
  ElementSnapshot,
  FormSnapshot,
  InteractiveSnapshot,
  PageDelta,
  PageSnapshot,
  SnapshotCaptureOptions,
  SnapshotMetadata,
} from '../../content/types/snapshot-types.js';
// Content optimization removed - using basic content extraction only

export class PageSnapshotManager {
  private snapshots: Map<string, PageSnapshot> = new Map();
  private currentSnapshotId: string | null = null;
  private previousSnapshotId: string | null = null;
  private currentUrl: string | null = null;
  private maxSnapshots: number = 3; // Reduced from 10 to save memory
  private maxTextLength: number = 100; // Reduced from 200
  private elementCache: WeakMap<object, ElementSnapshot> = new WeakMap(); // Use WeakMap for auto cleanup
  // Content optimizer removed - using basic extraction only

  /**
   * Create basic content snapshot for HTML snapshots
   */
  async createOptimizedSnapshot(
    page: Page,
    _context: any = {},
    _id?: string
  ): Promise<string> {
    try {
      // Basic content extraction for HTML snapshots
      const content = await page.evaluate(() => {
        // Remove scripts and styles for clean snapshot
        const clone = document.body.cloneNode(true) as Element;
        clone.querySelectorAll('script, style, noscript').forEach((el) => el.remove());
        return clone.textContent?.trim() || '';
      });

      return content.substring(0, 5000); // Limit content length for snapshots
    } catch (error) {
      warn('Failed to extract snapshot content', { error: String(error) }, 'SnapshotManager');
      return 'Unable to extract page content';
    }
  }

  /**
   * Create a new page snapshot
   */
  async createSnapshot(page: Page, url?: string): Promise<string> {
    // Create basic content snapshot for HTML snapshots
    return await this.createOptimizedSnapshot(page, {}, url);
  }

  /**
   * Create a full page snapshot with all details
   */
  async createFullSnapshot(
    page: Page,
    id?: string,
    options: SnapshotCaptureOptions = {}
  ): Promise<PageSnapshot> {
    const snapshotId = id || `snapshot_${Date.now()}`;

    try {
      const [title, url, viewport] = await Promise.all([
        page.title(),
        page.url(),
        page.viewportSize(),
      ]);

      // Check if URL has changed - if so, clear all snapshots
      if (this.currentUrl && this.currentUrl !== url) {
        logWithIcon(LogLevel.DEBUG, 'debug', `URL changed from ${this.currentUrl} to ${url} - clearing snapshots`, { oldUrl: this.currentUrl, newUrl: url }, 'SnapshotManager');
        this.clearAll();
      }
      this.currentUrl = url;

      // Capture DOM elements with their states
      const domSnapshot = await this.captureDOMSnapshot(page);

      // Capture form states
      const forms = options.includeForms !== false ? await this.captureFormSnapshots(page) : [];

      // Capture interactive elements
      const interactive =
        options.includeInteractive !== false ? await this.captureInteractiveSnapshots(page) : [];

      // Capture metadata
      const metadata =
        options.includeMetadata !== false
          ? await this.captureMetadata(page, viewport)
          : {
              pageLoadState: 'complete',
              networkIdle: true,
              scrollPosition: { x: 0, y: 0 },
              viewportSize: viewport || { width: 1280, height: 720 },
              elementCounts: {
                total: 0,
                interactive: 0,
                forms: 0,
                links: 0,
                buttons: 0,
                inputs: 0,
              },
            };

      const snapshot: PageSnapshot = {
        id: snapshotId,
        timestamp: Date.now(),
        url,
        title,
        dom: domSnapshot,
        forms,
        interactive,
        metadata,
      };

      // Update snapshot tracking
      this.previousSnapshotId = this.currentSnapshotId;
      this.currentSnapshotId = snapshotId;

      // Store snapshot
      this.snapshots.set(snapshotId, snapshot);

      // Aggressive cleanup to prevent memory leaks
      this.cleanupOldSnapshots();

      return snapshot;
    } catch (error) {
      throw new Error(
        `Failed to create page snapshot: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Compare current page state with previous snapshot
   */
  async compareWithPrevious(page: Page): Promise<PageDelta | null> {
    if (!this.currentSnapshotId) {
      return null;
    }

    const previousSnapshot = this.snapshots.get(this.currentSnapshotId);
    if (!previousSnapshot) {
      return null;
    }

    // Create new snapshot for comparison
    const currentSnapshot = await this.createFullSnapshot(page);

    return this.compareSnapshots(previousSnapshot, currentSnapshot);
  }

  /**
   * Compare two snapshots and generate delta
   */
  compareSnapshots(previous: PageSnapshot, current: PageSnapshot): PageDelta {
    const changes: ChangeRecord[] = [];

    // Create lookup maps for efficient comparison
    const previousElements = new Map(previous.dom.elements.map((el) => [el.selector, el]));
    const currentElements = new Map(current.dom.elements.map((el) => [el.selector, el]));

    // Find added elements
    for (const [selector, element] of currentElements) {
      if (!previousElements.has(selector)) {
        changes.push({
          type: 'added',
          element,
          description: `Element added: ${element.tagName}${element.textContent ? ` with text "${element.textContent.slice(0, 50)}"` : ''}`,
        });
      }
    }

    // Find removed elements
    for (const [selector, element] of previousElements) {
      if (!currentElements.has(selector)) {
        changes.push({
          type: 'removed',
          element,
          description: `Element removed: ${element.tagName}${element.textContent ? ` with text "${element.textContent.slice(0, 50)}"` : ''}`,
        });
      }
    }

    // Find modified elements
    for (const [selector, currentElement] of currentElements) {
      const previousElement = previousElements.get(selector);
      if (previousElement && previousElement.hash !== currentElement.hash) {
        const changes_detail = this.getElementChanges(previousElement, currentElement);
        changes.push({
          type: 'modified',
          element: currentElement,
          previousState: previousElement,
          description: `Element modified: ${currentElement.tagName} - ${changes_detail}`,
        });
      }
    }

    // Generate summary
    const summary: DeltaSummary = {
      totalChanges: changes.length,
      addedElements: changes.filter((c) => c.type === 'added').length,
      removedElements: changes.filter((c) => c.type === 'removed').length,
      modifiedElements: changes.filter((c) => c.type === 'modified').length,
      movedElements: 0, // TODO: Implement move detection
      affectedForms: this.countAffectedForms(changes, previous.forms),
      affectedInteractive: this.countAffectedInteractive(changes, previous.interactive),
      significance: this.calculateSignificance(changes),
    };

    return {
      snapshotId: current.id,
      previousSnapshotId: previous.id,
      timestamp: current.timestamp,
      changes,
      summary,
    };
  }

  /**
   * Get current snapshot
   */
  getCurrentSnapshot(): PageSnapshot | null {
    return this.currentSnapshotId ? this.snapshots.get(this.currentSnapshotId) || null : null;
  }

  /**
   * Get snapshot by ID
   */
  getSnapshot(id: string): PageSnapshot | null {
    return this.snapshots.get(id) || null;
  }

  /**
   * Get all snapshots
   */
  getAllSnapshots(): PageSnapshot[] {
    return Array.from(this.snapshots.values());
  }

  /**
   * Clear all snapshots to free memory
   */
  clearAll(): void {
    this.snapshots.clear();
    this.currentSnapshotId = null;
    this.previousSnapshotId = null;
    this.currentUrl = null;
    // WeakMap will automatically clean up elementCache
  }

  /**
   * Get memory usage estimate
   */
  getMemoryUsage(): { snapshotCount: number; estimatedSizeMB: number; currentUrl: string | null } {
    const snapshotCount = this.snapshots.size;
    let totalElements = 0;

    for (const snapshot of this.snapshots.values()) {
      totalElements += snapshot.dom.elements.length;
    }

    // Rough estimate: ~1KB per element
    const estimatedSizeMB = (totalElements * 1024) / (1024 * 1024);

    return { snapshotCount, estimatedSizeMB, currentUrl: this.currentUrl };
  }

  /**
   * Check if page URL has changed and clear snapshots if needed
   */
  async checkUrlChange(page: Page): Promise<boolean> {
    const currentUrl = await page.url();

    if (this.currentUrl && this.currentUrl !== currentUrl) {
      logWithIcon(LogLevel.DEBUG, 'debug', `URL changed from ${this.currentUrl} to ${currentUrl} - clearing snapshots`, { oldUrl: this.currentUrl, newUrl: currentUrl }, 'SnapshotManager');
      this.clearAll();
      this.currentUrl = currentUrl;
      return true; // URL changed
    }

    if (!this.currentUrl) {
      this.currentUrl = currentUrl;
    }

    return false; // URL didn't change
  }

  /**
   * Force garbage collection of snapshots (for testing/debugging)
   */
  forceCleanup(): void {
    this.cleanupOldSnapshots();

    // Clear element cache
    this.elementCache = new WeakMap();

    if (global.gc) {
      global.gc();
      logWithIcon(LogLevel.DEBUG, 'debug', 'Forced garbage collection', {}, 'SnapshotManager');
    }
  }

  // Private methods for capturing snapshot data
  private async captureDOMSnapshot(page: Page): Promise<DOMSnapshot> {
    const elements = await page.evaluate(() => {
      function generateSelector(element: Element): string {
        if (element.id) {
          return `#${element.id}`;
        }

        const testId = element.getAttribute('data-testid');
        if (testId) {
          return `[data-testid="${testId}"]`;
        }

        // Try unique class combination
        if (element.className && typeof element.className === 'string') {
          const classes = element.className.split(' ').filter((c) => c.trim());
          if (classes.length > 0) {
            const classSelector = `.${classes.join('.')}`;
            const doc = element.ownerDocument || document;
            if (doc.querySelectorAll(classSelector).length === 1) {
              return classSelector;
            }
          }
        }

        // Fall back to tag + nth-child
        const parent = element.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(
            (el) => el.tagName === element.tagName
          );
          const index = siblings.indexOf(element);
          return `${element.tagName.toLowerCase()}:nth-child(${index + 1})`;
        }

        return element.tagName.toLowerCase();
      }

      // Simple hash function in browser context
      function simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = (hash << 5) - hash + char;
          hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(36);
      }

      return Array.from(document.querySelectorAll('*')).map((el, index) => {
        const rect = el.getBoundingClientRect();
        const isVisible =
          rect.width > 0 &&
          rect.height > 0 &&
          window.getComputedStyle(el).visibility !== 'hidden' &&
          window.getComputedStyle(el).display !== 'none';

        // Only store important attributes to save memory
        const importantAttrs = [
          'id',
          'class',
          'data-testid',
          'href',
          'src',
          'alt',
          'title',
          'name',
          'type',
          'value',
          'placeholder',
        ];
        const attributes: Record<string, string> = {};
        Array.from(el.attributes).forEach((attr) => {
          if (importantAttrs.includes(attr.name) || attr.name.startsWith('data-')) {
            attributes[attr.name] = attr.value.slice(0, 100); // Limit attribute value length
          }
        });

        const textContent = el.textContent?.trim() || '';
        const selector = generateSelector(el);

        // Create hash for quick comparison
        const hashData = `${el.tagName}|${textContent}|${JSON.stringify(attributes)}|${isVisible}`;
        const hash = simpleHash(hashData);

        return {
          id: `element_${index}`,
          tagName: el.tagName,
          selector,
          textContent: textContent.slice(0, 100), // Limit text length for memory efficiency
          attributes,
          isVisible,
          bounds: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
          hash,
        };
      });
    });

    const visibleElements = elements.filter((el) => el.isVisible).length;

    return {
      elements,
      totalElements: elements.length,
      visibleElements,
    };
  }

  private async captureFormSnapshots(page: Page): Promise<FormSnapshot[]> {
    return await page.evaluate(() => {
      function generateSelector(element: Element): string {
        if (element.id) return `#${element.id}`;
        const testId = element.getAttribute('data-testid');
        if (testId) return `[data-testid="${testId}"]`;
        if (element.className && typeof element.className === 'string') {
          const classes = element.className.split(' ').filter((c) => c.trim());
          if (classes.length > 0) {
            const classSelector = `.${classes.join('.')}`;
            if (document.querySelectorAll(classSelector).length === 1) {
              return classSelector;
            }
          }
        }
        const parent = element.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(
            (el) => el.tagName === element.tagName
          );
          const index = siblings.indexOf(element);
          return `${element.tagName.toLowerCase()}:nth-child(${index + 1})`;
        }
        return element.tagName.toLowerCase();
      }

      return Array.from(document.querySelectorAll('form')).map((form) => {
        const fields = Array.from(form.querySelectorAll('input, select, textarea')).map((field) => {
          const input = field as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
          return {
            selector: generateSelector(input),
            type: input.type || input.tagName.toLowerCase(),
            value: input.value || '',
            placeholder: (input as HTMLInputElement).placeholder || '',
            isRequired: input.required,
            isDisabled: input.disabled,
            validationMessage:
              (input as HTMLInputElement).validationMessage || (undefined as string | undefined),
          };
        });

        const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');

        return {
          selector: generateSelector(form),
          fields,
          isValid: form.checkValidity(),
          submitButton: submitButton
            ? generateSelector(submitButton)
            : (undefined as string | undefined),
        };
      });
    });
  }

  private async captureInteractiveSnapshots(page: Page): Promise<InteractiveSnapshot[]> {
    return await page.evaluate(() => {
      function generateSelector(element: Element): string {
        if (element.id) return `#${element.id}`;
        const testId = element.getAttribute('data-testid');
        if (testId) return `[data-testid="${testId}"]`;
        if (element.className && typeof element.className === 'string') {
          const classes = element.className.split(' ').filter((c) => c.trim());
          if (classes.length > 0) {
            const classSelector = `.${classes.join('.')}`;
            if (document.querySelectorAll(classSelector).length === 1) {
              return classSelector;
            }
          }
        }
        const parent = element.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(
            (el) => el.tagName === element.tagName
          );
          const index = siblings.indexOf(element);
          return `${element.tagName.toLowerCase()}:nth-child(${index + 1})`;
        }
        return element.tagName.toLowerCase();
      }

      return Array.from(
        document.querySelectorAll(
          'button, a, input[type="button"], input[type="submit"], [onclick], [role="button"]'
        )
      ).map((el) => {
        const isVisible =
          el.getBoundingClientRect().width > 0 &&
          el.getBoundingClientRect().height > 0 &&
          window.getComputedStyle(el).visibility !== 'hidden';

        return {
          selector: generateSelector(el),
          tagName: el.tagName,
          type: (el as HTMLInputElement).type || 'element',
          textContent: el.textContent?.trim() || '',
          isEnabled: !(el as HTMLButtonElement | HTMLInputElement).disabled,
          isVisible,
          href: (el as HTMLAnchorElement).href || (undefined as string | undefined),
        };
      });
    });
  }

  private async captureMetadata(page: Page, viewport: any): Promise<SnapshotMetadata> {
    const [scrollPosition, elementCounts] = await Promise.all([
      page.evaluate(() => ({ x: window.scrollX, y: window.scrollY })),
      page.evaluate(() => ({
        total: document.querySelectorAll('*').length,
        interactive: document.querySelectorAll('button, a, input, select, textarea').length,
        forms: document.querySelectorAll('form').length,
        links: document.querySelectorAll('a').length,
        buttons: document.querySelectorAll('button, input[type="button"], input[type="submit"]')
          .length,
        inputs: document.querySelectorAll('input, select, textarea').length,
      })),
    ]);

    return {
      pageLoadState: await page.evaluate(() => document.readyState),
      networkIdle: true, // Simplified for now
      scrollPosition,
      viewportSize: viewport,
      elementCounts,
    };
  }

  private getElementChanges(previous: ElementSnapshot, current: ElementSnapshot): string {
    const changes: string[] = [];

    if (previous.textContent !== current.textContent) {
      changes.push(
        `text changed from "${previous.textContent.slice(0, 30)}" to "${current.textContent.slice(0, 30)}"`
      );
    }

    if (previous.isVisible !== current.isVisible) {
      changes.push(`visibility changed to ${current.isVisible ? 'visible' : 'hidden'}`);
    }

    // Check attribute changes
    const _prevAttrs = Object.keys(previous.attributes);
    const currAttrs = Object.keys(current.attributes);

    for (const attr of currAttrs) {
      if (previous.attributes[attr] !== current.attributes[attr]) {
        changes.push(`${attr} attribute changed`);
      }
    }

    return changes.length > 0 ? changes.join(', ') : 'unknown changes';
  }

  private countAffectedForms(changes: ChangeRecord[], forms: FormSnapshot[]): number {
    const affectedSelectors = new Set(changes.map((c) => c.element.selector));
    return forms.filter(
      (form) =>
        affectedSelectors.has(form.selector) ||
        form.fields.some((field) => affectedSelectors.has(field.selector))
    ).length;
  }

  private countAffectedInteractive(
    changes: ChangeRecord[],
    interactive: InteractiveSnapshot[]
  ): number {
    const affectedSelectors = new Set(changes.map((c) => c.element.selector));
    return interactive.filter((el) => affectedSelectors.has(el.selector)).length;
  }

  private calculateSignificance(changes: ChangeRecord[]): 'minor' | 'moderate' | 'major' {
    if (changes.length === 0) return 'minor';
    if (changes.length < 5) return 'minor';
    if (changes.length < 15) return 'moderate';
    return 'major';
  }

  private cleanupOldSnapshots(): void {
    if (this.snapshots.size > this.maxSnapshots) {
      const sortedIds = Array.from(this.snapshots.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)
        .map(([id]) => id);

      // Keep only the most recent snapshots and the previous one for comparison
      const toKeep = new Set([this.currentSnapshotId, this.previousSnapshotId].filter(Boolean));
      const recentIds = sortedIds.slice(-this.maxSnapshots);
      recentIds.forEach((id) => toKeep.add(id));

      // Delete all others
      for (const id of this.snapshots.keys()) {
        if (!toKeep.has(id)) {
          this.snapshots.delete(id);
        }
      }
    }
  }
}
