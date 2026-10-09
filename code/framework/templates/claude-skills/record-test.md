# Record Test

Launch the Endorphin AI interactive test recorder.

## Context

$ARGUMENTS

## Instructions

Launch the interactive test recorder. This opens a browser window and guides the user through recording a test step-by-step.

Run:

```bash
npx endorphin-ai run test-recorder
```

The interactive recorder will:
1. Prompt for test metadata (ID, name, description, priority, tags, URL)
2. Open a browser window
3. Accept natural language commands for each test step
4. Record screenshots before and after each step
5. Generate a test file when the user types "done"
