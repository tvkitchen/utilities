import { MpegTsDemuxer } from '..'

describe('MpegTsDemuxer', () => {
	it('should be a constructor', () => {
		const demuxer = new MpegTsDemuxer()
		expect(demuxer).toBeInstanceOf(MpegTsDemuxer)
	})
})
