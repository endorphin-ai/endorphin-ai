# Write Test

Autonomously create an Endorphin AI browser automation test.

## Context

$ARGUMENTS

## Instructions

You are an autonomous test author. Given a high-level test description, you will create a complete test without asking the user for each step. You see the page through the accessibility tree and auto-generate steps.

### Step 1: Extract Test Metadata

Parse from $ARGUMENTS:
- **URL** (required): The website URL to test
- **Test goal**: What the test should do (e.g., "login with user@test.com / password123")
- **Test ID**: Generate from goal if not provided (e.g., LOGIN-001, SIGNUP-001)
- **Test Name**: Generate from goal if not provided (e.g., "User Login Flow")

If $ARGUMENTS is empty or unclear, ask the user for the URL and test goal (just once).

### Step 2: Create Recording Session

```bash
npx endorphin-ai recorder create --id <TEST-ID> --name "<Test Name>" --url <URL>
```

Parse the JSON output. Extract:
- `sessionId` — needed for all subsequent commands
- `pageState.accessibilityTree` — shows what elements are on the page right now

### Step 3: Auto-Generate Steps (Autonomous Loop)

Analyze `pageState.accessibilityTree` from the create response. You can see all interactive elements: textboxes, buttons, links, checkboxes, etc.

**Based on the test goal and current page state, generate the next logical step.** Do NOT ask the user — decide autonomously.

For each step:

1. **Write a precise step prompt** using the element names from the accessibility tree:
   - If you see `textbox "Email"` and need to fill it: `"Fill the Email field with user@test.com"`
   - If you see `button "Log In"`: `"Click the 'Log In' button"`
   - If you see `link "Sign Up"`: `"Click the 'Sign Up' link"`
   - For verification: `"Verify 'Welcome back' is visible on the page"`

2. **Execute the step:**
```bash
npx endorphin-ai recorder add-step --session <sessionId> --step "<step description>"
```

3. **Parse the response:**
   - If `success: true`: Read `pageState.accessibilityTree` to see the updated page. Decide the next step.
   - If `success: false`: Read `errorDetails.availableElements` to see what elements ARE available. Rewrite the step using an available element and retry (max 2 retries per step).

4. **Repeat** until the test goal is achieved OR you reach 15 steps.

### Step Prompt Patterns

Use these patterns based on what you see in the accessibility tree:

| You see in tree | You want to do | Write this step |
|---|---|---|
| `textbox "Email"` | Fill email | `"Fill the Email field with user@test.com"` |
| `textbox "Password"` | Fill password | `"Fill the Password field with secret123"` |
| `button "Log In"` | Click login | `"Click the 'Log In' button"` |
| `link "Sign Up"` | Navigate to signup | `"Click the 'Sign Up' link"` |
| `combobox "Country"` | Select option | `"Select 'United States' from the Country dropdown"` |
| `checkbox "Remember me"` | Check box | `"Click the 'Remember me' checkbox"` |
| Page changed to dashboard | Verify success | `"Verify 'Welcome' is visible on the page"` |
| URL changed | Verify navigation | `"Verify URL contains '/dashboard'"` |

### Step 4: Completion Detection

Stop generating steps when:
- The test goal is achieved (e.g., login succeeded and verified)
- You've added a verification step that confirms the goal
- You've reached 15 steps (safety limit)

### Step 5: Generate Test File

```bash
npx endorphin-ai recorder generate --session <sessionId> --output-dir tests/
```

### Step 6: Present Results

Tell the user:
- Test created successfully with N steps
- Test file path
- How to run: `npx endorphin-ai run test <TEST-ID>`

### Handling Failures

When a step fails (`success: false`):

1. Read `errorDetails.reason` to understand WHY it failed
2. Read `errorDetails.availableElements` to see what elements exist
3. Rewrite the step. Examples:
   - Failed: "Click the 'Submit' button" → Available: `button 'Log In'` → Retry: "Click the 'Log In' button"
   - Failed: "Fill the username field" → Available: `textbox 'Email'` → Retry: "Fill the Email field with user@test.com"
4. If 2 retries fail, skip the step and log a warning

### Example Autonomous Workflow

User: `/write-test Create a login test at https://app.com with user@test.com / password123`

1. Create session → sees: `textbox "Email"`, `textbox "Password"`, `button "Sign In"`
2. Auto-step: "Fill the Email field with user@test.com" → success
3. Auto-step: "Fill the Password field with password123" → success
4. Auto-step: "Click the 'Sign In' button" → success
5. Sees new page with `heading "Dashboard"` → Auto-step: "Verify 'Dashboard' is visible" → success
6. Generate test → done!
