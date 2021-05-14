# TV Kitchen Utility: MPEG-TS Demuxer

This package demuxes packets from an [MPEG transport stream](https://en.wikipedia.org/wiki/MPEG_transport_stream).

It is a modified fork of the excellent [TSDemuxer package](https://github.com/gliese1337/HLS.js/tree/master/demuxer) created by [Logan Kearsley](https://github.com/gliese1337).  The overall project was started as a JavaScript / TypeScript implementation of [Anton Burdinuk's C++ MPEG-TS demuxer](https://github.com/clark15b/tsdemuxer/blob/67a20b47dd4a11282134ee61d390cc64d1083e61/v1.0/tsdemux.cpp).

## How to Use

The `MpegTsDemuxer` is a NodeJS [`Transform` stream](https://nodejs.org/api/stream.html#stream_class_stream_transform) which means it supports the Read and Write stream APIs.  It consumes raw mpegts data as a stream and emits [Packet](src/classes/Packet.ts) objects as they are parsed.

```
import { MpegTsDemuxer } from 'mpegts-demuxer'
import { createReadStream } from 'fs'

const fileStream = createReadStream('myFile.ts')
const mpegTsDemuxer = new MpegTsDemuxer()
fileStream.pipe(mpegTsDemuxer)
mpegTsDemuxer.on('data', (packet) => {
	console.log(packet)
})
```

## References

If you want to understand the technical specifications related to demuxing MPEG-TS streams can [check out the spec directly](http://ecee.colorado.edu/~ecen5653/ecen5653/papers/iso13818-1.pdf).

## About the TV Kitchen

TV Kitchen is a project of [Bad Idea Factory](https://biffud.com).  Learn more at [the TV Kitchen project site](https://tv.kitchen).

## Participating

TV Kitchen is an open source project, and we welcome contributions of any kind.

Thank you for considering, and before diving in please follow these steps:

* **Step 1:** read our [code of conduct](https://github.com/tvkitchen/.github/blob/main/CODE_OF_CONDUCT.md).
* **Step 2:** review our [contribution guide](https://github.com/tvkitchen/.github/blob/main/CONTRIBUTING.md).
* **Step 3:** make sure your contribution is [related to an issue](https://github.com/tvkitchen/utilities).
* **Step 4:** review these [testing best practices](https://github.com/goldbergyoni/javascript-testing-best-practices).
