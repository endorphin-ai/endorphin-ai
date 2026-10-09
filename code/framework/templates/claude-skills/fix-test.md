# Fix Test

Autonomously diagnose and fix a failing Endorphin AI test.

## Context

$ARGUMENTS

## Instructions

You are an autonomous test fixer. Given a failing test ID, you will diagnose the failure, re-record with fixes, and produce a working test — all without asking the user for guidance.

### Step 1: Identify the Test

Parse the TEST-ID from $ARGUMENTS. If not provided, ask the user which test to fix (just once).

Find and read the test file:
- `tests/<TEST-ID>.ts`
- `tests/<test-id>-recorded-test.ts`

Extract the test steps (natural language descriptions in the `task` array).

### Step 2: Run the Test

```bash
npx endorphin-ai run test <TEST-ID>
```

### Step 3: Analyze Failure

After the test runs, look for results in `test-results/`. Find the latest session directory and read:
- The session JSON file for step-by-step results
- Identify which step failed and the error message
- Note the steps that passed before the failure

### Step 4: Re-Record with Fix (Autonomous)

Create a new recording session with the same test metadata:

```bash
npx endorphin-ai recorder create --id <TEST-ID> --name "<original test name>" --url <original URL>
```

Parse `pageState.accessibilityTree` to see the initial page state.

**Fast-forward through passing steps:** Re-execute each step that previously passed:

```bash
npx endorphin-ai recorder add-step --session <sessionId> --step "<original step description>"
```

Check `success` after each step. If a previously-passing step now fails, diagnose using `errorDetails` and fix it.

**Fix the failing step:** When you reach the step that failed:

1. Read `pageState.accessibilityTree` to see current page elements
2. Compare the failed step description with available elements
3. Diagnose the root cause:
   - **Element renamed**: Button text changed (e.g., "Submit" → "Send"). Fix: use the new text.
   - **Element moved**: Same element, different location/selector. Fix: use accessible name.
   - **New blocker**: Modal, cookie banner, or popup appeared. Fix: dismiss it first.
   - **Timing**: Element loads slowly. Fix: add a wait step before.
   - **URL change**: Page structure changed. Fix: update navigation or verification.
4. Write a corrected step using elements from `pageState.accessibilityTree`
5. Execute the corrected step

```bash
npx endorphin-ai recorder add-step --session <sessionId> --step "<corrected step description>"
```

If the corrected step fails, read `errorDetails.availableElements` and try again (max 2 retries).

**Continue remaining steps:** Execute any remaining steps from the original test. Fix them if needed using the same process.

### Step 5: Generate Fixed Test

```bash
npx endorphin-ai recorder generate --session <sessionId> --output-dir tests/
```

This overwrites the original test file with the fixed version.

### Step 6: Present Results

Tell the user:
- What was broken and why
- What you changed to fix it
- Test file path
- How to verify: `npx endorphin-ai run test <TEST-ID>`

### Diagnosis Patterns

| Error Pattern | Root Cause | Fix |
|---|---|---|
| "Element not found: button 'Submit'" | Button renamed | Check `availableElements` for similar button, use its name |
| "Element not found: textbox 'Username'" | Field renamed | Check `availableElements` for textboxes, use correct name |
| "Timeout waiting for element" | Element loads slowly | Add `"Wait 3 seconds"` before the step |
| "Navigation failed" | URL changed | Update URL in the navigate step |
| "Verification failed: text not found" | Success text changed | Read page state for current heading/text, update verification |
| Step passes but next step fails | Page structure changed | Read accessibility tree, adjust subsequent steps |

### Example Autonomous Fix

User: `/fix-test HEALTH-001`

1. Read test file → 5 steps: navigate, fill email, fill password, click "Submit", verify "Welcome"
2. Run test → Step 4 fails: "Element not found: button 'Submit'"
3. Create recorder session → navigate to URL
4. Re-run step 1 (navigate) → success
5. Re-run step 2 (fill email) → success
6. Re-run step 3 (fill password) → success
7. Read page state → sees: `button "Sign In"`, `button "Cancel"` (no "Submit" button!)
8. Diagnosis: button was renamed from "Submit" to "Sign In"
9. Fixed step 4: "Click the 'Sign In' button" → success
10. Re-run step 5 (verify "Welcome") → success
11. Generate test → done! Test fixed.
