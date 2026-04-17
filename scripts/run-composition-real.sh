#!/usr/bin/env bash
# scripts/run-composition-real.sh
# Run the real delegation-framework composition flow.
# Uses the CompositionFlow.t.sol test in execution-bound-intent repo.
#
# Usage: npm run example:composition:real

set -e

REPO_DIR="$HOME/execution-bound-intent"

if [ ! -d "$REPO_DIR" ]; then
  echo "Error: execution-bound-intent repo not found at $REPO_DIR"
  echo "Clone it: git clone https://github.com/terriclaw/execution-bound-intent"
  exit 1
fi

if ! command -v forge &> /dev/null; then
  echo "Error: forge not found. Install via: curl -L https://foundry.paradigm.xyz | bash && foundryup"
  exit 1
fi

echo "Running real delegation-framework composition flow..."
echo "Repo: $REPO_DIR"
echo ""

cd "$REPO_DIR"
forge test --match-path test/CompositionFlow.t.sol -vvv 2>&1
