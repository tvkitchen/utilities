import { Transform } from 'stream'

import type {
	Stream,
	Packet,
} from './classes'

import { PACKET_LEN } from './constants'
import {
	Pmt,
} from './classes'
import {
	demuxPacket,
} from './utils'

export class MpegTsDemuxer extends Transform {
	public readonly pids = new Map<number, Stream>()

	private readonly pmt = new Pmt()

	private readonly leftover = new Uint8Array(PACKET_LEN)

	private readonly lview = new DataView(this.leftover.buffer)

	private ptr = 0

	/** @inheritdoc */
	// https://nodejs.org/api/stream.html#stream_transform_transform_chunk_encoding_callback
	// eslint-disable-next-line no-underscore-dangle
	public _transform(
		chunk: Buffer,
		encoding: string,
		callback: () => void,
	): void {
		this.process(chunk)
		callback()
	}

	/** @inheritdoc */
	// https://nodejs.org/api/stream.html#stream_transform_flush_callback
	// eslint-disable-next-line no-underscore-dangle
	public _flush(
		callback: () => void,
	): void {
		this.finalize()
		callback()
	}

	private process(
		buffer: Uint8Array,
		startingOffset = 0,
		startingLen = buffer.length - startingOffset,
	): number {
		const { pmt, pids, cb } = this
		const remainder = (PACKET_LEN - this.ptr) % PACKET_LEN

		let offset = startingOffset
		let len = startingLen

		// If we ended on a partial packet last
		// time, finish that packet first.
		if (remainder > 0) {
			if (len < remainder) {
				this.leftover.set(buffer.subarray(offset, offset + len), this.ptr)
				return 1 // still have an incomplete packet
			}

			this.leftover.set(buffer.subarray(offset, offset + remainder), this.ptr)
			const n = demuxPacket(pmt, this.lview, 0, pids, cb, true)
			if (n) return n // invalid packet
		}

		len += offset
		offset += remainder

		// Process remaining packets in this chunk
		const mem = new DataView(buffer.buffer, buffer.byteOffset)
		for (let ptr = offset; ; ptr += PACKET_LEN) {
			const datalen = len - ptr
			this.ptr = datalen
			if (datalen === 0) return 0 // complete packet
			if (datalen < PACKET_LEN) {
				this.leftover.set(buffer.subarray(ptr, ptr + datalen))
				return 1 // incomplete packet
			}

			const n = demuxPacket(pmt, mem, ptr, pids, cb, false)
			if (n) return n // invalid packet
		}
	}

	private finalize(): void {
		const { pids, cb } = this
		pids.forEach((s) => {
			const packet = s.finalize()
			if (packet) cb(packet)
		})
	}

	private readonly cb = (p: Packet): void => { this.push(p) }
}
