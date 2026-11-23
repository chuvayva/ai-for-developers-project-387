import { defineConfig } from '@hey-api/openapi-ts';

// The web client SDK: one function per contract operation, named after its
// `operationId`, over the Fetch API.
export default defineConfig({
  input: './generated/openapi.yaml',
  output: {
    path: 'generated/client',
    importFileExtension: '.ts',
  },
  plugins: [
    // `includeInEntry` exports `client` from the index, so the web sets its base URL.
    { name: '@hey-api/client-fetch', includeInEntry: true },
    '@hey-api/typescript',
    '@hey-api/sdk',
  ],
});
