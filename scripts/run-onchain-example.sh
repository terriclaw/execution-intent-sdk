#!/usr/bin/env bash
# scripts/run-onchain-example.sh
# One-command local onchain example.
# Starts Anvil, runs the example, cleans up.
#
# Usage: npm run example:onchain:local

set -e

# Check anvil is available
if ! command -v anvil &> /dev/null; then
  echo "Error: anvil not found. Install via: curl -L https://foundry.paradigm.xyz | bash && foundryup"
  exit 1
fi

# Check PRIVATE_KEY is set
if [ -z "$PRIVATE_KEY" ]; then
  echo "No PRIVATE_KEY set — using Anvil account 0 (test only)"
  export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
fi

# Start Anvil in background
echo "Starting Anvil..."
anvil --silent &
ANVIL_PID=$!

# Wait for Anvil to be ready
for i in $(seq 1 10); do
  if curl -s -X POST --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' http://localhost:8545 > /dev/null 2>&1; then
    echo "Anvil ready."
    break
  fi
  sleep 0.5
done

# Run example
echo ""
npx tsx examples/onchain/index.ts
EXIT_CODE=$?

# Clean up
kill $ANVIL_PID 2>/dev/null
wait $ANVIL_PID 2>/dev/null

exit $EXIT_CODE
