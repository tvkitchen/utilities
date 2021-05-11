// This is one of those rare applications where we actually need bitwise operators
// because we are actually dealing with bit level data / specifications.
/* eslint-disable no-bitwise */

// The original library relied heavily on property reassignment.
// Changing this is a goal, but will be a heavy lift.
/* eslint-disable no-param-reassign */

import type {
	Pmt,
	Packet,
} from '../classes'
import {
	STREAM_TYPES,
	MEDIA_TYPES,
	PACKET_LEN,
} from '../constants'
import {
	Stream,
} from '../classes'

export function getStream(pids: Map<number, Stream>, pid: number): Stream {
	if (!pids.has(pid)) {
		pids.set(pid, new Stream())
	}
	// https://github.com/microsoft/TypeScript/issues/13086
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	return pids.get(pid)!
}

export function getStreamType(type_id: number): number {
	switch (type_id) {
		case 0x01:
		case 0x02:
			return STREAM_TYPES.mpeg2_video
		case 0x80:
			return STREAM_TYPES.mpeg2_video
		case 0x1b:
			return STREAM_TYPES.h264_video
		case 0xea:
			return STREAM_TYPES.vc1_video
		case 0x81:
		case 0x06:
			return STREAM_TYPES.ac3_audio
		case 0x03:
		case 0x04:
			return STREAM_TYPES.mpeg2_audio
		case 0x0f:
			return STREAM_TYPES.aac_audio
		default:
			return STREAM_TYPES.data
	}
}

export function getMediaType(type_id: number): number {
	switch (type_id) {
		case 0x01: // mpeg2_video
		case 0x02: // mpeg2_video
		case 0x80: // mpeg2_video
		case 0x1b: // h264_video
		case 0xea: // vc1_video
			return MEDIA_TYPES.video
		case 0x81: // ac3_audio
		case 0x06: // ac3_audio
		case 0x03: // mpeg2_audio
		case 0x04: // mpeg2_audio
		case 0x0f: // aac_audio
			return MEDIA_TYPES.audio
		default:
			return MEDIA_TYPES.unknown
	}
}

export function decodeTs(mem: DataView, p: number): number {
	return ((mem.getUint8(p) & 0xe) << 29)
				| ((mem.getUint8(p + 1) & 0xff) << 22)
				| ((mem.getUint8(p + 2) & 0xfe) << 14)
				| ((mem.getUint8(p + 3) & 0xff) << 7)
				| ((mem.getUint8(p + 4) & 0xfe) >> 1)
}

export function decodePat(
	mem: DataView,
	startingPtr: number,
	startingLen: number,
	pids: Map<number, Stream>,
	pstart: number,
): number {
	let ptr = startingPtr
	let len = startingLen
	if (pstart) {
		if (len < 1) { return 6 } // Incomplete PES Packet (Possibly PAT)
		ptr += 1 // skip pointer field
		len -= 1
	}

	// check table ID
	if (mem.getUint8(ptr) !== 0x00) { return 0 } // not a PAT after all
	if (len < 8) { return 7 } // Incomplete PAT

	// check flag bits and length
	let l = mem.getUint16(ptr + 1)
	if ((l & 0xb000) !== 0xb000) { return 8 } // Invalid PAT Header

	l &= 0x0fff
	len -= 3

	if (l > len) { return 9 } // PAT Overflows File Length

	len -= 5
	ptr += 8
	l -= 5 + 4

	if (l % 4) { return 10 } // PAT Body Isn't a Multiple of the Entry Size (32 bits)

	const n = l / 4
	for (let i = 0; i < n; i += 1) {
		const program = mem.getUint16(ptr)
		let pid = mem.getUint16(ptr + 2)

		// 3 reserved bits should be on
		if ((pid & 0xe000) !== 0xe000) { return 11 } // Invalid PAT Entry

		pid &= 0x1fff
		ptr += 4

		const s = getStream(pids, pid)
		s.program = program
		s.type = 0xff
	}

	return 0
}

export function memcpy(
	dstm: DataView, dstp: number,
	srcm: DataView, srcp: number,
	len: number,
): void {
	const dsta = new Uint8Array(dstm.buffer, dstm.byteOffset + dstp, len)
	const srca = new Uint8Array(srcm.buffer, srcm.byteOffset + srcp, len)
	dsta.set(srca)
}

// Pmt = program map table
export function decodePmt(
	pmt: Pmt,
	mem: DataView,
	startingPtr: number,
	startingLen: number,
	pids: Map<number, Stream>,
	s: Stream,
	pstart: number,
): number {
	let ptr = startingPtr
	let len = startingLen
	if (pstart) {
		if (len < 1) { return 12 } // Incomplete PES Packet (Possibly PMT)

		ptr += 1 // skip pointer field
		len -= 1

		if (mem.getUint8(ptr) !== 0x02) { return 0 } // not a PMT after all
		if (len < 12) { return 13 } // Incomplete PMT

		// check flag bits and length
		let l = mem.getUint16(ptr + 1)
		if ((l & 0x3000) !== 0x3000) { return 14 } // Invalid PMT Header

		l = (l & 0x0fff) + 3
		if (l > 512) { return 15 } // PMT Length Too Large

		pmt.reset(l)

		if (len < l) l = len
		memcpy(pmt.mem, pmt.ptr, mem, ptr, l)
		pmt.offset += l

		if (pmt.offset < pmt.len) { return 0 } // wait for next part
	} else {
		if (!pmt.offset) { return 16 } // PMT Doesn't Start at Beginning of TS Packet Payload

		let l = pmt.len - pmt.offset
		if (len < l) l = len
		memcpy(pmt.mem, pmt.ptr + pmt.offset, mem, ptr, l)
		pmt.offset += l

		if (pmt.offset < pmt.len) { return 0 } // wait for next part
	}

	let { ptr: pmtPtr, len: l } = pmt
	const pmtMem = pmt.mem
	const n = (pmtMem.getUint16(pmtPtr + 10) & 0x0fff) + 12
	if (n > l) { return 17 } // Program Info Oveflows PMT Length

	pmtPtr += n
	l -= n + 4

	while (l) {
		if (l < 5) { return 18 } // Incomplete Elementary Stream Info

		let pid = pmtMem.getUint16(pmtPtr + 1)
		if ((pid & 0xe000) !== 0xe000) {
			return 19
		} // Invalid Elementary Stream Header

		pid &= 0x1fff
		const ll = (pmtMem.getUint16(pmtPtr + 3) & 0x0fff) + 5
		if (ll > l) {
			return 20
		} // Elementary Stream Data Overflows PMT

		const type = getStreamType(pmtMem.getUint8(pmtPtr))

		pmtPtr += ll
		l -= ll

		const ss = getStream(pids, pid)
		if (ss.program !== s.program || ss.type !== type) {
			ss.program = s.program
			ss.type = type
			ss.id = s.id
			s.id += 1
			ss.content_type = getMediaType(type)
		}
	}
	return 0
}

// Pes = Packetized Elementary Stream
function decodePes(
	mem: DataView,
	startingPtr: number,
	startingLen: number,
	s: Stream,
	pstart: number,
	cb: (p: Packet) => void, copy: boolean,
): number {
	let ptr = startingPtr
	let len = startingLen

	// PES (Packetized Elementary Stream)
	if (pstart) {
		// PES header
		if (len < 6) {
			return 21
		} // Incomplete PES Packet Header
		if (mem.getUint16(ptr) !== 0 || mem.getUint8(ptr + 2) !== 1) {
			return 22 // Invalid PES Header
		}

		const streamId = mem.getUint8(ptr + 3)
		let l = mem.getUint16(ptr + 4)

		ptr += 6
		len -= 6

		if ((streamId < 0xbd || streamId > 0xfe)
			|| (streamId > 0xbf && streamId < 0xc0)
			|| (streamId > 0xdf && streamId < 0xe0)
			|| (streamId > 0xef && streamId < 0xfa)) {
			s.stream_id = 0
		} else {
			// PES header extension
			if (len < 3) {
				return 23
			} // PES Packet Not Long Enough for Extended Header

			const bitmap = mem.getUint8(ptr + 1)
			const hlen = mem.getUint8(ptr + 2) + 3
			if (len < hlen) { return 24 } // PES Header Overflows File Length
			if (l > 0) { l -= hlen }

			switch (bitmap & 0xc0) {
				case 0x80: { // PTS only
					if (hlen < 8) { break }
					const pts = decodeTs(mem, ptr + 3)

					if (s.has_dts && pts !== s.dts) { s.frame_ticks = pts - s.dts }
					if (pts > s.last_pts || !s.has_pts) { s.last_pts = pts }

					if (s.first_pts === 0
						&& s.frame_num === (s.content_type === MEDIA_TYPES.video ? 1 : 0)) {
						s.first_pts = pts
					}

					s.dts = pts
					s.has_dts = true
					s.has_pts = true
					break
				}
				case 0xc0: { // PTS,DTS
					if (hlen < 13) { break }
					const pts = decodeTs(mem, ptr + 3)
					const dts = decodeTs(mem, ptr + 8)

					if (s.has_dts && dts > s.dts) { s.frame_ticks = dts - s.dts }
					if (pts > s.last_pts || !s.has_pts) { s.last_pts = pts }

					if (s.first_pts === 0
						&& s.frame_num === (s.content_type === MEDIA_TYPES.video ? 1 : 0)) {
						s.first_pts = pts
					}

					s.dts = dts
					s.has_dts = true
					s.has_pts = true
					break
				}
				default:
			}

			ptr += hlen
			len -= hlen

			s.stream_id = streamId
			s.frame_num += 1
		}
	}

	if (s.stream_id && s.content_type !== MEDIA_TYPES.unknown) {
		const packet = s.write(mem, ptr, len, pstart, copy)
		if (packet) cb(packet)
	}

	return 0
}

export function demuxPacket(
	pmt: Pmt,
	mem: DataView,
	startingPtr: number,
	pids: Map<number, Stream>,
	cb: (p: Packet) => void,
	copy: boolean,
): number {
	let ptr = startingPtr
	if (mem.getUint8(ptr) !== 0x47) { return 2 } // invalid packet sync byte

	let pid = mem.getUint16(ptr + 1)
	const flags = mem.getUint8(ptr + 3)

	if (pid & 0x8000) { return 3 } // transport error
	if (flags & 0xc0) { return 4 } // scrambled

	const payloadStart = pid & 0x4000
	pid &= 0x1fff

	// check if payload exists
	if (pid === 0x1fff || !(flags & 0x10)) { return 0 }

	ptr += 4
	let len = PACKET_LEN - 4

	if (flags & 0x20) { // skip adaptation field
		const l = mem.getUint8(ptr) + 1
		if (l > len) { return 5 } // Adaptation Field Overflows File Length

		ptr += l
		len -= l
	}

	if (!pid) {
		return decodePat(mem, ptr, len, pids, payloadStart)
	}

	const s = getStream(pids, pid)
	if (s.program === 0xffff) { return 0 }
	if (s.type === 0xff) {
		return decodePmt(pmt, mem, ptr, len, pids, s, payloadStart)
	}
	return decodePes(mem, ptr, len, s, payloadStart, cb, copy)
}
