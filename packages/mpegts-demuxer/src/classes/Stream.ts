import type { Payload } from './Payload'
import type { Packet } from './Packet'

export class Stream {
	public program = 0xffff // program number (1,2 ...)

	public id = 0 // stream number in program

	public type = 0xff

	public stream_id = 0 // MPEG stream id

	public content_type = 0 // 1 - audio, 2 - video

	public dts = 0 // current MPEG stream DTS (presentation time for audio, decode time for video)

	public has_dts = false

	public first_pts = 0

	public last_pts = 0

	public has_pts = false

	public frame_ticks = 0 // current time to show frame in ticks

	public frame_num = 0 // frame count

	private payload: Payload | null = null

	public finalize(): Packet | null {
		const { payload } = this
		if (payload === null) return null
		let data = new Uint8Array()
		if (payload.buffer.length === 1) {
			[data] = payload.buffer
		} else {
			data = new Uint8Array(payload.buflen)
			let offset = 0
			payload.buffer.forEach((b) => {
				data.set(b, offset)
				offset += b.byteLength
			})
		}
		return {
			data,
			pts: payload.pts,
			dts: payload.dts,
			frame_ticks: payload.frame_ticks,
			program: this.program,
			stream_number: this.id,
			stream_id: this.stream_id,
			type: this.type,
			content_type: this.content_type,
			frame_num: this.frame_num,
		}
	}

	public write(
		mem: DataView, ptr: number, len: number,
		pstart: number, copy: boolean,
	): Packet | null {
		const { payload } = this
		let data = new Uint8Array(mem.buffer, mem.byteOffset + ptr, len)
		if (copy) data = data.slice()
		if (pstart || payload === null) {
			// finalize previously accumulated packet
			const packet = this.finalize()
			// start new packet
			this.payload = {
				buffer: [data],
				buflen: len,
				pts: this.last_pts,
				dts: this.dts,
				frame_ticks: this.frame_ticks,
			}
			return packet
		}
		payload.buffer.push(data)
		payload.buflen += len

		return null
	}
}
