# Changelog

All notable changes to the `@firebaseextensions/fs-bq-import-collection` package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.26] - 2025-08-19

- fix: collectionGroup handling for multi-threaded where multi-threaded collection group imports fail due to improper handling of Firestore document reference paths

## [0.1.25] - 2025-07-28

### Added

- Initial changelog file to track version history

- Expose transformUrl from config

### Changed

- Incremented package version from 0.1.24 to 0.1.25

## [0.1.24] - Previous Version

### Initial Release

- Import script for Firestore collections to BigQuery changelog tables
- Support for reading existing documents from Firestore collections
- Integration with the firestore-bigquery-export extension
- Command-line interface with interactive prompts
- Worker pool support for parallel processing
- Schema generation capabilities
