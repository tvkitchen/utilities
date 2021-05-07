

function get_stream(pids: Map<number, Stream>, pid: number): Stream {
	if (!pids.has(pid)) { pids.set(pid, new Stream()); }
	return pids.get(pid) as Stream;
}

function get_stream_type(type_id: number): number {
	switch (type_id) {
	case 0x01:
	case 0x02:
		return stream_type.mpeg2_video;
	case 0x80:
		return stream_type.mpeg2_video;
	case 0x1b:
		return stream_type.h264_video;
	case 0xea:
		return stream_type.vc1_video;
	case 0x81:
	case 0x06:
		return stream_type.ac3_audio;
	case 0x03:
	case 0x04:
		return stream_type.mpeg2_audio;
	case 0x0f:
		return stream_type.aac_audio;
	}

	return stream_type.data;
}

function get_media_type(type_id: number): number {
	switch (type_id) {
	case 0x01: // mpeg2_video
	case 0x02: // mpeg2_video
	case 0x80: // mpeg2_video
	case 0x1b: // h264_video
	case 0xea: // vc1_video
		return stream_type.video;
	case 0x81: // ac3_audio
	case 0x06: // ac3_audio
	case 0x03: // mpeg2_audio
	case 0x04: // mpeg2_audio
	case 0x0f: // aac_audio
		return stream_type.audio;
	}

	return stream_type.unknown;
}

function decode_ts(mem: DataView, p: number): number {
	return ((mem.getUint8(p)  & 0xe ) << 29) |
				 ((mem.getUint8(p + 1) & 0xff) << 22) |
				 ((mem.getUint8(p + 2) & 0xfe) << 14) |
				 ((mem.getUint8(p + 3) & 0xff) << 7) |
				 ((mem.getUint8(p + 4) & 0xfe) >> 1);
}

function decode_pat(mem: DataView, ptr: number, len: number, pids: Map<number, Stream>, pstart: number): number {
	if (pstart) {
		if (len < 1) { return 6; } // Incomplete PES Packet (Possibly PAT)
		ptr += 1; // skip pointer field
		len -= 1;
	}

	//check table ID
	if (mem.getUint8(ptr) !== 0x00) { return 0; } // not a PAT after all
	if (len < 8) { return 7; } // Incomplete PAT

	// check flag bits and length
	let l = mem.getUint16(ptr + 1);
	if ((l & 0xb000) !== 0xb000) { return 8; } // Invalid PAT Header

	l &= 0x0fff;
	len -= 3;

	if (l > len) { return 9; } // PAT Overflows File Length

	len -= 5;
	ptr += 8;
	l -= 5 + 4;

	if (l % 4) { return 10; } // PAT Body Isn't a Multiple of the Entry Size (32 bits)

	const n = l / 4;
	for (let i = 0;i < n;i++) {
		const program = mem.getUint16(ptr);
		let pid = mem.getUint16(ptr + 2);

		// 3 reserved bits should be on
		if ((pid & 0xe000) !== 0xe000) { return 11; } // Invalid PAT Entry

		pid &= 0x1fff;
		ptr += 4;

		const s = get_stream(pids, pid);
		s.program = program;
		s.type = 0xff;
	}

	return 0;
}

function memcpy(
	dstm: DataView, dstp: number,
	srcm: DataView, srcp: number,
	len: number,
): void {
	const dsta = new Uint8Array(dstm.buffer, dstm.byteOffset + dstp, len);
	const srca = new Uint8Array(srcm.buffer, srcm.byteOffset + srcp, len);
	dsta.set(srca);
}

function decode_pmt(
	pmt: PMT,
	mem: DataView, ptr: number, len: number,
	pids: Map<number, Stream>,
	s: Stream,
	pstart: number,
): number {
	if (pstart) {
		if (len < 1) { return 12; } // Incomplete PES Packet (Possibly PMT)

		ptr += 1;     // skip pointer field
		len -= 1;

		if (mem.getUint8(ptr) !== 0x02) { return 0; } // not a PMT after all
		if (len < 12) { return 13; } // Incomplete PMT

		// check flag bits and length
		let l = mem.getUint16(ptr + 1);
		if ((l & 0x3000) !== 0x3000) { return 14; } // Invalid PMT Header

		l = (l & 0x0fff) + 3;
		if (l > 512) { return 15; } // PMT Length Too Large

		pmt.reset(l);

		if (len < l) l = len;
		memcpy(pmt.mem, pmt.ptr, mem, ptr, l);
		pmt.offset += l;

		if (pmt.offset < pmt.len) { return 0; } // wait for next part
	} else {
		if (!pmt.offset) { return 16; } // PMT Doesn't Start at Beginning of TS Packet Payload

		let l = pmt.len - pmt.offset;
		if (len < l) l = len;
		memcpy(pmt.mem, pmt.ptr + pmt.offset, mem, ptr, l);
		pmt.offset += l;

		if (pmt.offset < pmt.len) { return 0; } // wait for next part
	}

	let { ptr: pmt_ptr, len: l } = pmt;
	const pmt_mem = pmt.mem;
	const n = (pmt_mem.getUint16(pmt_ptr + 10) & 0x0fff) + 12;
	if (n > l) { return 17; } // Program Info Oveflows PMT Length

	pmt_ptr += n;
	l -= n + 4;

	while (l) {
		if (l < 5) { return 18; } // Incomplete Elementary Stream Info

		let pid = pmt_mem.getUint16(pmt_ptr + 1);
		if ((pid & 0xe000) !== 0xe000) { return 19; } // Invalid Elementary Stream Header

		pid &= 0x1fff;
		const ll = (pmt_mem.getUint16(pmt_ptr + 3) & 0x0fff) + 5;
		if (ll > l) { return 20; } // Elementary Stream Data Overflows PMT

		const type = get_stream_type(pmt_mem.getUint8(pmt_ptr));

		pmt_ptr += ll;
		l -= ll;

		const ss = get_stream(pids, pid);
		if (ss.program !== s.program || ss.type !== type) {
			ss.program = s.program;
			ss.type = type;
			ss.id = ++s.id;
			ss.content_type = get_media_type(type);
		}
	}

	return 0;
}


function decode_pes(
	mem: DataView, ptr: number, len: number,
	s: Stream, pstart: number,
	cb: (p: Packet) => void, copy: boolean,
): number {
	// PES (Packetized Elementary Stream)
	start: if (pstart) {

		// PES header
		if (len < 6) { return 21; } // Incomplete PES Packet Header
		if (mem.getUint16(ptr) !== 0 || mem.getUint8(ptr + 2) !== 1) {
			return 22; // Invalid PES Header
		}

		const stream_id = mem.getUint8(ptr + 3);
		let l = mem.getUint16(ptr + 4);

		ptr += 6;
		len -= 6;

		if ( (stream_id < 0xbd || stream_id > 0xfe) ||
			(stream_id > 0xbf && stream_id < 0xc0) ||
			(stream_id > 0xdf && stream_id < 0xe0) ||
			(stream_id > 0xef && stream_id < 0xfa) ) {

			s.stream_id = 0;
			break start;
		}

		// PES header extension
		if (len < 3) { return 23; } // PES Packet Not Long Enough for Extended Header

		const bitmap = mem.getUint8(ptr + 1);
		const hlen = mem.getUint8(ptr + 2) + 3;
		if (len < hlen) { return 24; } // PES Header Overflows File Length
		if (l > 0) { l -= hlen; }

		switch (bitmap & 0xc0) {
			case 0x80: {  // PTS only
				if (hlen < 8) { break; }
				const pts = decode_ts(mem, ptr + 3);

				if (s.has_dts && pts !== s.dts) { s.frame_ticks = pts - s.dts; }
				if (pts > s.last_pts || !s.has_pts) { s.last_pts = pts; }

				if (s.first_pts === 0 && s.frame_num === (s.content_type === stream_type.video ? 1 : 0)) {
					s.first_pts = pts;
				}

				s.dts = pts;
				s.has_dts = true;
				s.has_pts = true;
				break;
			}
			case 0xc0: {  // PTS,DTS
				if (hlen < 13) { break; }
				const pts = decode_ts(mem, ptr + 3);
				const dts = decode_ts(mem, ptr + 8);

				if (s.has_dts && dts > s.dts) { s.frame_ticks = dts - s.dts; }
				if (pts > s.last_pts || !s.has_pts) { s.last_pts = pts; }

				if (s.first_pts === 0 && s.frame_num === (s.content_type === stream_type.video ? 1 : 0)) {
					s.first_pts = pts;
				}

				s.dts = dts;
				s.has_dts = true;
				s.has_pts = true;
				break;
			}
		}

		ptr += hlen;
		len -= hlen;

		s.stream_id = stream_id;
		s.frame_num++;
	}

	if (s.stream_id && s.content_type !== stream_type.unknown) {
		const packet = s.write(mem, ptr, len, pstart, copy);
		if (packet) cb(packet);
	}

	return 0;
}



export function demux_packet(
	pmt: PMT,
	mem: DataView, ptr: number,
	pids: Map<number, Stream>,
	cb: (p: Packet) => void,
	copy: boolean,
): number {
	if (mem.getUint8(ptr) !== 0x47) { return 2; } // invalid packet sync byte

	let pid = mem.getUint16(ptr + 1);
	const flags = mem.getUint8(ptr + 3);

	if (pid & 0x8000) { return 3; } // transport error
	if (flags & 0xc0) { return 4; } // scrambled

	const payload_start = pid & 0x4000;
	pid &= 0x1fff;

	//check if payload exists
	if (pid === 0x1fff || !(flags & 0x10)) { return 0; }

	ptr += 4;
	let len = PACKET_LEN - 4;

	if (flags & 0x20) { // skip adaptation field
		const l = mem.getUint8(ptr) + 1;
		if (l > len) { return 5; } // Adaptation Field Overflows File Length

		ptr += l;
		len -= l;
	}

	if (!pid) {
		return decode_pat(mem, ptr, len, pids, payload_start);
	}

	const s = get_stream(pids, pid);
	if (s.program === 0xffff) { return 0; }
	if (s.type === 0xff) {
		return decode_pmt(pmt, mem, ptr, len, pids, s, payload_start);
	}
	return decode_pes(mem, ptr, len, s, payload_start, cb, copy);
}
