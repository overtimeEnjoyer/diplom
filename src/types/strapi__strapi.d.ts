declare module '@strapi/strapi' {
  // Minimal typing: Strapi injects factories at runtime; we only need enough
  // for TS/IDE to stop complaining in standalone controller files.
  export const factories: any;
}

