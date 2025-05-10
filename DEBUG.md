# Debugging the Media Management System

This guide provides detailed instructions for debugging the client and server components of the Media Management System.

## Setting Up for Debugging

### Prerequisites

1. Make sure you have the recommended VSCode extensions installed:
   - JavaScript Debugger (built into VSCode)
   - Debugger for Chrome or Edge
   - Debugger for Firefox (if using Firefox)

2. The MongoDB database should be correctly configured and accessible.

### Alternative Debugging Setup (if VSCode debugger isn't working)

If you have trouble with the VSCode debugger launching Chrome, try this alternative approach:

1. Start your Next.js client:
   ```
   npm run dev
   ```

2. Start your Express server:
   ```
   cd server && npm run dev
   ```

3. Launch Chrome in debug mode using the provided script:
   ```
   ./start-chrome-debug.sh
   ```

4. In VSCode, use the "Next.js: attach to Chrome" debug configuration to connect to the running browser.

### Available Debug Configurations

The project includes several debugging configurations:

- **Next.js client-side debugging** (Chrome, Edge, or Firefox)
- **Next.js server-side debugging**
- **Express server debugging**
- **Full-stack debugging** (combined configurations)

## Debugging the Tag Issue

To debug the issue with tags (where "logo" and "branding" appear on every card edit):

1. Open the project in VSCode.

2. Set breakpoints in these key files:
   - `src/components/admin/CardFormNew.tsx`
     - In the component initialization (line 14-16)
     - In the tag filtering useEffect (line 44-60)
     - In handleTagAdd and handleTagDelete functions (line 92-110)
   
   - `src/app/page.tsx`
     - In the handleEditCard function (line 118-128)
   
   - `src/components/admin/CardUploadModal.tsx`
     - Where it renders the CardFormNew component (line 53-61)

3. Start debugging:
   - Select "Full Stack: Chrome" from the debug configurations dropdown
   - Press F5 to start debugging

4. Steps to reproduce the issue:
   - Navigate to the home page
   - Log in as admin (if needed)
   - Click the edit icon on a card that doesn't have "logo" or "branding" tags
   - When the edit modal opens, observe what tags are displayed
   - Look at the debug console and variable inspection panel to see:
     - What tags are in initialData
     - What tags are in the component state
     - How filteredTags is being calculated

5. During debugging, watch for:
   - Are the correct tags being passed to CardFormNew in initialData?
   - Is the tags state being initialized correctly from initialData?
   - When a different card is edited, is the component receiving new props?
   - Is the key={initialData?.id || 'new'} properly forcing a component recreation?

## Key Areas to Examine

1. **Component Initialization**
   Check if the card's tags are correctly passed to and initialized in the component.

2. **Component Lifecycle**
   Verify that the component is fully recreated (not just updated) when a different card is edited.

3. **Tag Filtering**
   Ensure the dropdown correctly filters out tags that are already selected for the current card.

4. **Re-rendering Issues**
   Look for any stale state or props that might not be updating when a different card is selected.

## Common Debug Commands

- **Continue (F5)**: Resume execution to the next breakpoint
- **Step Over (F10)**: Execute the current line and stop at the next line
- **Step Into (F11)**: Step into function calls
- **Step Out (Shift+F11)**: Complete the current function and return to the caller
- **Restart (Ctrl+Shift+F5)**: Restart the debug session
- **Stop (Shift+F5)**: End the debug session

## Inspect During Debugging

- **Variables Panel**: View all local and global variables in the current context
- **Watch Panel**: Add expressions to monitor specific values
- **Call Stack**: See the execution path that led to the current breakpoint
- **Debug Console**: Run code to examine or modify the current state

## Additional Debugging Tools

- Add `console.log` statements with clear prefixes (e.g., `[TAG DEBUG]`) to trace execution
- Use conditional breakpoints for more targeted debugging (right-click on a breakpoint)
- Use the browser's developer tools Elements panel to inspect the DOM
- Use React DevTools to inspect component hierarchies and props

## Troubleshooting

If the debugger doesn't connect or breakpoints aren't hit:

1. Make sure both client and server are running
2. Verify that sourcemaps are correctly generated
3. Try restarting VSCode
4. Clear browser cache or use incognito/private browsing mode
5. Check the Output panel in VSCode for debugging errors

## Debugging Strategies for the Tag Issue

### Isolating the Problem

To identify why "logo" and "branding" tags appear on every card edit:

1. **Console Logging Strategy**
   - All debug logs use the prefix "[DEBUG NEW FORM]" to make them easy to find
   - Watch for logs showing card initialization with tags
   - See if tags are being properly filtered when dropdown is shown

2. **Breakpoint Strategy**
   - Set a breakpoint in `CardFormNew.tsx` at line 14 (component initialization)
   - When hit, inspect `initialData.tags` in Variables panel
   - Step through to see how `tags` state is initialized
   - Set another breakpoint in the filtering useEffect (around line 44)

3. **React DevTools**
   - Install React DevTools browser extension
   - Use the Components tab to inspect CardFormNew
   - Check props and state to verify tags are correct
   - Look for unexpected re-renders

### Testing Different Cards

Reproduce by editing different cards in sequence:

1. Edit a card that HAS the "logo" tag - verify it appears in selected tags
2. Edit a card that DOESN'T have the "logo" tag - verify it's NOT in selected tags
3. If "logo" appears when it shouldn't, check if:
   - Component isn't being properly recreated (key prop issue)
   - State is persisting between different card edits
   - Some code is manually adding these tags

### Known Areas to Check

1. **Component Recreation**
   The modal uses `key={initialData?.id || 'new'}` to force component recreation - verify this works

2. **Tag Filtering Logic**
   Check the filtering logic in `CardFormNew.tsx` around line 44-60

3. **Tag Initialization**
   Pay attention to how tags are initialized from initialData at line 21