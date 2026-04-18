#!/usr/bin/env bash
# scripts/test-all.sh
# Run all tests including parity and onchain tests with Anvil auto-start.
# Usage: npm run test:all

set -e

if ! command -v anvil &> /dev/null; then
  echo "Error: anvil not found. Install via: curl -L https://foundry.paradigm.xyz | bash && foundryup"
  exit 1
fi

# Start Anvil
anvil --silent &
ANVIL_PID=$!

# Wait for readiness (max 10s)
echo "Waiting for Anvil..."
for i in $(seq 1 20); do
  if curl -s -X POST --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' http://127.0.0.1:8545 > /dev/null 2>&1; then
    echo "Anvil ready."
    break
  fi
  if [ $i -eq 20 ]; then
    echo "Error: Anvil did not start in time"
    kill $ANVIL_PID 2>/dev/null
    exit 1
  fi
  sleep 0.5
done

# Run all tests
echo ""
npx vitest run
EXIT_CODE=$?

# Clean up
kill $ANVIL_PID 2>/dev/null
wait $ANVIL_PID 2>/dev/null

exit $EXIT_CODE
