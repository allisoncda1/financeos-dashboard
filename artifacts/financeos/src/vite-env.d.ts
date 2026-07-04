/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_MOCK?: string;
  readonly VITE_DEV_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
