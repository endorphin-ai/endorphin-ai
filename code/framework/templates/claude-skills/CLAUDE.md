# Endorphin AI — Test Recorder API

This project uses **Endorphin AI**, a browser automation testing framework powered by AI.

## Available Commands

### Test Recorder CLI

Endorphin AI provides a programmatic test recorder API for creating tests via CLI:

#### `endorphin recorder create` — Create a new recording session

```bash
npx endorphin-ai recorder create \
  --id <TEST-ID> \
  --name "<Test Name>" \
  --description "<Description>" \
  --priority <High|Medium|Low> \
  --tags <tag1,tag2> \
  --url <URL> \
  --data key=value
```

**Output (JSON):** Returns `sessionId`, `testId`, `testName`, `recordingPath`, and `pageState` (current page accessibility tree).

#### `endorphin recorder add-step` — Add a step to a session

```bash
npx endorphin-ai recorder add-step \
  --session <sessionId> \
  --step "<natural language step description>"
```

**Output (JSON):** Returns `sessionId`, `stepNumber`, `description`, `success`, `result`, screenshot paths, `pageState` (updated page), and on failure: `errorDetails` with `failedAction`, `reason`, and `availableElements`.

#### `endorphin recorder generate` — Generate test file

```bash
npx endorphin-ai recorder generate \
  --session <sessionId> \
  --output-dir tests/
```

#### `endorphin recorder list` — List all sessions

```bash
npx endorphin-ai recorder list
```

#### `endorphin recorder status` — Get session status

```bash
npx endorphin-ai recorder status --session <sessionId>
```

#### `endorphin recorder close-browser` — Close persistent browser

```bash
npx endorphin-ai recorder close-browser --session <sessionId>
```

**Output (JSON):** Returns `sessionId` and `browserClosed: true`.

### Browser Persistence

The recorder uses a persistent browser that survives process exits. When you run `recorder create`, a browser is launched and its WebSocket endpoint is saved in the session state. Subsequent `recorder add-step` calls reconnect to the same browser via CDP (Chrome DevTools Protocol) instead of launching a new one. This means:

- Page state (cookies, localStorage, navigation history) is preserved across steps
- The browser remains open between CLI invocations
- `recorder generate` reconnects, generates the test, and closes the browser automatically
- Use `recorder close-browser` to manually close a persistent browser if needed (e.g., after an interrupted session)

## Reading Page State

After `recorder create` and every `recorder add-step`, the JSON output includes a `pageState` field:

```json
{
  "pageState": {
    "url": "https://app.com/login",
    "title": "Login",
    "accessibilityTree": "- WebArea \"Login\"\n  - heading \"Sign In\" (level 1)\n  - textbox \"Email\"\n  - textbox \"Password\"\n  - button \"Log In\""
  }
}
```

Use `pageState.accessibilityTree` to see what elements are on the page and decide the next step. On failure, `errorDetails.availableElements` lists all interactive elements (buttons, links, inputs) you can target.

## Browser Tools — Prompt Writing Guide

The AI agent executes natural language step descriptions. Write steps that map to these 26 built-in tools:

### Navigation
- **navigate**: `"Navigate to https://app.com/login"`
- **navigateBack**: `"Go back to the previous page"`

### Interaction
- **click**: `"Click the 'Log In' button"` or `"Click the 'Sign Up' link"` — use element text
- **fill**: `"Fill the Email field with user@test.com"` or `"Fill input[type='password'] with secret123"`
- **clearField**: `"Clear the Email field"`
- **pressSequentially**: `"Type 'hello' character by character into the search field"`
- **hover**: `"Hover over the 'Profile' menu"`
- **pressKey**: `"Press Enter"` or `"Press Tab"` or `"Press Escape"`
- **selectOption**: `"Select 'United States' from the Country dropdown"`
- **drag**: `"Drag the card from .source to .target"`

### Verification
- **verifyElement**: `"Verify the 'Submit' button is visible"`
- **verifyTextContent**: `"Verify 'Welcome back' is visible on the page"`
- **verifyTitle**: `"Verify page title contains 'Dashboard'"`
- **verifyURL**: `"Verify URL contains '/dashboard'"`
- **verifyListVisible**: `"Verify 'Home', 'Profile', 'Settings' are visible"`
- **getElementInfo**: `"Get info about the #main-form element"`

### Other
- **scroll**: `"Scroll down"` or `"Scroll to the footer"`
- **wait**: `"Wait 2 seconds"` or `"Wait for the loading spinner to disappear"`
- **screenshot**: `"Take a screenshot"`
- **getPageContent**: `"Get the raw HTML content"` (only when accessibility tree is insufficient)
- **fileUpload**: `"Upload file /path/to/file.pdf to the file input"`
- **evaluate**: `"Evaluate document.querySelectorAll('tr').length in the browser"`
- **networkRequests**: `"List network requests"`
- **tabs**: `"List open tabs"` or `"Switch to tab 1"`
- **resize**: `"Resize browser to 375x812"`

### Writing Effective Step Prompts

1. **Use element text, not CSS selectors**: `"Click 'Sign In'"` not `"Click .btn-primary"`
2. **Be specific with fields**: `"Fill the Email field"` not `"Fill the first input"`
3. **Include values for fill/type**: `"Fill Email field with user@test.com"`
4. **Add verification after key actions**: After login, add `"Verify 'Welcome' is visible"`
5. **Use role names from the accessibility tree**: The tree shows `textbox "Email"`, so write `"Fill the Email field"`
6. **Quote text for exact matching**: `"Verify 'Error: Invalid email' is visible"`

## Claude Code Skills

- **`/write-test`** — Autonomously create a test (provide high-level description)
- **`/fix-test <TEST-ID>`** — Autonomously diagnose and fix a failing test
- **`/record-test`** — Launch the interactive recorder

## Best Practices

1. **Always parse JSON output** — All recorder commands output JSON to stdout.
2. **User feedback goes to stderr** — User-facing messages are on stderr.
3. **Read `pageState.accessibilityTree`** after each step to decide the next action.
4. **On failure, read `errorDetails.availableElements`** to see what elements are available and rewrite the step.
5. **Retry failed steps up to 2 times** with rewritten prompts based on available elements.
