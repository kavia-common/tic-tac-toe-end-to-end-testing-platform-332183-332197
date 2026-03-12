#!/bin/bash
cd /home/kavia/workspace/code-generation/tic-tac-toe-end-to-end-testing-platform-332183-332197/vite_frontend
npx eslint
ESLINT_EXIT_CODE=$?
npm run build
BUILD_EXIT_CODE=$?
 if [ $ESLINT_EXIT_CODE -ne 0 ] || [ $BUILD_EXIT_CODE -ne 0 ]; then
   exit 1
fi

