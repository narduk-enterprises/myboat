/**
 * Page metadata augmentations shared with all apps that extend this layer.
 */
declare module 'nuxt/schema' {
  interface PageMeta {
    /**
     * When true, the default layer `app.vue` skips the standard max-width
     * content gutter so the page can own the full width (auth, onboarding,
     * marketing heroes, and similar).
     */
    fullBleed?: boolean
  }
}

export {}
