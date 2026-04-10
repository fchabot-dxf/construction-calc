import subprocess
import sys
import os
import shutil

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Load .env file
env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ[key.strip()] = val.strip()

# Validate required env vars
for var in ("CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"):
    if not os.environ.get(var):
        print(f"Error: {var} is not set. Add it to .env or set it as an environment variable.")
        exit(1)

PROJECT_NAME = os.environ.get("CLOUDFLARE_PROJECT", "constructioncalculator")

# Source of truth: always deploy the dist/ folder with standalone HTML.

# prefer looking in PATH (wrangler or wrangler.cmd on Windows)
WRANGLER_CMD = shutil.which("wrangler") or shutil.which("wrangler.cmd")
if WRANGLER_CMD is None:
    # fall back to known npm global path for current user
    WRANGLER_CMD = os.path.expandvars(r"%USERPROFILE%\AppData\Roaming\npm\wrangler.cmd")

# verify cli exists
try:
    subprocess.run([WRANGLER_CMD, "--version"], check=True, capture_output=True)
except Exception:
    print("wrangler CLI could not be found. Install it with: npm install -g wrangler")
    exit(1)

workspace_dir = os.path.dirname(__file__) or "."
dist_dir = os.path.join(workspace_dir, "dist")


# No need to copy or rebuild; just deploy dist/ as-is
if not os.path.exists(dist_dir):
    print("Error: dist/ folder does not exist. Please add your files to dist/ before deploying.")
    sys.exit(1)

print("Deploying dist/ with wrangler...")

# Deploy dist directly
result = subprocess.run([
    WRANGLER_CMD, "pages", "deploy", dist_dir, "--project-name", PROJECT_NAME
], cwd=workspace_dir)

if result.returncode == 0:
    print("Deployment complete.")
    sys.exit(0)

print(f"Deployment failed (exit code {result.returncode}).")
sys.exit(result.returncode)
