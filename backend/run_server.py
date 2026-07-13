import sys
import os
import uvicorn

# Dynamically resolve the workspace root and add it to the Python path
# This ensures that absolute imports like 'backend.app...' resolve correctly regardless of where the script is executed from.
workspace_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if workspace_root not in sys.path:
    sys.path.insert(0, workspace_root)

if __name__ == "__main__":
    print(f"Starting Veritas FastAPI server (Workspace Root: {workspace_root})")
    # Launch uvicorn programmatically
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
