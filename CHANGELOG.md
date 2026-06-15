# Changelog

## [Unreleased]

### ⚠ BREAKING CHANGES

* harden default cookie names with the `__Host-` prefix. The default session
  cookies are now `__Host-Mondo.Session`, `__Host-Mondo.Authorization`, and
  `__Host-Mondo.Authentication`; the login transaction cookie is now
  `__Host-Mondo.Verification`. Existing users will be signed out because the SDK
  no longer reads the old `Mondo.*` cookie names.
* `__Host-` cookies must be secure, host-only cookies with `Path=/`. Apps using
  domain-scoped cookies or insecure plain-HTTP development hostnames must
  configure non-`__Host-` cookie names for those environments.

## [0.3.0](https://github.com/go-mondo/nextjs-auth/compare/v0.2.1...v0.3.0) (2026-05-20)


### Features

* add browser login redirect helpers and typed fetch errors ([006cc16](https://github.com/go-mondo/nextjs-auth/commit/006cc16b96f2620a41114139dbb757fcf8918045))
* add browser login redirect helpers and typed fetch errors ([150063b](https://github.com/go-mondo/nextjs-auth/commit/150063b8342cc10de0671b14301e84bcd0b255b7))

## [0.2.1](https://github.com/go-mondo/nextjs-auth/compare/v0.2.0...v0.2.1) (2026-05-13)


### Bug Fixes

* lazy load instance / config ([d7cd77a](https://github.com/go-mondo/nextjs-auth/commit/d7cd77addeabb656c32942575deefefeaecec114)), closes [#4](https://github.com/go-mondo/nextjs-auth/issues/4)

## [0.2.0](https://github.com/go-mondo/nextjs-auth/compare/v0.1.0...v0.2.0) (2026-05-13)


### Features

* add access token provider ([548b096](https://github.com/go-mondo/nextjs-auth/commit/548b09618c14952d3da6ba2764a04c221e362d10))
* add access token provider ([e84030f](https://github.com/go-mondo/nextjs-auth/commit/e84030f789e6bb2eb7b831d38cc6d40c2abb1a0a))
