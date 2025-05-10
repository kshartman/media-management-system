# Debugging Guide for Media Management System

This project includes VSCode configurations for debugging both the frontend (Next.js) and backend (Express) components.

## Setup

1. Install the recommended extensions from `.vscode/extensions.json`
   - In VSCode: View > Extensions, then click "Show Recommended Extensions"

2. Make sure both servers are running:
   - Client: `npm run dev` in the project root
   - Server: `cd server && npm run dev`

## Debug Configurations

### Client-Side Debugging

For debugging React components, hooks, and client-side logic:

1. Select one of these configurations from the VSCode Debug panel:
   - **Next.js: debug client-side (Chrome)**
   - **Next.js: debug client-side (Edge)**
   - **Next.js: debug client-side (Firefox)**

2. Press F5 or click the green play button
3. The selected browser will open to `http://localhost:3000`
4. Set breakpoints in your React components and client-side code

### Server-Side Debugging

For debugging server-side rendering or API routes:

1. Select **Next.js: debug server-side**
2. Press F5 to start
3. Set breakpoints in server-side code (getServerSideProps, API routes)

### Express Server Debugging

For debugging the backend Express server:

1. Select **Express Server: debug**
2. Press F5 to start
3. Set breakpoints in `server/index.js` or other server files

### Full Stack Debugging

To debug both the Next.js server and Express backend simultaneously:

1. Select **Full Stack: Next.js + Express**
2. Press F5 to start both servers with debugging
3. You'll need to open a browser manually to navigate to the application

## Using Tasks

This project includes VSCode tasks for common operations:

- **Start Client & Server**: Runs both the frontend and backend servers
- **Start Client**: Runs only the Next.js frontend
- **Start Server**: Runs only the Express backend

Access tasks via:
- Terminal > Run Task
- Or press Ctrl+Shift+P (Cmd+Shift+P on Mac) and type "Tasks: Run Task"

## Debugging Tips

1. **Console Logging**: The configured debug consoles capture all `console.log` output.

2. **Network Requests**: Use the browser's Network tab to inspect API calls.

3. **React DevTools**: Install the React DevTools extension in your browser for component inspection.

4. **State Inspection**: When paused at a breakpoint, inspect component state in the Variables panel.

5. **Conditional Breakpoints**: Right-click a breakpoint to set conditions or log messages.

6. **Hot Module Replacement**: Works even in debug mode - make changes and see them immediately.

## Troubleshooting

- **Sourcemaps not working**: Try refreshing the page after setting breakpoints
- **Can't hit breakpoints**: Make sure you're using the correct debug configuration for your code
- **Server not starting**: Check for port conflicts (3000 for Next.js, 3001 for Express)