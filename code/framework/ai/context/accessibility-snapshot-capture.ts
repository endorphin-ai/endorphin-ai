/**
 * Custom Accessibility Tree Capture
 *
 * Replaces Playwright's removed page.accessibility.snapshot() API (removed in v1.57)
 * with a DOM-based traversal using page.evaluate(). Produces the same
 * AccessibilityNode tree structure used by the serializer, differ, and injector.
 */

import type { Page } from 'playwright';
import type { AccessibilityNode } from '../../types/accessibility.js';

/**
 * Capture the accessibility tree from a page by traversing the DOM.
 *
 * Uses page.evaluate() to walk the DOM tree, mapping HTML elements to ARIA roles,
 * extracting accessible names, and reading state properties. Produces the same
 * AccessibilityNode structure that Playwright's old page.accessibility.snapshot() returned.
 *
 * @param page - The Playwright Page object
 * @returns The root AccessibilityNode, or null if capture fails
 */
export async function captureAccessibilityTree(page: Page): Promise<AccessibilityNode | null> {
  try {
    const tree = await page.evaluate(() => {
      // --- HTML-AAM Implicit Role Mapping ---
      const IMPLICIT_ROLES: Record<string, string | ((el: Element) => string)> = {
        A: (el) => el.hasAttribute('href') ? 'link' : 'generic',
        ARTICLE: 'article',
        ASIDE: 'complementary',
        BUTTON: 'button',
        DATALIST: 'listbox',
        DETAILS: 'group',
        DIALOG: 'dialog',
        DL: 'list',
        FIELDSET: 'group',
        FIGURE: 'figure',
        FOOTER: (el) => {
          const parent = el.parentElement;
          if (!parent) return 'contentinfo';
          const tag = parent.tagName;
          return (tag === 'ARTICLE' || tag === 'ASIDE' || tag === 'MAIN' ||
                  tag === 'NAV' || tag === 'SECTION') ? 'generic' : 'contentinfo';
        },
        FORM: 'form',
        H1: 'heading',
        H2: 'heading',
        H3: 'heading',
        H4: 'heading',
        H5: 'heading',
        H6: 'heading',
        HEADER: (el) => {
          const parent = el.parentElement;
          if (!parent) return 'banner';
          const tag = parent.tagName;
          return (tag === 'ARTICLE' || tag === 'ASIDE' || tag === 'MAIN' ||
                  tag === 'NAV' || tag === 'SECTION') ? 'generic' : 'banner';
        },
        HR: 'separator',
        IMG: (el) => el.getAttribute('alt') === '' ? 'presentation' : 'img',
        INPUT: (el) => {
          const type = (el as HTMLInputElement).type.toLowerCase();
          const typeMap: Record<string, string> = {
            button: 'button',
            checkbox: 'checkbox',
            email: 'textbox',
            image: 'button',
            number: 'spinbutton',
            password: 'textbox',
            radio: 'radio',
            range: 'slider',
            reset: 'button',
            search: 'searchbox',
            submit: 'button',
            tel: 'textbox',
            text: 'textbox',
            url: 'textbox',
          };
          return typeMap[type] || 'textbox';
        },
        LI: 'listitem',
        MAIN: 'main',
        MATH: 'math',
        MENU: 'list',
        NAV: 'navigation',
        OL: 'list',
        OPTGROUP: 'group',
        OPTION: 'option',
        OUTPUT: 'status',
        PROGRESS: 'progressbar',
        SECTION: 'region',
        SELECT: (el) => (el as HTMLSelectElement).multiple ? 'listbox' : 'combobox',
        SUMMARY: 'button',
        TABLE: 'table',
        TBODY: 'rowgroup',
        TD: 'cell',
        TEXTAREA: 'textbox',
        TFOOT: 'rowgroup',
        TH: 'columnheader',
        THEAD: 'rowgroup',
        TR: 'row',
        UL: 'list',
      };

      // Heading level from tag name
      const HEADING_LEVELS: Record<string, number> = {
        H1: 1, H2: 2, H3: 3, H4: 4, H5: 5, H6: 6,
      };

      // Roles that should always be included even without a name
      const STRUCTURAL_ROLES = new Set([
        'list', 'listitem', 'table', 'row', 'rowgroup', 'cell', 'columnheader',
        'navigation', 'main', 'banner', 'contentinfo', 'complementary',
        'form', 'region', 'article', 'group', 'separator',
      ]);

      // Roles that are meaningful and should be included in the tree
      const MEANINGFUL_ROLES = new Set([
        'button', 'link', 'textbox', 'combobox', 'checkbox', 'radio',
        'slider', 'spinbutton', 'switch', 'menuitem', 'tab', 'searchbox',
        'option', 'menuitemcheckbox', 'menuitemradio', 'heading', 'img',
        'dialog', 'progressbar', 'status', 'math',
        ...STRUCTURAL_ROLES,
      ]);

      function isHidden(el: Element): boolean {
        if (el.getAttribute('aria-hidden') === 'true') return true;
        if (!(el instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return true;
        if ((el as HTMLInputElement).type === 'hidden') return true;
        return false;
      }

      function getRole(el: Element): string {
        // Explicit role overrides implicit
        const explicitRole = el.getAttribute('role');
        if (explicitRole) return explicitRole.trim().split(/\s+/)[0];

        const mapping = IMPLICIT_ROLES[el.tagName];
        if (typeof mapping === 'function') return mapping(el);
        if (typeof mapping === 'string') return mapping;

        return 'generic';
      }

      function getAccessibleName(el: Element): string {
        // aria-label is highest priority
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) return ariaLabel.trim();

        // aria-labelledby
        const labelledBy = el.getAttribute('aria-labelledby');
        if (labelledBy) {
          const parts: string[] = [];
          for (const id of labelledBy.split(/\s+/)) {
            const ref = document.getElementById(id);
            if (ref) parts.push(ref.textContent?.trim() || '');
          }
          const joined = parts.join(' ').trim();
          if (joined) return joined;
        }

        // alt attribute (for images, inputs)
        const alt = el.getAttribute('alt');
        if (alt !== null && alt !== undefined) return alt.trim();

        // For inputs: associated label (handles both label[for] and wrapping <label>)
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
          if (el.labels && el.labels.length > 0) {
            const labelText = el.labels[0].textContent?.trim() || '';
            if (labelText) return labelText;
          }
          // placeholder
          if ('placeholder' in el && (el as HTMLInputElement).placeholder) {
            return (el as HTMLInputElement).placeholder;
          }
        }

        // title attribute
        const title = el.getAttribute('title');
        if (title) return title.trim();

        // For leaf interactive elements, use text content
        const role = getRole(el);
        if (['button', 'link', 'tab', 'menuitem', 'option', 'heading'].includes(role)) {
          return el.textContent?.trim() || '';
        }

        return '';
      }

      function getNodeValue(el: Element): string | number | undefined {
        if (el instanceof HTMLInputElement) {
          if (el.type === 'range' || el.type === 'number') {
            return el.valueAsNumber;
          }
          if (el.type === 'checkbox' || el.type === 'radio') return undefined;
          return el.value || undefined;
        }
        if (el instanceof HTMLTextAreaElement) return el.value || undefined;
        if (el instanceof HTMLSelectElement) {
          return el.options[el.selectedIndex]?.text || undefined;
        }
        if (el instanceof HTMLProgressElement) return el.value;
        // aria-valuenow for sliders/spinbuttons
        const ariaValue = el.getAttribute('aria-valuenow');
        if (ariaValue !== null) return parseFloat(ariaValue);
        return undefined;
      }

      function getBooleanState(el: Element, attr: string): boolean | 'mixed' | undefined {
        const val = el.getAttribute(attr);
        if (val === null) {
          // Check HTML native properties
          if (attr === 'aria-checked' && el instanceof HTMLInputElement) {
            if (el.type === 'checkbox' || el.type === 'radio') {
              return el.indeterminate ? 'mixed' : el.checked;
            }
          }
          if (attr === 'aria-disabled') {
            if ('disabled' in el && (el as HTMLInputElement).disabled) return true;
          }
          if (attr === 'aria-expanded') {
            if (el.tagName === 'DETAILS') return (el as HTMLDetailsElement).open;
          }
          if (attr === 'aria-selected' && el instanceof HTMLOptionElement) {
            return el.selected;
          }
          return undefined;
        }
        if (val === 'mixed') return 'mixed';
        if (val === 'true') return true;
        if (val === 'false') return false;
        return undefined;
      }

      function buildNode(el: Element): ReturnType<typeof buildNodeInner> {
        return buildNodeInner(el);
      }

      function buildNodeInner(el: Element): {
        role: string;
        name: string;
        value?: string | number;
        description?: string;
        checked?: boolean | 'mixed';
        disabled?: boolean;
        expanded?: boolean;
        focused?: boolean;
        level?: number;
        pressed?: boolean | 'mixed';
        selected?: boolean;
        children?: ReturnType<typeof buildNodeInner>[];
      } | null {
        if (isHidden(el)) return null;

        const role = getRole(el);
        const name = getAccessibleName(el);

        // Build children first
        const children: NonNullable<ReturnType<typeof buildNodeInner>>[] = [];
        for (let i = 0; i < el.children.length; i++) {
          const childNode = buildNodeInner(el.children[i]);
          if (childNode) children.push(childNode);
        }

        // Skip generic containers with no name (unless they have meaningful children)
        if (role === 'generic' || role === 'presentation') {
          if (!name) {
            // Flatten: return children directly
            if (children.length === 0) return null;
            if (children.length === 1) return children[0];
            // Multiple children: wrap in a generic container
            // Only keep if there are meaningful descendants
            const hasMeaningful = children.some(
              (c) => MEANINGFUL_ROLES.has(c.role)
            );
            if (!hasMeaningful) return null;
          }
        }

        // Skip non-meaningful roles with no name and no meaningful children
        if (!MEANINGFUL_ROLES.has(role) && !name && children.length === 0) {
          return null;
        }

        // Build the node
        const node: NonNullable<ReturnType<typeof buildNodeInner>> = {
          role,
          name: name.substring(0, 200), // Truncate very long names
        };

        // Value
        const value = getNodeValue(el);
        if (value !== undefined) node.value = value;

        // Description
        const description = el.getAttribute('aria-description') ||
                           el.getAttribute('aria-describedby');
        if (description) node.description = description;

        // State properties
        const checked = getBooleanState(el, 'aria-checked');
        if (checked !== undefined) node.checked = checked;

        const disabled = getBooleanState(el, 'aria-disabled');
        if (typeof disabled === 'boolean') node.disabled = disabled;

        const expanded = getBooleanState(el, 'aria-expanded');
        if (typeof expanded === 'boolean') node.expanded = expanded;

        const focused = el === document.activeElement;
        if (focused) node.focused = true;

        const pressed = getBooleanState(el, 'aria-pressed');
        if (pressed !== undefined) node.pressed = pressed;

        const selected = getBooleanState(el, 'aria-selected');
        if (typeof selected === 'boolean') node.selected = selected;

        // Level (headings)
        const ariaLevel = el.getAttribute('aria-level');
        if (ariaLevel) {
          node.level = parseInt(ariaLevel, 10);
        } else if (HEADING_LEVELS[el.tagName]) {
          node.level = HEADING_LEVELS[el.tagName];
        }

        // Children
        if (children.length > 0) node.children = children;

        return node;
      }

      // Build from document.body, wrapping in a WebArea root
      const body = document.body;
      if (!body) return null;

      const bodyChildren: NonNullable<ReturnType<typeof buildNodeInner>>[] = [];
      for (let i = 0; i < body.children.length; i++) {
        const node = buildNode(body.children[i]);
        if (node) bodyChildren.push(node);
      }

      const root: {
        role: string;
        name: string;
        children?: NonNullable<ReturnType<typeof buildNodeInner>>[];
      } = {
        role: 'WebArea',
        name: document.title || '',
      };
      if (bodyChildren.length > 0) root.children = bodyChildren;

      return root;
    });

    return tree as AccessibilityNode | null;
  } catch {
    return null;
  }
}
