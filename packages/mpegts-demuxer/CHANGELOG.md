# Changelog for mpegts-demuxer

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2021-05-13
### Added
- An initial fork of the [`ts-demuxer` package](https://www.npmjs.com/package/ts-demuxer).

### Changed
- The package is now much more compliant with our linting rules.
- Large PTS and DTS values no longer result in int overflows.
- MpegTsDemuxer now adheres to the Transform Stream API.

[Unreleased]: https://github.com/tvkitchen/utilities/compare/mpegts-demuxer@0.1.0...HEAD
[0.1.0]: https://github.com/tvkitchen/utilities/releases/tag/mpegts-demuxer@0.1.0
