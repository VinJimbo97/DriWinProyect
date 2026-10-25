/// <reference types="vite/client" />

/** Variables de entorno del Front-End (Vite sólo expone las que empiezan con VITE_). */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_READ_ONLY_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
