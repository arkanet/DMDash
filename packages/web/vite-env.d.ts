/// <reference types="vite/client" />

interface ViteTypeOptions {
  strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
  readonly VITE_COMMIT_HASH: string;
  readonly VITE_VERSION: string;
  readonly VITE_DARKMESH_NATIVE_APP?: string;
  readonly VITE_WEB_PUSH_PUBLIC_KEY?: string;
  readonly VITE_WEB_PUSH_SUBSCRIBE_URL?: string;
  readonly VITE_WEB_PUSH_UNSUBSCRIBE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
