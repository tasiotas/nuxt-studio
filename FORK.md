# PDF support fork

This fork adds PDF uploads, document icons in the media library and publish review, a browser PDF preview, and copyable public paths and Markdown links. PDF drafts are served by the Studio service worker and published as binary media. External storage allows `application/pdf` by default; add it explicitly if you customize `studio.media.allowedTypes`.

Upload from the **Media** tab, select the PDF, and copy its Markdown link into your content. Image and video insertion dialogs still filter by their respective types. PDF rendering depends on browser PDF support and any embedding restrictions on your external storage; the public-path link opens the document separately.

## Use in another project

For one project, use a built, versioned tarball. Studio exports generated `dist` files, so a source checkout alone is not the installable artifact. Commit the tarball under your application's `vendor/` directory together with its package manifest and lockfile so CI receives the same build.

Build from this fork's `feat/pdf-media` branch:

```sh
pnpm install --frozen-lockfile
pnpm dev:prepare
pnpm pack --pack-destination artifacts
```

Copy `artifacts/nuxt-studio-1.7.0-pdf.4.tgz` into your application's `vendor/` directory, then run there:

```sh
pnpm add ./vendor/nuxt-studio-1.7.0-pdf.4.tgz
```

Keep `nuxt-studio` in `modules` in `nuxt.config.ts`; the package name is unchanged. Keep Studio's repository configuration pointed at **your application's content repository**, not this module fork.

For several consuming projects, publish versioned builds under your own npm scope, then install with an alias such as `nuxt-studio@npm:@tasiotas/nuxt-studio@1.7.0-pdf.4`. That is a future distribution option; no npm package has been published. Avoid following a moving Git branch in production.

## Maintaining the fork

The original repository is the `upstream` remote. Merge upstream releases into `feat/pdf-media`, run `pnpm verify`, increment the PDF prerelease version, and build a new tarball. Keep the old tarball available for rollback.

The fork also fixes plugin declaration portability and the module build's runtime-helper import path, and makes packaging stop if the module build fails.

Package-manager references: [installing package sources](https://pnpm.io/cli/add), [creating tarballs](https://pnpm.io/cli/pack).
