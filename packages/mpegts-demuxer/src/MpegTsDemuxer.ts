import { PACKET_LEN } from './constants'
import {
	Pmt,
	Stream,
	Packet,
} from './classes'
import {
	demux_packet,
} from './utils/'


export class MpegTsDemuxer {
	private pmt = new Pmt();
	private leftover = new Uint8Array(PACKET_LEN);
	private lview = new DataView(this.leftover.buffer);
	private ptr = 0;
	public readonly pids = new Map<number, Stream>();

	constructor(private cb: (p: Packet) => void) {}

	process(buffer: Uint8Array, offset = 0, len = buffer.length - offset): number {
		const { pmt, pids, cb } = this;
		const remainder = (PACKET_LEN - this.ptr) % PACKET_LEN;

		// If we ended on a partial packet last
		// time, finish that packet first.
		if (remainder > 0) {
			if (len < remainder) {
				this.leftover.set(buffer.subarray(offset, offset + len), this.ptr);
				return 1; // still have an incomplete packet
			}

			this.leftover.set(buffer.subarray(offset, offset + remainder), this.ptr);
			const n = demux_packet(pmt, this.lview, 0, pids, cb, true);
			if (n) return n; // invalid packet
		}

		len += offset;
		offset += remainder;

		// Process remaining packets in this chunk
		const mem = new DataView(buffer.buffer, buffer.byteOffset);
		for (let ptr = offset;;ptr += PACKET_LEN) {
			const datalen = len - ptr;
			this.ptr = datalen;
			if (datalen === 0) return 0; // complete packet
			if (datalen < PACKET_LEN) {
				this.leftover.set(buffer.subarray(ptr, ptr + datalen));
				return 1; // incomplete packet
			}

			const n = demux_packet(pmt, mem, ptr, pids, cb, false);
			if (n) return n // invalid packet
		}
	}

	finalize(): void {
		const { pids, cb } = this;
		for (const s of pids.values()) {
			const packet = s.finalize();
			if (packet) cb(packet);
		}
	}
}
