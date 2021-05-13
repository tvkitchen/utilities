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
	getSafeDataView,
} from './utils'

export class MpegTsDemuxer extends Transform {
	public readonly pids = new Map<number, Stream>()

	private readonly pmt = new Pmt()

	private unprocessed = Buffer.alloc(0)

	public constructor() {
		super({
			readableObjectMode: true,
			flush: (callback: () => void) => {
				this.finalize()
				callback()
			},
			transform: (
				chunk: Buffer,
				encoding: string,
				callback: () => void,
			): void => {
				this.process(chunk)
				callback()
			},
		})
	}

	private process(chunk: Uint8Array): void {
		const { pmt, pids, cb } = this

		// Add the chunk to the unprocessed data
		this.unprocessed = Buffer.concat([this.unprocessed, chunk])
		const mem = getSafeDataView(this.unprocessed)

		// Loop through all the data
		let ptr = 0
		while (this.unprocessed.length - ptr >= PACKET_LEN) {
			// Demux packet will return the number of bytes it has analyzed, or zero if a full
			// packet was consumed
			const consumedBytes = demuxPacket(pmt, mem, ptr, pids, cb, false) || PACKET_LEN
			ptr += consumedBytes
		}
		this.unprocessed = this.unprocessed.slice(ptr)
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
