import {
	decodeTs,
} from '..'

describe('decodeTs', () => {
	it('should decode timestamps that use multiple bytes', () => {
		const chunk = new Uint8Array([
			0b00000000,
			0b00000100,
			0b00010000,
			0b00100000,
			0b00001010,
		])
		const mem = new DataView(chunk.buffer)
		const decodedTimestamp = decodeTs(mem, 0)
		expect(decodedTimestamp).toBe(17043461) // 0b00000001000001000001000000000101
	})
	it('should decode small timestamps', () => {
		const chunk = new Uint8Array([
			0b00000000,
			0b00000000,
			0b00000000,
			0b00000000,
			0b00001010,
		])
		const mem = new DataView(chunk.buffer)
		const decodedTimestamp = decodeTs(mem, 0)
		expect(decodedTimestamp).toBe(5) // 0b101
	})
	it('should timestamps larger than 32 bit integers', () => {
		const chunk = new Uint8Array([
			0b11111111,
			0b11111111,
			0b11111111,
			0b11111111,
			0b11111111,
		])
		const mem = new DataView(chunk.buffer)
		const decodedTimestamp = decodeTs(mem, 0)
		expect(decodedTimestamp).toBe(8589934591)
	})
})
