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

	private process(buffer: Uint8Array): number {
		const { pmt, pids, cb } = this
		const remainder = (PACKET_LEN - this.ptr) % PACKET_LEN

		// If we ended on a partial packet last
		// time, finish that packet first.
		if (remainder > 0) {
			if (buffer.length < remainder) {
				this.leftover.set(buffer, this.ptr)
				return 1 // still have an incomplete packet
			}

			this.leftover.set(buffer, this.ptr)
			const n = demuxPacket(pmt, this.lview, 0, pids, cb, true)
			if (n) return n // invalid packet
		}

		// Process remaining packets in this chunk
		const mem = new DataView(buffer.buffer)
		for (let ptr = 0; ; ptr += PACKET_LEN) {
			const datalen = buffer.length - ptr
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
